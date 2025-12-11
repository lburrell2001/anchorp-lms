"use client";

import { useEffect, useState, FormEvent, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AdminSidebar from "../../components/AdminSidebar";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: "internal" | "external" | null;
  role: string | null;
};

type CourseRow = {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  audience: "internal" | "external" | "both" | null;
  totalEnrollments: number;
  internalEnrollments: number;
  externalEnrollments: number;
};

type AssignableUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: "internal" | "external" | null;
  role: string | null;
};

type CourseFormState = {
  title: string;
  slug: string;
  description: string;
  audience: "internal" | "external" | "both";
};

export default function AdminCoursesPage() {
  const router = useRouter();

  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(true);

  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // all non-admin users for dropdown
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);

  // assign state
  const [assignCourseId, setAssignCourseId] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState<string>("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);

  // suggested actions
  const [suggestionMessage, setSuggestionMessage] = useState<string | null>(
    null
  );
  

  // ----- COURSE MANAGEMENT STATE -----
  const [selectedCourseId, setSelectedCourseId] = useState<
    string | "new" | null
  >(null);
  const [courseForm, setCourseForm] = useState<CourseFormState>({
    title: "",
    slug: "",
    description: "",
    audience: "both",
  });
  const [savingCourse, setSavingCourse] = useState(false);
  const [courseMessage, setCourseMessage] = useState<string | null>(null);

  // ---------- AUTH / ADMIN CHECK ----------
  useEffect(() => {
    const loadAdmin = async () => {
      setLoadingAdmin(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, user_type, role")
        .eq("id", session.user.id)
        .single();

      if (error || !data || data.role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      setAdminProfile(data as Profile);
      setLoadingAdmin(false);
    };

    loadAdmin();
  }, [router]);

  // ---------- LOAD ASSIGNABLE USERS (all non-admin profiles) ----------
  useEffect(() => {
    const loadAssignableUsers = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, email, user_type, role")
          .neq("role", "admin")
          .order("full_name", { ascending: true });

        if (error) throw error;
        setAssignableUsers((data || []) as AssignableUser[]);
      } catch (err) {
        console.error("Error loading assignable users:", err);
        setAssignableUsers([]);
      }
    };

    if (adminProfile?.role === "admin") {
      loadAssignableUsers();
    }
  }, [adminProfile]);

  // ---------- LOAD COURSES + ENROLLMENT COUNTS ----------
  const loadCourses = useCallback(async () => {
    setLoadingCourses(true);
    setError(null);

    try {
      const { data: courseRows, error: courseError } = await supabase
        .from("courses")
        .select("id, title, description, slug, audience")
        .order("title", { ascending: true });

      if (courseError) throw courseError;

      const coursesRaw = (courseRows || []) as {
        id: string;
        title: string;
        description: string | null;
        slug: string;
        audience: "internal" | "external" | "both" | null;
      }[];

      if (!coursesRaw.length) {
        setCourses([]);
        setLoadingCourses(false);
        // If no courses, reset selection
        setSelectedCourseId("new");
        setCourseForm({
          title: "",
          slug: "",
          description: "",
          audience: "both",
        });
        return;
      }

      const { data: enrollmentRows, error: enrollmentError } = await supabase
        .from("course_enrollments")
        .select("course_id, user_id");

      if (enrollmentError) throw enrollmentError;

      const enrollments =
        (enrollmentRows || []) as { course_id: string; user_id: string }[];

      // ------- NO ENROLLMENTS CASE -------
      if (!enrollments.length) {
        const withCounts: CourseRow[] = coursesRaw.map((c) => ({
          ...c,
          totalEnrollments: 0,
          internalEnrollments: 0,
          externalEnrollments: 0,
        }));

        setCourses(withCounts);

        // 🔑 Only auto-select the first course if NOTHING is selected yet.
        if (!selectedCourseId) {
          const first = withCounts[0];
          if (first) {
            setSelectedCourseId(first.id);
            setCourseForm({
              title: first.title,
              slug: first.slug,
              description: first.description ?? "",
              audience: (first.audience ?? "both") as
                | "internal"
                | "external"
                | "both",
            });
          } else {
            setSelectedCourseId("new");
            setCourseForm({
              title: "",
              slug: "",
              description: "",
              audience: "both",
            });
          }
        }

        setLoadingCourses(false);
        return;
      }

      const uniqueUserIds = Array.from(
        new Set(enrollments.map((e) => e.user_id))
      );

      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, user_type, role")
        .in("id", uniqueUserIds);

      if (profilesError) throw profilesError;

      const userMap = new Map<
        string,
        { user_type: "internal" | "external" | null; role: string | null }
      >();
      (profileRows || []).forEach((p: any) => {
        userMap.set(p.id, {
          user_type: p.user_type,
          role: p.role,
        });
      });

      const totalMap = new Map<string, number>();
      const internalMap = new Map<string, number>();
      const externalMap = new Map<string, number>();

      enrollments.forEach((enr) => {
        const user = userMap.get(enr.user_id);
        if (user?.role === "admin") return; // don't count admin enrollments

        totalMap.set(enr.course_id, (totalMap.get(enr.course_id) || 0) + 1);

        if (user?.user_type === "internal") {
          internalMap.set(
            enr.course_id,
            (internalMap.get(enr.course_id) || 0) + 1
          );
        } else if (user?.user_type === "external") {
          externalMap.set(
            enr.course_id,
            (externalMap.get(enr.course_id) || 0) + 1
          );
        }
      });

      const withCounts: CourseRow[] = coursesRaw.map((c) => ({
        ...c,
        totalEnrollments: totalMap.get(c.id) || 0,
        internalEnrollments: internalMap.get(c.id) || 0,
        externalEnrollments: externalMap.get(c.id) || 0,
      }));

      setCourses(withCounts);

      // 🔑 IMPORTANT PART: don't overwrite when admin chose "new"
      // reset / hydrate the current selection if needed
      if (!selectedCourseId) {
        // nothing selected yet -> default to first course
        const first = withCounts[0];
        if (first) {
          setSelectedCourseId(first.id);
          setCourseForm({
            title: first.title,
            slug: first.slug,
            description: first.description ?? "",
            audience: (first.audience ?? "both") as
              | "internal"
              | "external"
              | "both",
          });
        } else {
          setSelectedCourseId("new");
          setCourseForm({
            title: "",
            slug: "",
            description: "",
            audience: "both",
          });
        }
      } else if (selectedCourseId !== "new") {
        // only hydrate form when we have an existing course selected
        const existing = withCounts.find((c) => c.id === selectedCourseId);
        if (existing) {
          setCourseForm({
            title: existing.title,
            slug: existing.slug,
            description: existing.description ?? "",
            audience: (existing.audience ?? "both") as
              | "internal"
              | "external"
              | "both",
          });
        } else {
          // if previously selected course disappeared, fall back to "new"
          setSelectedCourseId("new");
          setCourseForm({
            title: "",
            slug: "",
            description: "",
            audience: "both",
          });
        }
      }
    } catch (err: any) {
      console.error("Error loading admin courses:", err);
      setError(err.message ?? "Failed to load courses & enrollments.");
      setCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    if (adminProfile?.role === "admin") {
      loadCourses();
    }
  }, [adminProfile, loadCourses]);

  // ---------- ASSIGN COURSE (dropdown of profiles) ----------
  const startAssign = (courseId: string) => {
    setAssignCourseId(courseId);
    setAssignUserId("");
    setAssignMessage(null);
  };

  const cancelAssign = () => {
    setAssignCourseId(null);
    setAssignUserId("");
    setAssignMessage(null);
  };

  const handleAssignSubmit = async (
    e: FormEvent<HTMLFormElement>,
    courseId: string
  ) => {
    e.preventDefault();

    if (!assignUserId) {
      setAssignMessage("Please select a learner from the list.");
      return;
    }

    setAssignLoading(true);
    setAssignMessage(null);

    try {
      const course = courses.find((c) => c.id === courseId);
      if (!course) {
        setAssignMessage("Could not find that course. Please refresh and try again.");
        return;
      }

      const profile = assignableUsers.find((u) => u.id === assignUserId);
      if (!profile) {
        setAssignMessage(
          "That learner is no longer available. Please refresh the page."
        );
        return;
      }

      if (profile.role === "admin") {
        setAssignMessage(
          "This account is an admin. Admins don’t need course assignments."
        );
        return;
      }

      // audience rules still enforced
      if (course.audience === "internal" && profile.user_type === "external") {
        setAssignMessage(
          "This course is for internal employees only and can’t be assigned to an external learner."
        );
        return;
      }

      if (course.audience === "external" && profile.user_type === "internal") {
        setAssignMessage(
          "This course is targeted to external learners. If you’d like internal learners to see it, change the audience to 'both'."
        );
        return;
      }

      // already enrolled?
      const { data: existing, error: existingError } = await supabase
        .from("course_enrollments")
        .select("id")
        .eq("user_id", profile.id)
        .eq("course_id", courseId)
        .maybeSingle();

      if (existingError && existingError.code !== "PGRST116") {
        console.error("Existing enrollment error:", existingError);
      }

      if (existing) {
        setAssignMessage(
          `${profile.full_name || profile.email || "This learner"} is already enrolled in this course.`
        );
        return;
      }

      const { error: insertError } = await supabase
        .from("course_enrollments")
        .insert({
          user_id: profile.id,
          course_id: courseId,
        });

      if (insertError) throw insertError;

      setAssignMessage(
        `Course assigned to ${
          profile.full_name || profile.email || "the selected learner"
        } successfully.`
      );

      await loadCourses();
      setAssignCourseId(null);
      setAssignUserId("");
    } catch (err: any) {
      console.error("Error assigning course:", err);
      setAssignMessage(
        err.message ?? "Something went wrong assigning this course."
      );
    } finally {
      setAssignLoading(false);
    }
  };

  // ---------- SUGGESTED ACTION BUTTONS ----------
  // Which suggested action is currently active, if any
type SuggestedActionKey = "outdated" | "popular_external" | "low_completion";

const [activeSuggested, setActiveSuggested] =
  useState<SuggestedActionKey | null>(null);

const handleSuggestedClick = (action: SuggestedActionKey) => {
  // clicking the same button again turns it off
  setActiveSuggested((prev) => (prev === action ? null : action));
};

  <div className="block">
  <div className="block-header">
    <div className="block-title">Suggested Actions</div>
  </div>
  <p className="small-block-text">
    Use these quick actions to keep Anchor Academy clean and high-impact.
  </p>

  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 8,
      marginTop: 12,
    }}
  >
    <button
      type="button"
      className="btn-secondary"
      style={{
        opacity: activeSuggested === "outdated" ? 1 : 0.8,
        fontWeight: activeSuggested === "outdated" ? 600 : 500,
      }}
      onClick={() => handleSuggestedClick("outdated")}
    >
      Review outdated courses
    </button>

    <button
      type="button"
      className="btn-secondary"
      style={{
        opacity: activeSuggested === "popular_external" ? 1 : 0.8,
        fontWeight: activeSuggested === "popular_external" ? 600 : 500,
      }}
      onClick={() => handleSuggestedClick("popular_external")}
    >
      Highlight popular external courses
    </button>

    <button
      type="button"
      className="btn-secondary"
      style={{
        opacity: activeSuggested === "low_completion" ? 1 : 0.8,
        fontWeight: activeSuggested === "low_completion" ? 600 : 500,
      }}
      onClick={() => handleSuggestedClick("low_completion")}
    >
      Investigate low-completion courses
    </button>
  </div>

  {/* Tiny helper line so it's obvious which one is active */}
  {activeSuggested && (
    <p
      className="small-block-text"
      style={{ marginTop: 8, fontStyle: "italic" }}
    >
      {activeSuggested === "outdated" &&
        "Tip: focus on courses that haven’t been updated recently."}
      {activeSuggested === "popular_external" &&
        "Tip: look for external courses with strong enrollments or ratings."}
      {activeSuggested === "low_completion" &&
        "Tip: investigate courses where many learners start but don’t finish."}
    </p>
  )}
