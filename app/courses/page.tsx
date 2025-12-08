"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import AppSidebar from "../components/AppSidebar"; // adjust path if needed

type Course = {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  audience: "internal" | "external" | "both" | null;
};

type Enrollment = {
  id: string;
  course_id: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: "internal" | "external" | "both" | null;
};

export default function AllCoursesPage() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("You must be signed in to view courses.");

      // ----- PROFILE (for sidebar + user_type) -----
      const { data: existingProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, user_type")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      let profileRow = existingProfile as Profile | null;
      let effectiveUserType: "internal" | "external" | "both" | null =
        profileRow?.user_type ?? null;

      if (!profileRow) {
        const email = user.email ?? "";
        const fullName =
          (user.user_metadata as any)?.full_name ||
          email.split("@")[0] ||
          "Learner";

        const defaultType: "internal" | "external" =
          email.toLowerCase().endsWith("@anchorp.com")
            ? "internal"
            : "external";

        const { data: inserted, error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            email,
            full_name: fullName,
            user_type: defaultType,
          })
          .select("id, full_name, email, user_type")
          .single();

        if (insertError) throw insertError;

        profileRow = inserted as Profile;
        effectiveUserType = defaultType;
      }

      setProfile(profileRow);

      // ----- DETERMINE WHICH AUDIENCES THIS USER CAN SEE -----
      const isInternal = effectiveUserType === "internal";
      const allowedAudiences: ("internal" | "external" | "both")[] = isInternal
        ? ["internal", "both", "external"] // internal can see everything
        : ["external", "both"]; // external can't see internal-only

      // ----- COURSES (filtered by audience) -----
      const { data: courseRows, error: courseError } = await supabase
        .from("courses")
        .select("id, title, description, audience, slug")
        .in("audience", allowedAudiences)
        .order("title", { ascending: true });

      if (courseError) throw courseError;
      setCourses((courseRows || []) as Course[]);

      // If you have any legacy rows with audience = null and want them visible
      // to everyone, swap the block above for this:
      //
      // const { data: courseRows, error: courseError } = await supabase
      //   .from("courses")
      //   .select("id, title, description, audience, slug")
      //   .or(
      //     `audience.is.null,audience.in.(${allowedAudiences.join(",")})`
      //   )
      //   .order("title", { ascending: true });

      // ----- USER ENROLLMENTS -----
      const { data: enrollmentRows, error: enrollmentError } = await supabase
        .from("course_enrollments")
        .select("id, course_id")
        .eq("user_id", user.id);

      if (enrollmentError) throw enrollmentError;
      setEnrollments((enrollmentRows || []) as Enrollment[]);
    } catch (e: any) {
      console.error("Error loading courses:", e);
      setError(e.message ?? "Failed to load courses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const enrolledCourseIds = new Set(enrollments.map((e) => e.course_id));

  const handleEnroll = async (courseId: string) => {
    setError(null);
    setEnrollingId(courseId);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("You must be signed in to enroll.");

      const { error: insertError } = await supabase
        .from("course_enrollments")
        .insert({ user_id: user.id, course_id: courseId });

      if (insertError) throw insertError;

      const { data: enrollmentRows, error: enrollmentError } = await supabase
        .from("course_enrollments")
        .select("id, course_id")
        .eq("user_id", user.id);

      if (enrollmentError) throw enrollmentError;
      setEnrollments((enrollmentRows || []) as Enrollment[]);
    } catch (e: any) {
      console.error("Error enrolling:", e);
      setError(e.message ?? "Failed to enroll in course.");
    } finally {
      setEnrollingId(null);
    }
  };

  const fullName = profile?.full_name ?? null;
  const email = profile?.email ?? null;

  return (
    <div className="dashboard-root">
      {/* Shared dashboard sidebar */}
      <AppSidebar active="all-courses" fullName={fullName} email={email} />

      {/* MAIN */}
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">All courses</div>
            <div className="topbar-subtitle">
              Enroll in a course to add it to your dashboard.
            </div>
          </div>
        </div>

        <section className="block">
          {loading && <p>Loading courses...</p>}

          {error && (
            <p
              style={{
                marginBottom: 12,
                fontSize: "0.8rem",
                color: "#b91c1c",
              }}
            >
              {error}
            </p>
          )}

          {!loading && !error && courses.length === 0 && (
            <p className="small-block-text">
              No courses are currently available for your account.
            </p>
          )}

          {!loading &&
            !error &&
            courses.map((course) => {
              const isEnrolled = enrolledCourseIds.has(course.id);

              let audienceLabel = "Internal & external";
              if (course.audience === "internal") audienceLabel = "Internal only";
              if (course.audience === "external") audienceLabel = "External";

              return (
                <div
                  key={course.id}
                  style={{
                    borderBottom: "1px solid #e5e7eb",
                    padding: "14px 0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 600,
                        color: "#111827",
                      }}
                    >
                      {course.title}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: "0.8rem",
                        color: "#4b5563",
                      }}
                    >
                      {course.description || "No description provided yet."}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: "0.75rem",
                        color: "#6b7280",
                      }}
                    >
                      Audience: {audienceLabel}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isEnrolled ? (
                      <>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            color: "#047857",
                          }}
                        >
                          ✓ Enrolled
                        </span>
                        <button
                          onClick={() => (window.location.href = `/courses/${course.slug}`)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 999,
                            border: "none",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            backgroundColor: "#111827",
                            color: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          Go to course
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleEnroll(course.id)}
                        disabled={enrollingId === course.id}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 999,
                          border: "none",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          backgroundColor: "#047857",
                          color: "#fff",
                          cursor:
                            enrollingId === course.id ? "default" : "pointer",
                          opacity: enrollingId === course.id ? 0.7 : 1,
                        }}
                      >
                        {enrollingId === course.id ? "Enrolling..." : "Enroll"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </section>
      </main>
    </div>
  );
}
