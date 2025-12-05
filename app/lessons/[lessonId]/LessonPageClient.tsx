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

type LessonResource = {
  id: string;
  lesson_id: string;
  title: string;
  resource_type: string;
  storage_path: string | null;
};

type LessonProgressRow = {
  lesson_id: string;
  completed_at: string | null;
};

export default function LessonPage() {
  const { slug, lessonId } = useParams<{
    slug: string;
    lessonId: string;
  }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [resources, setResources] = useState<LessonResource[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingComplete, setMarkingComplete] = useState(false);

  // --------------------------------------------------
  // LOAD COURSE + LESSON + RESOURCES + PROGRESS
  // --------------------------------------------------
  const loadData = useCallback(async () => {
    if (!slug || !lessonId) return;

    setLoading(true);
    setError(null);

    // current user (for progress)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      setError(userError.message);
    }

    // 1) course by slug
    const { data: courseRow, error: courseError } = await supabase
      .from("courses")
      .select("id, title, description, audience")
      .eq("slug", slug)
      .maybeSingle();

    if (courseError || !courseRow) {
      setError(courseError?.message || "Course not found.");
      setLoading(false);
      return;
    }

    const courseId = courseRow.id as string;
    setCourse(courseRow as Course);

    // 2) lesson by id (you can optionally join modules->course_id if you want stricter check)
    const { data: lessonRow, error: lessonError } = await supabase
      .from("lessons")
      .select("id, title, module_id")
      .eq("id", lessonId)
      .maybeSingle();

    if (lessonError || !lessonRow) {
      setError(lessonError?.message || "Lesson not found.");
      setLoading(false);
      return;
    }

    setLesson(lessonRow as Lesson);

    // 3) resources for this lesson
    const { data: resourceRows, error: resourceError } = await supabase
      .from("lesson_resources")
      .select("id, lesson_id, title, resource_type, storage_path")
      .eq("lesson_id", lessonId);

    if (resourceError) {
      setError(resourceError.message);
    } else {
      setResources((resourceRows || []) as LessonResource[]);
    }

    // 4) progress for this user + lesson
    if (user) {
      const { data: lpRow, error: lpError } = await supabase
        .from("lesson_progress")
        .select("lesson_id, completed_at")
        .eq("user_id", user.id)
        .eq("lesson_id", lessonId)
        .maybeSingle();

      if (!lpError && lpRow) {
        const lp = lpRow as LessonProgressRow;
        setIsCompleted(!!lp.completed_at);
      }
    }

    setLoading(false);
  }, [slug, lessonId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --------------------------------------------------
  // LOAD SIGNED VIDEO URL FOR THIS LESSON
  // --------------------------------------------------
  useEffect(() => {
    const loadVideo = async () => {
      const videoRes = resources.find(
        (r) => r.resource_type === "video" && r.storage_path
      );

      if (!videoRes || !videoRes.storage_path) {
        setVideoUrl(null);
        return;
      }

      const { data, error } = await supabase.storage
        .from("course-videos") // same bucket as course page
        .createSignedUrl(videoRes.storage_path, 3600);

      if (error) {
        console.error(error);
        setVideoUrl(null);
        return;
      }

      setVideoUrl(data?.signedUrl ?? null);
    };

    loadVideo();
  }, [resources]);

  // --------------------------------------------------
  // MARK LESSON COMPLETE
  // --------------------------------------------------
  const handleMarkComplete = async () => {
    if (!lesson) return;

    setMarkingComplete(true);
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("You must be logged in to mark lessons complete.");
      setMarkingComplete(false);
      return;
    }

    try {
      const { data: existing, error: existingError } = await supabase
        .from("lesson_progress")
        .select("id, completed_at")
        .eq("user_id", user.id)
        .eq("lesson_id", lesson.id)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        const { error: updateError } = await supabase
          .from("lesson_progress")
          .update({
            completed_at: new Date().toISOString(),
          })
          .eq("id", (existing as any).id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("lesson_progress")
          .insert({
            user_id: user.id,
            lesson_id: lesson.id,
            completed_at: new Date().toISOString(),
          });

        if (insertError) throw insertError;
      }

      setIsCompleted(true);
    } catch (e: any) {
      setError(e.message || "Failed to mark lesson complete.");
    } finally {
      setMarkingComplete(false);
    }
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------
  if (loading) {
    return (
      <div className="dashboard-root">
        <aside className="sidebar" />
        <main className="main" style={{ display: "flex", alignItems: "center" }}>
          <p>Loading lesson…</p>
        </main>
      </div>
    );
  }

  if (!course || !lesson) {
    return (
      <div className="dashboard-root">
        <aside className="sidebar" />
        <main className="main">
          <p>Lesson not found.</p>
        </main>
      </div>
    );
  }

  const additionalResources = resources.filter(
    (r) => r.resource_type !== "video"
  );

  return (
    <div className="dashboard-root">
      {/* SIDEBAR – same as course page */}
      <aside className="sidebar">
        <div className="sidebar-profile">
          <div className="avatar-circle">
            {course.title.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="profile-name">{course.title}</div>
            <div className="profile-email">
              {course.audience === "internal"
                ? "Internal course"
                : course.audience === "external"
                ? "External course"
                : "Internal & external"}
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className="nav-item"
            onClick={() => router.push("/dashboard")}
          >
            ← Back to dashboard
          </button>
          <button
            className="nav-item"
            onClick={() => router.push(`/courses/${slug}`)}
          >
            Back to course
          </button>
          <button className="nav-item" onClick={() => router.push("/courses")}>
            All courses
          </button>
        </nav>
      </aside>

      {/* MAIN – matches the UI of the screenshot */}
      <main className="main">
        {/* Top bar */}
        <div className="topbar">
          <div>
            <div className="topbar-title">{course.title}</div>
            <div className="topbar-subtitle">
              Work through the lessons below and mark each one complete to track
              your progress.
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "280px 1fr",
            gap: "18px",
            alignItems: "flex-start",
          }}
        >
          {/* LEFT CARD – single active lesson */}
          <section className="block">
            <div className="block-header">
              <div className="block-title">Lessons</div>
            </div>

            <div
              className="course-card"
              style={{
                borderColor: "#047835",
                background: "#e8f9f0",
              }}
            >
              <div className="course-card-main">
                <div className="course-title">{lesson.title}</div>
                <div className="course-meta">
                  {isCompleted ? "Completed" : "Not completed"}
                </div>
              </div>

              {isCompleted && (
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "#047835",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 14,
                  }}
                >
                  ✓
                </div>
              )}
            </div>
          </section>

          {/* RIGHT CARD – video + resources + complete button */}
          <section className="block">
            <div className="block-header">
              <div className="block-title">{lesson.title}</div>
            </div>

            {videoUrl ? (
              <div style={{ marginBottom: "16px" }}>
                <video
                  src={videoUrl}
                  controls
                  style={{
                    width: "100%",
                    borderRadius: "12px",
                    maxHeight: "480px",
                    backgroundColor: "#000",
                  }}
                />
              </div>
            ) : (
              <p className="small-block-text">
                No video has been attached to this lesson yet.
              </p>
            )}

            {additionalResources.length > 0 && (
              <div style={{ marginTop: "8px" }}>
                <div
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    marginBottom: "6px",
                  }}
                >
                  Additional resources
                </div>
                <ul style={{ fontSize: "0.8rem", color: "#76777b" }}>
                  {additionalResources.map((r) => (
                    <li key={r.id}>• {r.title}</li>
                  ))}
                </ul>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "18px",
                gap: "12px",
              }}
            >
              <button
                className="btn-primary"
                onClick={handleMarkComplete}
                disabled={markingComplete || isCompleted}
              >
                {isCompleted
                  ? "Lesson completed"
                  : markingComplete
                  ? "Marking complete…"
                  : "Mark lesson complete"}
              </button>

              {error && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "#b91c1c",
                    textAlign: "right",
                  }}
                >
                  {error}
                </span>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