</div>



  // ---------- COURSE MANAGEMENT (view / edit / add / delete) ----------

  const handleSelectExistingCourse = (courseId: string) => {
    if (courseId === "new") {
      setSelectedCourseId("new");
      setCourseForm({
        title: "",
        slug: "",
        description: "",
        audience: "both",
      });
      setCourseMessage(null);
      return;
    }

    const course = courses.find((c) => c.id === courseId);
    if (!course) return;

    setSelectedCourseId(courseId);
    setCourseForm({
      title: course.title,
      slug: course.slug,
      description: course.description ?? "",
      audience: (course.audience ?? "both") as "internal" | "external" | "both",
    });
    setCourseMessage(null);
  };

  const handleCourseInputChange = (
    field: keyof CourseFormState,
    value: string
  ) => {
    setCourseForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCourseSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCourseMessage(null);

    const title = courseForm.title.trim();
    let slug = courseForm.slug.trim();
    const description = courseForm.description.trim();
    const audience = courseForm.audience;

    if (!title) {
      setCourseMessage("Please enter a course title.");
      return;
    }

    if (!slug) {
      slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    setSavingCourse(true);

    try {
      if (!selectedCourseId || selectedCourseId === "new") {
        // CREATE NEW COURSE
        const { data, error } = await supabase
          .from("courses")
          .insert({
            title,
            slug,
            description,
            audience,
          })
          .select("id")
          .single();

        if (error) throw error;

        setCourseMessage("New course created successfully.");
        if (data?.id) {
          setSelectedCourseId(data.id);
        }
      } else {
        // UPDATE EXISTING COURSE
        const { error } = await supabase
          .from("courses")
          .update({
            title,
            slug,
            description,
            audience,
          })
          .eq("id", selectedCourseId);

        if (error) throw error;

        setCourseMessage("Course details updated successfully.");
      }

      await loadCourses();
    } catch (err: any) {
      console.error("Error saving course:", err);
      setCourseMessage(
        err.message ?? "Something went wrong saving this course."
      );
    } finally {
      setSavingCourse(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!selectedCourseId || selectedCourseId === "new") {
      setCourseMessage("Please select a course to delete.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this course? Enrollments for this course will also be removed."
    );
    if (!confirmed) return;

    setSavingCourse(true);
    setCourseMessage(null);

    try {
      // delete enrollments for that course
      const { error: enrollError } = await supabase
        .from("course_enrollments")
        .delete()
        .eq("course_id", selectedCourseId);

      if (enrollError) {
        console.error("Error deleting course enrollments:", enrollError);
      }

      const { error: deleteError } = await supabase
        .from("courses")
        .delete()
        .eq("id", selectedCourseId);

      if (deleteError) throw deleteError;

      setCourseMessage("Course deleted successfully.");
      setSelectedCourseId("new");
      setCourseForm({
        title: "",
        slug: "",
        description: "",
        audience: "both",
      });

      await loadCourses();
    } catch (err: any) {
      console.error("Error deleting course:", err);
      setCourseMessage(
        err.message ?? "Something went wrong deleting this course."
      );
    } finally {
      setSavingCourse(false);
    }
  };

  const handleViewAsLearner = () => {
    if (!selectedCourseId || selectedCourseId === "new") return;
    const course = courses.find((c) => c.id === selectedCourseId);
    if (!course) return;
    router.push(`/courses/${course.slug}`);
  };

  // ---------- RENDER ----------

  if (loadingAdmin || !adminProfile) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }

  return (
    <div className="dashboard-root">
      <AdminSidebar
        active="courses"
        fullName={adminProfile.full_name}
        email={adminProfile.email}
      />

      <div className="main">
        {/* TOPBAR */}
        <div className="topbar">
          <div>
            <div className="topbar-title">Courses &amp; Enrollments</div>
            <div className="topbar-subtitle">
              See which courses are live, assign training, and manage course
              details for Anchor Academy.
            </div>
          </div>
        </div>

        <div className="content-grid">
          {/* LEFT: COURSES TABLE + ASSIGN */}
          <div className="column-main">
            <div className="block">
              <div className="block-header">
                <div className="block-title">Courses Overview</div>
              </div>

              {error && (
                <p
                  style={{
                    marginBottom: 8,
                    fontSize: 12,
                    color: "#b91c1c",
                  }}
                >
                  {error}
                </p>
              )}

              {loadingCourses ? (
                <p className="small-block-text">Loading courses…</p>
              ) : courses.length === 0 ? (
                <p className="small-block-text">
                  No courses found. Use the Course Management panel to create
                  your first course.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    className="admin-table"
                    style={{ width: "100%", fontSize: 13 }}
                  >
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th>Audience</th>
                        <th>Total</th>
                        <th>Internal</th>
                        <th>External</th>
                        <th>Assign</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map((course) => {
                        let audienceLabel = "Internal & external";
                        if (course.audience === "internal")
                          audienceLabel = "Internal only";
                        if (course.audience === "external")
                          audienceLabel = "External only";

                        const isAssigning = assignCourseId === course.id;

                        const eligibleUsers = assignableUsers;

                        return (
                          <tr key={course.id}>
                            <td>
                              <div
                                style={{
                                  fontWeight: 600,
                                  color: "#111827",
                                }}
                              >
                                {course.title}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "#6b7280",
                                  marginTop: 2,
                                }}
                              >
                                {course.description ||
                                  "No description provided."}
                              </div>
                            </td>
                            <td style={{ fontSize: 12, color: "#4b5563" }}>
                              {audienceLabel}
                            </td>
                            <td>{course.totalEnrollments}</td>
                            <td>{course.internalEnrollments}</td>
                            <td>{course.externalEnrollments}</td>
                            <td>
                              {!isAssigning ? (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => startAssign(course.id)}
                                  disabled={eligibleUsers.length === 0}
                                >
                                  {eligibleUsers.length === 0
                                    ? "No learners"
                                    : "Assign"}
                                </button>
                              ) : (
                                <form
                                  onSubmit={(e) =>
                                    handleAssignSubmit(e, course.id)
                                  }
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 6,
                                    minWidth: 220,
                                  }}
                                >
                                  <select
                                    value={assignUserId}
                                    onChange={(e) =>
                                      setAssignUserId(e.target.value)
                                    }
                                    required
                                    style={{
                                      padding: "6px 8px",
                                      borderRadius: 999,
                                      border: "1px solid #d1d5db",
                                      fontSize: 12,
                                    }}
                                  >
                                    <option value="">
                                      Select a learner…
                                    </option>
                                    {eligibleUsers.map((u) => (
                                      <option key={u.id} value={u.id}>
                                        {u.full_name || "Unnamed user"} –{" "}
                                        {u.email || "no-email"}{" "}
                                        {u.user_type
                                          ? `(${u.user_type})`
                                          : ""}
                                      </option>
                                    ))}
                                  </select>
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 6,
                                      justifyContent: "flex-start",
                                    }}
                                  >
                                    <button
                                      type="submit"
                                      className="btn-primary"
                                      disabled={assignLoading}
                                    >
                                      {assignLoading
                                        ? "Assigning…"
                                        : "Assign"}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-secondary"
                                      disabled={assignLoading}
                                      onClick={cancelAssign}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {assignMessage && (
                <p
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    color:
                      assignMessage.toLowerCase().includes("error") ||
                      assignMessage.toLowerCase().includes("can’t") ||
                      assignMessage.toLowerCase().includes("cannot")
                        ? "#b91c1c"
                        : "#047857",
                  }}
                >
                  {assignMessage}
                </p>
              )}
            </div>
          </div>

          {/* RIGHT: COURSE MANAGEMENT + SUGGESTED ACTIONS */}
          <div className="column-side">
            {/* COURSE MANAGEMENT */}
            <div className="block">
              <div className="block-header">
                <div className="block-title">Course Management</div>
              </div>
              <p className="small-block-text">
                View and edit course details, create new courses, or remove
                courses from Anchor Academy.
              </p>

              {/* Select course or "new" */}
              <div style={{ marginBottom: 10 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    marginBottom: 4,
                    color: "#4b5563",
                  }}
                >
                  Select a course
                </label>
                <select
                  value={selectedCourseId ?? "new"}
                  onChange={(e) => handleSelectExistingCourse(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 999,
                    border: "1px solid #d1d5db",
                    fontSize: 13,
                  }}
                >
                  <option value="new">➕ New course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Course form */}
              <form
                onSubmit={handleCourseSave}
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      marginBottom: 4,
                      color: "#4b5563",
                    }}
                  >
                    Title
                  </label>
                  <input
                    type="text"
                    value={courseForm.title}
                    onChange={(e) =>
                      handleCourseInputChange("title", e.target.value)
                    }
                    placeholder="Course title"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 999,
                      border: "1px solid #d1d5db",
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      marginBottom: 4,
                      color: "#4b5563",
                    }}
                  >
                    Slug (URL)
                  </label>
                  <input
                    type="text"
                    value={courseForm.slug}
                    onChange={(e) =>
                      handleCourseInputChange("slug", e.target.value)
                    }
                    placeholder="e.g. anchorp-101"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 999,
                      border: "1px solid #d1d5db",
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      marginBottom: 4,
                      color: "#4b5563",
                    }}
                  >
                    Description
                  </label>
                  <textarea
                    value={courseForm.description}
                    onChange={(e) =>
                      handleCourseInputChange("description", e.target.value)
                    }
                    placeholder="Short summary of the course."
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 12,
                      border: "1px solid #d1d5db",
                      fontSize: 13,
                      resize: "vertical",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      marginBottom: 4,
                      color: "#4b5563",
                    }}
                  >
                    Audience
                  </label>
                  <select
                    value={courseForm.audience}
                    onChange={(e) =>
                      handleCourseInputChange(
                        "audience",
                        e.target.value as "internal" | "external" | "both"
                      )
                    }
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 999,
                      border: "1px solid #d1d5db",
                      fontSize: 13,
                    }}
                  >
                    <option value="both">Internal &amp; external</option>
                    <option value="internal">Internal only</option>
                    <option value="external">External only</option>
                  </select>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={savingCourse}
                  >
                    {savingCourse
                      ? "Saving…"
                      : selectedCourseId === "new"
                      ? "Create course"
                      : "Save changes"}
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      if (!selectedCourseId || selectedCourseId === "new")
                        return;
                      router.push(
                        `/admin/courses/${selectedCourseId}/content`
                      );
                    }}
                    disabled={!selectedCourseId || selectedCourseId === "new"}
                  >
                    Manage content
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleViewAsLearner}
                    disabled={
                      savingCourse ||
                      !selectedCourseId ||
                      selectedCourseId === "new"
                    }
                  >
                    View as learner
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ background: "#fee2e2", color: "#b91c1c" }}
                    onClick={handleDeleteCourse}
                    disabled={
                      savingCourse ||
                      !selectedCourseId ||
                      selectedCourseId === "new"
                    }
                  >
                    Delete course
                  </button>
                </div>
              </form>

              {courseMessage && (
                <p
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: courseMessage.toLowerCase().includes("wrong")
                      ? "#b91c1c"
                      : "#047857",
                  }}
                >
                  {courseMessage}
                </p>
              )}
            </div>

           
            </div>
          </div>
        </div>
      </div>
    
  );
}
