"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AppSidebar from "../../components/AppSidebar"; // <-- shared sidebar

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
  content?: string | null;
};

type LessonResource = {
  id: string;
  lesson_id: string;
  title: string;
  resource_type: string;
  storage_path: string | null;
};

type Profile = {
  full_name: string | null;
  email: string | null;
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

  // sidebar profile info
  const [profile, setProfile] = useState<Profile | null>(null);

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

      // Fetch profile for sidebar
      if (user) {
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", user.id)
          .maybeSingle();

        setProfile({
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,
        });
      }

      // Load lesson
      const { data: lessonRow } = await supabase
        .from("lessons")
        .select("id, title, module_id, content")
        .eq("id", lessonId)
        .maybeSingle();

      if (!lessonRow) {
        setError("Lesson not found.");
        setLoading(false);
        return;
      }

      setLesson(lessonRow as Lesson);

      // module → course
      const { data: moduleRow } = await supabase
        .from("modules")
        .select("course_id")
        .eq("id", lessonRow.module_id)
        .maybeSingle();

      if (moduleRow?.course_id) {
        const { data: courseRow } = await supabase
          .from("courses")
          .select("id, title, description, audience")
          .eq("id", moduleRow.course_id)
          .maybeSingle();

        setCourse(courseRow as Course);
      }

      // lesson resources
      const { data: resourceRows } = await supabase
        .from("lesson_resources")
        .select("id, lesson_id, title, resource_type, storage_path")
        .eq("lesson_id", lessonId);

      setResources((resourceRows || []) as LessonResource[]);

      // Progress
      if (user) {
        const { data: lp } = await supabase
          .from("lesson_progress")
          .select("lesson_id")
          .eq("user_id", user.id)
          .eq("lesson_id", lessonId);

        setIsCompleted((lp || []).length > 0);
      }
    } catch (e: any) {
      setError(e.message ?? "Failed to load lesson.");
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load signed video URL
  useEffect(() => {
    const loadVideo = async () => {
      const videoRes = resources.find(
        (r) => r.resource_type === "video" && r.storage_path
      );

      if (!videoRes?.storage_path) {
        setVideoUrl(null);
        return;
      }

      const cleanPath = videoRes.storage_path.trim().replace(/^\/+/, "");

      const { data, error } = await supabase.storage
        .from("course-videos")
        .createSignedUrl(cleanPath, 3600);

      if (error) {
        setError(error.message);
      } else {
        setVideoUrl(data.signedUrl);
      }
    };

    loadVideo();
  }, [resources]);

  const handleVideoEnded = () => setShowQuizPrompt(true);
  const handleGoToQuiz = () => router.push(`/lessons/${lessonId}/quiz`);
  const handleClosePrompt = () => setShowQuizPrompt(false);

  if (loading) {
    return (
      <div className="dashboard-root">
        <AppSidebar active="lessons" fullName={profile?.full_name} email={profile?.email} />
        <main className="main">
          <p>Loading lesson…</p>
        </main>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="dashboard-root">
        <AppSidebar active="lessons" fullName={profile?.full_name} email={profile?.email} />
        <main className="main">
          <p>Lesson not found.</p>
          {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-root">
      {/* ✅ SHARED SIDEBAR — replaced old sidebar completely */}
      <AppSidebar active="lessons" fullName={profile?.full_name} email={profile?.email} />

      {/* MAIN */}
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">{lesson.title}</div>
            <div className="topbar-subtitle">
              Watch the lesson and review additional resources.
            </div>
          </div>

          {isCompleted && (
            <div style={{ fontSize: "0.8rem", color: "#047835", fontWeight: 600 }}>
              ✓ Completed
            </div>
          )}
        </div>

        <section className="block" style={{ position: "relative" }}>
          {/* VIDEO */}
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              playsInline
              onEnded={handleVideoEnded}
              style={{
                width: "100%",
                borderRadius: "12px",
                maxHeight: "480px",
                backgroundColor: "#000",
                marginBottom: "16px",
              }}
            />
          ) : (
            <p className="small-block-text">No video attached.</p>
          )}

          {/* LESSON CONTENT */}
          {lesson.content && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 600 }}>Lesson notes</h3>
              <p
                style={{
                  marginTop: 6,
                  fontSize: "0.85rem",
                  color: "#555",
                  whiteSpace: "pre-wrap",
                }}
              >
                {lesson.content}
              </p>
            </div>
          )}

          {/* EXTRA RESOURCES */}
          {resources.some((r) => r.resource_type !== "video") && (
            <div style={{ marginTop: "20px" }}>
              <div style={{ fontWeight: 600, fontSize: "0.8rem" }}>
                Additional resources
              </div>
              <ul style={{ fontSize: "0.8rem", color: "#76777b" }}>
                {resources
                  .filter((r) => r.resource_type !== "video")
                  .map((r) => (
                    <li key={r.id}>• {r.title}</li>
                  ))}
              </ul>
            </div>
          )}

          {/* QUIZ PROMPT */}
          {showQuizPrompt && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.35)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                borderRadius: "16px",
              }}
            >
              <div
                style={{
                  background: "#fff",
                  padding: "20px 24px",
                  borderRadius: "16px",
                  width: "100%",
                  maxWidth: "360px",
                }}
              >
                <h3 style={{ marginBottom: 8, fontWeight: 600, fontSize: "1rem" }}>
                  Ready to take the quiz?
                </h3>
                <p style={{ fontSize: "0.85rem", color: "#4b5563", marginBottom: 16 }}>
                  You've finished the lesson video. Test your knowledge or continue reviewing.
                </p>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    onClick={handleClosePrompt}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "999px",
                      border: "1px solid #d1d5db",
                      background: "#fff",
                    }}
                  >
                    Return
                  </button>
                  <button
                    onClick={handleGoToQuiz}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "999px",
                      background: "#047835",
                      color: "#fff",
                      border: "none",
                      fontWeight: 600,
                    }}
                  >
                    Take quiz
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
