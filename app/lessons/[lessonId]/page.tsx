"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AppSidebar from "../../components/AppSidebar";

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
  const params = useParams();
  const router = useRouter();

  // ✅ normalize lessonId safely
  const lessonIdParam = (params as any)?.lessonId;
  const lessonId =
    Array.isArray(lessonIdParam) ? lessonIdParam[0] : lessonIdParam;

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [resources, setResources] = useState<LessonResource[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuizPrompt, setShowQuizPrompt] = useState(false);

  // ✅ mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      if (!user) {
        router.replace("/login");
        return;
      }

      // Fetch profile for sidebar
      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle();

      if (pErr) console.warn("profile query failed:", pErr);

      setProfile({
        full_name: p?.full_name ?? null,
        email: p?.email ?? null,
      });

      // Load lesson
      const { data: lessonRow, error: lessonErr } = await supabase
        .from("lessons")
        .select("id, title, module_id, content")
        .eq("id", lessonId)
        .maybeSingle();

      if (lessonErr) throw lessonErr;

      if (!lessonRow) {
        setError("Lesson not found.");
        setLesson(null);
        return;
      }

      setLesson(lessonRow as Lesson);

      // module → course
      const { data: moduleRow, error: moduleErr } = await supabase
        .from("modules")
        .select("course_id")
        .eq("id", lessonRow.module_id)
        .maybeSingle();

      if (moduleErr) console.warn("module query failed:", moduleErr);

      if (moduleRow?.course_id) {
        const { data: courseRow, error: courseErr } = await supabase
          .from("courses")
          .select("id, title, description, audience")
          .eq("id", moduleRow.course_id)
          .maybeSingle();

        if (courseErr) console.warn("course query failed:", courseErr);
        setCourse((courseRow || null) as Course | null);
      } else {
        setCourse(null);
      }

      // lesson resources
      const { data: resourceRows, error: resErr } = await supabase
        .from("lesson_resources")
        .select("id, lesson_id, title, resource_type, storage_path")
        .eq("lesson_id", lessonId);

      if (resErr) console.warn("lesson_resources query failed:", resErr);

      setResources((resourceRows || []) as LessonResource[]);

      // Progress
      const { data: lp, error: lpErr } = await supabase
        .from("lesson_progress")
        .select("lesson_id")
        .eq("user_id", user.id)
        .eq("lesson_id", lessonId);

      if (lpErr) console.warn("lesson_progress query failed:", lpErr);

      setIsCompleted((lp || []).length > 0);
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Failed to load lesson.");
    } finally {
      setLoading(false);
    }
  }, [lessonId, router]);

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
        console.error(error);
        setVideoUrl(null);
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

  // ✅ pick a valid sidebar key
  const sidebarActive: any = "my-courses"; // or "dashboard" — must be one of your union keys

  return (
    <div className="dashboard-root">
      {/* ✅ Sidebar (mobile dropdown enabled) */}
      <AppSidebar
        active={sidebarActive}
        fullName={profile?.full_name ?? null}
        email={profile?.email ?? null}
        isOpen={sidebarOpen}
        onNavClick={() => setSidebarOpen(false)}
      />

      {/* ✅ Overlay */}
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        />
      )}

      <main className="main">
        <div className="topbar">
          {/* ✅ Hamburger */}
          <button
            type="button"
            className="mobile-menu-button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>

          <div>
            <div className="topbar-title">
              {loading ? "Loading lesson…" : lesson?.title ?? "Lesson"}
            </div>
            <div className="topbar-subtitle">
              Watch the lesson and review additional resources.
            </div>
          </div>

          {!loading && isCompleted && (
            <div style={{ fontSize: "0.8rem", color: "#047835", fontWeight: 600 }}>
              ✓ Completed
            </div>
          )}
        </div>

        {error && (
          <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "#b91c1c" }}>
            {error}
          </p>
        )}

        {!loading && !lesson ? (
          <section className="block">
            <p>Lesson not found.</p>
          </section>
        ) : (
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
              !loading && <p className="small-block-text">No video attached.</p>
            )}

            {/* LESSON CONTENT */}
            {!!lesson?.content && (
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
        )}
      </main>
    </div>
  );
}
