"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Course = {
  id: string;
  title: string;
  description?: string | null;
  audience: "internal" | "external" | "both" | null;
};

type Lesson = {
  id: string;
  title: string;
  module_id: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: "internal" | "external" | null;
};

type LessonProgressRow = {
  lesson_id: string;
  completed_at: string | null;
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

export default function CoursePage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // --------------------------------------------------
  // LOAD COURSE + LESSONS + PROGRESS
  // --------------------------------------------------
  const loadData = useCallback(async () => {
    if (!slug) return;

    setLoading(true);
    setError(null);

    try {
      // 1) current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("You must be signed in to view this course.");

      // 2) profile for sidebar
      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, user_type")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (profileRow) setProfile(profileRow as Profile);

      // 3) course by slug
      const { data: courseRow, error: courseError } = await supabase
        .from("courses")
        .select("id, title, description, audience")
        .eq("slug", slug)
        .maybeSingle();

      if (courseError) throw courseError;
      if (!courseRow) throw new Error("Course not found.");

      const courseTyped = courseRow as Course;
      setCourse(courseTyped);

      // 4) lessons for this course (via modules)
      const { data: lessonRows, error: lessonError } = await supabase
        .from("lessons")
        .select("id, title, module_id, modules!inner(course_id)")
        .eq("modules.course_id", courseTyped.id)
        .order("id");

      if (lessonError) throw lessonError;
      const lessonList = (lessonRows || []) as Lesson[];
      setLessons(lessonList);

      // 5) lesson progress for this user
      const { data: lpRows, error: lpError } = await supabase
        .from("lesson_progress")
        .select("lesson_id, completed_at")
        .eq("user_id", user.id);

      if (lpError) throw lpError;

      const completed = (lpRows || [])
        .filter((row: LessonProgressRow) => row.completed_at)
        .map((row: LessonProgressRow) => row.lesson_id);

      setCompletedLessonIds(completed);
    } catch (e: any) {
      console.error("Error loading course:", e);
      setError(e.message ?? "Failed to load course.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --------------------------------------------------
  // PROGRESS
  // --------------------------------------------------
  const totalLessons = lessons.length;
  const completedCount = lessons.filter((l) =>
    completedLessonIds.includes(l.id)
  ).length;
  const percent =
    totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  // --------------------------------------------------
  // NAV HANDLERS
  // --------------------------------------------------
  const goDashboard = () => router.push("/dashboard");
  const goMyCourses = () => router.push("/my-courses");
  const goAllCourses = () => router.push("/courses");
  const goCertificates = () => router.push("/certificates");
  const goReports = () => router.push("/reports");
  const goSettings = () => router.push("/settings");

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------
  if (loading) {
    return (
      <div className="dashboard-root">
        <aside className="sidebar" />
        <main className="main" style={{ display: "flex", alignItems: "center" }}>
          <p>Loading course…</p>
        </main>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="dashboard-root">
        <aside className="sidebar" />
        <main className="main">
          <p>Course not found.</p>
          {error && (
            <p style={{ marginTop: 8, fontSize: "0.8rem", color: "#b91c1c" }}>
              {error}
            </p>
          )}
        </main>
      </div>
    );
  }

  const displayName = profile?.full_name || "Learner";
  const displayEmail = profile?.email || "";

  return (
    <div className="dashboard-root">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-profile">
          <div className="avatar-circle">{getInitials(displayName)}</div>
          <div>
            <div className="profile-name">{displayName}</div>
            <div className="profile-email">{displayEmail}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button className="nav-item" onClick={goDashboard}>
            Dashboard
          </button>
          <button className="nav-item" onClick={goMyCourses}>
            My Courses
          </button>
          <button className="nav-item nav-item-active" onClick={goAllCourses}>
            All Courses
          </button>
          <button className="nav-item" onClick={goCertificates}>
            Certificates
          </button>
          <button className="nav-item" onClick={goReports}>
            Reports
          </button>
          <button className="nav-item" onClick={goSettings}>
            Settings
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">{course.title}</div>
            <div className="topbar-subtitle">
              Work through the lessons below to track your progress.
            </div>
          </div>
        </div>

        {/* Progress summary */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: "0.85rem",
              marginBottom: 4,
              color: "#111827",
            }}
          >
            Progress: {completedCount} of {totalLessons} lessons completed (
            {percent}%)
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* SINGLE COLUMN – NO RIGHT PREVIEW */}
        <section className="block">
          <div className="block-header">
            <div className="block-title">Lessons</div>
          </div>

          {lessons.length === 0 ? (
            <p className="small-block-text">
              No lessons are available for this course yet.
            </p>
          ) : (
            <div className="course-list">
              {lessons.map((lesson) => {
                const completed = completedLessonIds.includes(lesson.id);
                return (
                  <div key={lesson.id} className="course-card">
                    <div className="course-card-main">
                      <div className="course-title">{lesson.title}</div>
                      <div className="course-meta">
                        {completed ? "Completed" : "Not completed"}
                      </div>
                    </div>
                    <div>
                      <button
                        className="btn-primary"
                        style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                        onClick={() => router.push(`/lessons/${lesson.id}`)}
                      >
                        Open lesson
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <p
              style={{
                marginTop: 12,
                fontSize: "0.8rem",
                color: "#b91c1c",
              }}
            >
              {error}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
