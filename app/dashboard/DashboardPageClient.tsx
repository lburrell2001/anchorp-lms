"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import AppSidebar from "../components/AppSidebar";

type Course = {
  id: string;
  title: string;
  slug: string;
  audience: "internal" | "external" | "both" | null;
};

type Enrollment = {
  id: string;
  course_id: string;
  courses: Course;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: "internal" | "external" | null;
};

function getInitials(name: string | null | undefined) {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (
    parts[0].charAt(0).toUpperCase() +
    parts[parts.length - 1].charAt(0).toUpperCase()
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeUsers, setActiveUsers] = useState<Profile[]>([]);
  const [inProgress, setInProgress] = useState<Enrollment[]>([]);
  const [recommended, setRecommended] = useState<Course[]>([]);
  const [coursesCompleted, setCoursesCompleted] = useState(0);
  const [lessonsCompleted, setLessonsCompleted] = useState(0);
  const [progressByCourse, setProgressByCourse] = useState<
    Record<string, number>
  >({});
  const [certificatesCount, setCertificatesCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // NEW: mobile sidebar toggle
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // --------------------------------------------------
  // LOAD DASHBOARD DATA FROM SUPABASE
  // --------------------------------------------------
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("You must be logged in to view the dashboard.");
      setLoading(false);
      return;
    }

    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, user_type")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    let profileRow = existingProfile as Profile | null;

    if (!profileRow) {
      const email = user.email ?? "";
      const fullName =
        (user.user_metadata as any)?.full_name ||
        email.split("@")[0] ||
        "Learner";

      const userType: "internal" | "external" =
        email.toLowerCase().endsWith("@anchorp.com") ? "internal" : "external";

      const { data: inserted, error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          email,
          full_name: fullName,
          user_type: userType,
        })
        .select("id, full_name, email, user_type")
        .single();

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      profileRow = inserted as Profile;
    }

    setProfile(profileRow);

    const { data: activeProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, user_type")
      .limit(4);

    setActiveUsers((activeProfiles || []) as Profile[]);

    const isInternal = profileRow?.user_type === "internal";
    const allowedAudiences = isInternal
      ? ["internal", "both", "external"]
      : ["external", "both"];

    const { data: enrollments, error: enrollError } = await supabase
      .from("course_enrollments")
      .select("id, course_id, courses(*)")
      .eq("user_id", user.id);

    if (enrollError) {
      setError(enrollError.message);
      setLoading(false);
      return;
    }

    const enrolls = (enrollments || []) as Enrollment[];
    setInProgress(enrolls);

    const enrolledCourseIds = enrolls.map((e) => e.course_id);

    let recQuery = supabase
      .from("courses")
      .select("id, title, slug, audience")
      .in("audience", allowedAudiences)
      .order("title", { ascending: true });

    if (enrolledCourseIds.length > 0) {
      const idList = `(${enrolledCourseIds.join(",")})`;
      recQuery = recQuery.not("id", "in", idList);
    }

    const { data: recCourses, error: recError } = await recQuery.limit(6);

    if (recError) {
      setError(recError.message);
      setLoading(false);
      return;
    }

    setRecommended((recCourses || []) as Course[]);

    const { data: lessonProgress, error: lpError } = await supabase
      .from("lesson_progress")
      .select("lesson_id, completed:completed_at")
      .eq("user_id", user.id);

    if (lpError) {
      setError(lpError.message);
      setLoading(false);
      return;
    }

    const completedLessonIds = (lessonProgress || [])
      .filter((lp: any) => lp.completed)
      .map((lp: any) => lp.lesson_id);

    setLessonsCompleted(completedLessonIds.length);

    let progressMap: Record<string, number> = {};
    let completedCoursesSet = new Set<string>();

    if (enrolledCourseIds.length > 0) {
      const { data: lessonsData } = await supabase
        .from("lessons")
        .select("id, modules!inner(course_id)")
        .order("id");

      const completedSet = new Set(completedLessonIds);

      const totals: Record<string, number> = {};
      const completedCounts: Record<string, number> = {};

      (lessonsData || []).forEach((row: any) => {
        const courseId = row.modules?.course_id;
        if (!courseId) return;

        totals[courseId] = (totals[courseId] || 0) + 1;
        if (completedSet.has(row.id)) {
          completedCounts[courseId] = (completedCounts[courseId] || 0) + 1;
        }
      });

      Object.keys(totals).forEach((courseId) => {
        const total = totals[courseId];
        const done = completedCounts[courseId] || 0;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        progressMap[courseId] = pct;
        if (total > 0 && done === total) {
          completedCoursesSet.add(courseId);
        }
      });
    }

    setProgressByCourse(progressMap);
    setCoursesCompleted(completedCoursesSet.size);

    const { data: certRows, error: certError } = await supabase
      .from("certificates")
      .select("id")
      .eq("user_id", user.id);

    if (certError) {
      setError(certError.message);
      setLoading(false);
      return;
    }

    setCertificatesCount((certRows || []).length);

    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const coursesInProgressCount = Math.max(
    inProgress.length - coursesCompleted,
    0
  );

  const hasEnrollment = inProgress.length > 0;
  const hasAnyLessonProgress = lessonsCompleted > 0;
  const hasCompletedCourse = coursesCompleted > 0;
  const hasCertificate = certificatesCount > 0;

  const step1Status = hasEnrollment ? "Completed" : "Not started";
  const step2Status = hasCompletedCourse
    ? "Completed"
    : hasAnyLessonProgress
    ? "In progress"
    : hasEnrollment
    ? "Locked"
    : "Locked";

  const step3Status = hasCertificate
    ? "Completed"
    : hasCompletedCourse
    ? "In progress"
    : "Locked";

  const routerPush = (path: string) => router.push(path);

  const handleViewAllCourses = () => routerPush("/courses");
  const handleSeeAllCourses = () => routerPush("/courses");
  const handleViewInProgress = () => routerPush("/my-courses");
  const handleViewLearningPaths = () => routerPush("/learning-paths");
  const handleViewCertificates = () => routerPush("/certificates");
  const handleViewReports = () => routerPush("/reports");
  const handleViewSettings = () => routerPush("/settings");

  const handleResumeLastCourse = () => {
    if (!inProgress.length) {
      routerPush("/my-courses");
      return;
    }
    const last = inProgress[0];
    const slug = last.courses?.slug;
    if (slug) routerPush(`/courses/${slug}`);
  };

  const handleAddToMyCourses = async (courseId: string) => {
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("You must be logged in to add courses.");
      return;
    }

    const { error: enrollError } = await supabase
      .from("course_enrollments")
      .insert({
        user_id: user.id,
        course_id: courseId,
      });

    if (enrollError) {
      setError(enrollError.message);
      return;
    }

    await loadDashboard();
  };

  if (loading) {
    return (
      <div className="dashboard-root">
        <div className={`app-sidebar ${sidebarOpen ? "app-sidebar-open" : ""}`}>
          <AppSidebar
            active="dashboard"
            fullName={profile?.full_name ?? null}
            email={profile?.email ?? null}
          />
        </div>
        <main className="main" style={{ display: "flex", alignItems: "center" }}>
          <p>Loading dashboard…</p>
        </main>
      </div>
    );
  }

  const displayName = profile?.full_name || "Learner";
  const displayEmail = profile?.email || "";

  return (
    <div className="dashboard-root">
      {/* SIDEBAR */}
      <div className={`app-sidebar ${sidebarOpen ? "app-sidebar-open" : ""}`}>
        <AppSidebar
          active="dashboard"
          fullName={profile?.full_name ?? null}
          email={profile?.email ?? null}
        />
      </div>

      {/* MAIN */}
      <main className="main">
        {/* Top bar */}
        <div className="topbar">
          {/* mobile menu button */}
          <button
            className="mobile-menu-button"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>

          <div className="topbar-text">
            <div className="topbar-title">
              Welcome back, {displayName.split(" ")[0]} 👋
            </div>
            <div className="topbar-subtitle">
              View your course progress and discover new training from Anchorp
              Academy.
            </div>
          </div>

          <div className="topbar-actions">
            <button className="btn-secondary" onClick={handleViewAllCourses}>
              View all courses
            </button>
            <button className="btn-primary" onClick={handleResumeLastCourse}>
              Resume last course
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Courses in progress</div>
            <div className="stat-value">{coursesInProgressCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Courses completed</div>
            <div className="stat-value">{coursesCompleted}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Lessons completed</div>
            <div className="stat-value">{lessonsCompleted}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active users</div>
            <div className="stat-value">{activeUsers.length}</div>
          </div>
        </div>

        {/* Content grid */}
        <div className="content-grid">
          {/* LEFT COLUMN */}
          <div className="column-main">
            {/* In progress */}
            <section className="block">
              <div className="block-header">
                <div className="block-title">In progress</div>
                <button
                  className="link-button"
                  onClick={handleViewInProgress}
                >
                  View all
                </button>
              </div>

              {inProgress.length === 0 ? (
                <p className="small-block-text">
                  You don’t have any in-progress courses yet.
                </p>
              ) : (
                <div className="course-list">
                  {inProgress.slice(0, 3).map((enrollment) => {
                    const c = enrollment.courses;
                    const pct = progressByCourse[enrollment.course_id] ?? 0;
                    return (
                      <div key={enrollment.id} className="course-card">
                        <div className="course-card-main">
                          <div className="course-title">{c.title}</div>
                          <div className="course-meta">Course</div>
                          <div className="progress-row">
                            <div className="progress-track">
                              <div
                                className="progress-fill"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="progress-label">
                              {pct}% complete
                            </div>
                          </div>
                        </div>
                        <div>
                          <button
                            className="btn-primary"
                            style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                            onClick={() => router.push(`/courses/${c.slug}`)}
                          >
                            Continue
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Recommended */}
            <section className="block">
              <div className="block-header">
                <div className="block-title">Recommended for you</div>
                <button
                  className="link-button"
                  onClick={handleViewAllCourses}
                >
                  See more
                </button>
              </div>

              {recommended.length === 0 ? (
                <p className="small-block-text">
                  You’re enrolled in all available courses right now.
                </p>
              ) : (
                <div className="course-grid">
                  {recommended.map((course) => (
                    <div key={course.id} className="course-card-mini">
                      <div className="course-title">{course.title}</div>
                      <div className="course-meta">Course</div>
                      <button
                        className="btn-secondary"
                        style={{
                          fontSize: "0.8rem",
                          padding: "6px 12px",
                          marginTop: "8px",
                        }}
                        onClick={() => handleAddToMyCourses(course.id)}
                      >
                        Add to my courses
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN */}
          <div className="column-side">
            <section className="block map-block">
              <div className="map-label">Learning path</div>
              <div className="map-title">Anchorp LMS Overview</div>
              <div className="map-subtitle">
                Courses above are pulled directly from your Supabase tables.
                Progress is based on finished lessons and earned certificates.
              </div>

              <div className="map-steps">
                <div
                  className={
                    "map-step" + (hasEnrollment ? " map-step-active" : "")
                  }
                >
                  <div className="map-step-dot" />
                  <div style={{ flex: 1 }}>
                    <div className="map-row">
                      <div>
                        <div className="map-step-title">Step 1</div>
                        <div className="map-step-meta">
                          Enroll in your first course.
                        </div>
                      </div>
                      <div className="map-step-status">{step1Status}</div>
                    </div>
                  </div>
                </div>

                <div
                  className={
                    "map-step" +
                    (hasAnyLessonProgress || hasCompletedCourse
                      ? " map-step-active"
                      : "")
                  }
                >
                  <div className="map-step-dot" />
                  <div style={{ flex: 1 }}>
                    <div className="map-row">
                      <div>
                        <div className="map-step-title">Step 2</div>
                        <div className="map-step-meta">
                          Complete all lessons in a course.
                        </div>
                      </div>
                      <div className="map-step-status">{step2Status}</div>
                    </div>
                  </div>
                </div>

                <div
                  className={
                    "map-step" + (hasCertificate ? " map-step-active" : "")
                  }
                >
                  <div className="map-step-dot" />
                  <div style={{ flex: 1 }}>
                    <div className="map-row">
                      <div>
                        <div className="map-step-title">Step 3</div>
                        <div className="map-step-meta">
                          Earn certificates & track CEUs.
                        </div>
                      </div>
                      <div className="map-step-status">{step3Status}</div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                className="btn-primary"
                style={{ width: "100%", marginTop: "8px" }}
                onClick={handleViewLearningPaths}
              >
                View learning path details
              </button>
            </section>

            <section className="block">
              <div className="block-title">Browse all courses</div>
              <p className="small-block-text">
                Open the full course catalog powered by your Supabase{" "}
                <span style={{ fontFamily: "monospace" }}>courses</span> table.
              </p>
              <button
                className="btn-secondary"
                style={{ width: "100%" }}
                onClick={handleSeeAllCourses}
              >
                See all courses
              </button>
            </section>
          </div>
        </div>

        {error && (
          <p
            style={{
              marginTop: "12px",
              fontSize: "0.8rem",
              color: "#b91c1c",
            }}
          >
            {error}
          </p>
        )}
      </main>

      <style jsx>{`
        .map-step-status {
          font-size: 0.7rem;
          font-weight: 600;
          color: #ecfdf3;
          opacity: 0.9;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
}
