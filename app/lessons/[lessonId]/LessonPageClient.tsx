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
  content?: string | null; // <-- add this column in Supabase
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
};

export default function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [resources, setResources] = useState<LessonResource[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showQuizPrompt, setShowQuizPrompt] = useState(false);

  // --------------------------------------------------
  // LOAD COURSE + LESSON + RESOURCES + PROGRESS
  // --------------------------------------------------
  const loadData = useCallback(async () => {
    if (!lessonId) {
      setError("Missing lesson id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;

      // lesson
      const { data: lessonRow, error: lessonError } = await supabase
        .from("lessons")
        .select("id, title, module_id, content") // <-- include content
        .eq("id", lessonId)
        .maybeSingle();
      if (lessonError) throw lessonError;
      if (!lessonRow) {
        setLesson(null);
        setError("Lesson not found.");
        return;
      }
      const lessonTyped = lessonRow as Lesson;
      setLesson(lessonTyped);

      // module -> course
      const { data: moduleRow, error: moduleError } = await supabase
        .from("modules")
        .select("course_id")
        .eq("id", lessonTyped.module_id)
        .maybeSingle();
      if (moduleError) throw moduleError;

      if (moduleRow?.course_id) {
        const { data: courseRow, error: courseError } = await supabase
          .from("courses")
          .select("id, title, description, audience")
          .eq("id", moduleRow.course_id)
          .maybeSingle();
        if (courseError) throw courseError;
        if (courseRow) setCourse(courseRow as Course);
      }

      // resources for this lesson
      const { data: resourceRows, error: resourceError } = await supabase
        .from("lesson_resources")
        .select("id, lesson_id, title, resource_type, storage_path")
        .eq("lesson_id", lessonId);
      if (resourceError) throw resourceError;

      const resList = (resourceRows || []) as LessonResource[];
      console.log("Resources loaded for lesson", lessonId, resList);
      setResources(resList);

      // progress
      if (user) {
        const { data: lpRows, error: lpError } = await supabase
          .from("lesson_progress")
          .select("lesson_id")
          .eq("user_id", user.id)
          .eq("lesson_id", lessonId);
        if (lpError) throw lpError;
        setIsCompleted((lpRows || []).length > 0);
      } else {
        setIsCompleted(false);
      }
    } catch (e: any) {
      console.error("Error loading lesson:", e);
      setError(e.message ?? "Failed to load lesson.");
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --------------------------------------------------
  // LOAD SIGNED VIDEO URL WHEN RESOURCES CHANGE
  // --------------------------------------------------
  useEffect(() => {
    const loadVideo = async () => {
      if (!resources.length) {
        setVideoUrl(null);
        return;
      }

      const videoRes = resources.find(
        (r) => r.resource_type === "video" && r.storage_path
      );
      if (!videoRes || !videoRes.storage_path) {
        setVideoUrl(null);
        return;
      }

      const cleanPath = videoRes.storage_path.trim().replace(/^\/+/, "");
      console.log("Using storage path for video:", cleanPath);

      const { data, error } = await supabase.storage
        .from("course-videos")
        .createSignedUrl(cleanPath, 60 * 60); // 1 hour

      if (error) {
        console.error("Signed URL error:", error);
        setError(`Error loading video: ${error.message}`);
        setVideoUrl(null);
        return;
      }

      console.log("SIGNED URL:", data.signedUrl);
      setError(null);
      setVideoUrl(data.signedUrl);
    };

    loadVideo();
  }, [resources]);

  // --------------------------------------------------
  // HANDLERS
  // --------------------------------------------------
  const handleVideoEnded = () => {
    setShowQuizPrompt(true);
  };

  const handleGoToQuiz = () => {
    if (!lessonId) return;
    router.push(`/lessons/${lessonId}/quiz`);
  };

  const handleClosePrompt = () => {
    setShowQuizPrompt(false);
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------
  if (loading) {
    return (
      <div className="dashboard-root">
        <aside className="sidebar" />
        <main className="main" style={{ display: "flex", alignItems: "center" }}>
          <p>Loading lesson...</p>
        </main>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="dashboard-root">
        <aside className="sidebar" />
        <main className="main">
          <p>Lesson not found.</p>
          {error && (
            <p style={{ marginTop: 8, fontSize: "0.8rem", color: "#b91c1c" }}>
              {error}
            </p>
          )}
        </main>
      </div>
    );
  }

  const courseTitle = course?.title ?? "Course";

  return (
    <div className="dashboard-root">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-profile">
          <div>
            <div className="profile-name">{courseTitle}</div>
            <div className="profile-email">
              {course?.audience === "internal"
                ? "Internal course"
                : course?.audience === "external"
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
          <button className="nav-item" onClick={() => router.push("/courses")}>
            All courses
          </button>
        </nav>
      </aside>

      {/* MAIN */}
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">{lesson.title}</div>
            <div className="topbar-subtitle">
              Watch the lesson and review any additional resources below.
            </div>
          </div>
          {isCompleted && (
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#047835",
              }}
            >
              ✓ Completed
            </div>
          )}
        </div>

        <section className="block" style={{ position: "relative" }}>
          {/* VIDEO */}
          {videoUrl ? (
            <div style={{ marginBottom: "16px" }}>
              <video
                src={videoUrl || undefined}
                controls
                preload="metadata"
                playsInline
                onEnded={handleVideoEnded}
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

          {/* LESSON TEXT CONTENT */}
          {lesson.content && (
            <div style={{ marginTop: 24 }}>
              <h3
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                Lesson notes
              </h3>
              <p
                style={{
                  fontSize: "0.85rem",
                  lineHeight: 1.5,
                  color: "#555",
                  whiteSpace: "pre-wrap",
                }}
              >
                {lesson.content}
              </p>
            </div>
          )}

          {/* Additional resources (non-video) */}
          {resources.some(
            (r) => !r.storage_path || r.resource_type !== "video"
          ) && (
            <div style={{ marginTop: "20px" }}>
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
                {resources
                  .filter((r) => !r.storage_path || r.resource_type !== "video")
                  .map((r) => (
                    <li key={r.id}>• {r.title}</li>
                  ))}
              </ul>
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: "16px",
                fontSize: "0.75rem",
                color: "#b91c1c",
              }}
            >
              {error}
            </div>
          )}

          {/* QUIZ PROMPT POPUP */}
          {showQuizPrompt && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.45))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "16px",
              }}
            >
              <div
                style={{
                  backgroundColor: "#ffffff",
                  padding: "20px 24px",
                  borderRadius: "16px",
                  maxWidth: "360px",
                  width: "100%",
                  boxShadow:
                    "0 18px 40px rgba(15, 23, 42, 0.35)",
                }}
              >
                <h3
                  style={{
                    fontSize: "1rem",
                    fontWeight: 600,
                    marginBottom: 8,
                  }}
                >
                  Ready to take the quiz?
                </h3>
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "#4b5563",
                    marginBottom: 16,
                  }}
                >
                  You&apos;ve reached the end of this lesson video. Test your
                  knowledge now or review the lesson again.
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={handleClosePrompt}
                    style={{
                      fontSize: "0.85rem",
                      padding: "8px 14px",
                      borderRadius: "999px",
                      border: "1px solid #d1d5db",
                      backgroundColor: "#ffffff",
                      cursor: "pointer",
                    }}
                  >
                    Return to lesson
                  </button>
                  <button
                    onClick={handleGoToQuiz}
                    style={{
                      fontSize: "0.85rem",
                      padding: "8px 14px",
                      borderRadius: "999px",
                      border: "none",
                      backgroundColor: "#047835", // Anchor green
                      color: "#ffffff",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Take the quiz
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
