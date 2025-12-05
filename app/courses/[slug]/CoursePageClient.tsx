"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient"; // same style as other pages

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

export default function CoursePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [resourcesByLesson, setResourcesByLesson] = useState<
    Record<string, LessonResource[]>
  >({});
  const [progressByLesson, setProgressByLesson] = useState<
    Record<string, boolean>
  >({});
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [markingComplete, setMarkingComplete] = useState(false);

  // --------------------------------------------------
  // LOAD COURSE + LESSON DATA
  // --------------------------------------------------
  const loadCourse = useCallback(async () => {
    setLoading(true);
    setError(null);

    // 1) current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      setError(userError.message);
      setLoading(false);
      return;
    }

    // 2) course by slug
    const { data: courseRow, error: courseError } = await supabase
      .from("courses")
      .select("id, title, description, audience")
      .eq("slug", slug)
      .maybeSingle();

    if (courseError) {
      setError(courseError.message);
      setLoading(false);
      return;
    }
    if (!courseRow) {
      setError("Course not found.");
      setLoading(false);
      return;
    }
    const courseId = courseRow.id as string;
    setCourse(courseRow as Course);

    // 3) modules for this course
    const { data: modules, error: moduleError } = await supabase
      .from("modules")
      .select("id")
      .eq("course_id", courseId);

    if (moduleError) {
      setError(moduleError.message);
      setLoading(false);
      return;
    }

    const moduleIds = (modules || []).map((m: any) => m.id as string);
    if (moduleIds.length === 0) {
      setLessons([]);
      setResourcesByLesson({});
      setProgressByLesson({});
      setActiveLessonId(null);
      setVideoUrl(null);
      setLoading(false);
      return;
    }

    // 4) lessons for those modules
    const { data: lessonRows, error: lessonError } = await supabase
      .from("lessons")
      .select("id, title, module_id")
      .in("module_id", moduleIds)
      .order("id");

    if (lessonError) {
      setError(lessonError.message);
      setLoading(false);
      return;
    }

    const lessonList = (lessonRows || []) as Lesson[];
    setLessons(lessonList);

    if (lessonList.length === 0) {
      setResourcesByLesson({});
      setProgressByLesson({});
      setActiveLessonId(null);
      setVideoUrl(null);
      setLoading(false);
      return;
    }

    const lessonIds = lessonList.map((l) => l.id);

    // 5) resources for those lessons
    const { data: resourceRows, error: resourceError } = await supabase
      .from("lesson_resources")
      .select("id, lesson_id, title, resource_type, storage_path")
      .in("lesson_id", lessonIds);

    if (resourceError) {
      setError(resourceError.message);
      setLoading(false);
      return;
    }

    const resourcesMap: Record<string, LessonResource[]> = {};
    (resourceRows || []).forEach((r: any) => {
      const lr = r as LessonResource;
      if (!resourcesMap[lr.lesson_id]) {
        resourcesMap[lr.lesson_id] = [];
      }
      resourcesMap[lr.lesson_id].push(lr);
    });
    setResourcesByLesson(resourcesMap);

    // 6) lesson progress for this user
    if (user) {
      const { data: lpRows, error: lpError } = await supabase
  .from("lesson_progress")
  .select("lesson_id, completed_at")
  .eq("user_id", user.id)
  .in("lesson_id", lessonIds);

      if (lpError) {
        setError(lpError.message);
        setLoading(false);
        return;
      }

      const progMap: Record<string, boolean> = {};
(lpRows || []).forEach((row: any) => {
  const lp = row as LessonProgressRow;
  progMap[lp.lesson_id] = !!lp.completed_at;
});
setProgressByLesson(progMap);

    } else {
      setProgressByLesson({});
    }

    // 7) set active lesson (first lesson)
    setActiveLessonId(lessonList[0].id);

    setLoading(false);
  }, [slug]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  // --------------------------------------------------
  // LOAD SIGNED VIDEO URL WHEN ACTIVE LESSON CHANGES
  // --------------------------------------------------
  useEffect(() => {
    const loadVideo = async () => {
      if (!activeLessonId) {
        setVideoUrl(null);
        return;
      }

      const resources = resourcesByLesson[activeLessonId] || [];
      const videoRes = resources.find(
        (r) => r.resource_type === "video" && r.storage_path
      );

      if (!videoRes || !videoRes.storage_path) {
        setVideoUrl(null);
        return;
      }

      const { data, error } = await supabase.storage
        .from("course-videos") // your bucket name
        .createSignedUrl(videoRes.storage_path, 3600);

      if (error) {
        console.error(error);
        setVideoUrl(null);
        return;
      }

      setVideoUrl(data?.signedUrl ?? null);
    };

    loadVideo();
  }, [activeLessonId, resourcesByLesson]);

  // --------------------------------------------------
  // MARK LESSON COMPLETE
  // --------------------------------------------------
  const handleMarkComplete = async () => {
    if (!activeLessonId) return;

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
      // check existing progress row
      const { data: existing, error: existingError } = await supabase
  .from("lesson_progress")
  .select("id, completed_at")
  .eq("user_id", user.id)
  .eq("lesson_id", activeLessonId)
  .maybeSingle();


      if (existingError) throw existingError;

      setProgressByLesson((prev) => ({
        ...prev,
        [activeLessonId]: true,
      }));
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
        <div className="sidebar" />
        <div className="main" style={{ display: "flex", alignItems: "center" }}>
          <p>Loading course…</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="dashboard-root">
        <div className="sidebar" />
        <div className="main">
          <p>Course not found.</p>
        </div>
      </div>
    );
  }

  const activeLesson = lessons.find((l) => l.id === activeLessonId) || null;

  return (
    <div className="dashboard-root">
      {/* Reuse your sidebar layout, but simpler nav */}
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
          <button className="nav-item" onClick={() => router.push("/dashboard")}>
            ← Back to dashboard
          </button>
          <button className="nav-item" onClick={() => router.push("/courses")}>
            All courses
          </button>
        </nav>
      </aside>

      {/* MAIN COURSE AREA */}
      <main className="main">
        {/* Top bar */}
        <div className="topbar">
          <div>
            <div className="topbar-title">{course.title}</div>
            <div className="topbar-subtitle">
              Work through the lessons below and mark each one complete to
              track your progress.
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
          {/* LEFT: Lesson list */}
          <section className="block">
            <div className="block-header">
              <div className="block-title">Lessons</div>
            </div>

            {lessons.length === 0 ? (
              <p className="small-block-text">
                No lessons have been added for this course yet.
              </p>
            ) : (
              <div className="course-list">
                {lessons.map((lesson, index) => {
                  const isActive = lesson.id === activeLessonId;
                  const isDone = progressByLesson[lesson.id];

                  return (
                    <div
  key={lesson.id}
  className="course-card"
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderColor: isActive ? "#047835" : "#e5e7eb",
    background: isActive ? "#e8f9f0" : "#f9fafb",
  }}
>
  <button
    style={{ all: "unset", cursor: "pointer", flex: 1 }}
    onClick={() => setActiveLessonId(lesson.id)}
  >
    <div className="course-card-main">
      <div className="course-title">
        Lesson {index + 1}: {lesson.title}
      </div>
      <div className="course-meta">
        {isDone ? "Completed" : "Not completed"}
      </div>
    </div>
  </button>

  {/* ✅ New button that routes to dedicated lesson page */}
  <button
    className="btn-secondary"
    onClick={() =>
      router.push(`/courses/${slug}/lessons/${lesson.id}`)
    }
  >
    Open lesson
  </button>

  {isDone && (
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
        marginLeft: 8,
      }}
    >
      ✓
    </div>
  )}
</div>

                  );
                })}
              </div>
            )}
          </section>

          {/* RIGHT: Lesson content */}
          <section className="block">
            {activeLesson ? (
              <>
                <div className="block-header">
                  <div className="block-title">
                    {activeLesson.title}
                  </div>
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

                {/* Other resources */}
                {resourcesByLesson[activeLesson.id]?.some(
                  (r) => r.resource_type !== "video"
                ) && (
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
                      {resourcesByLesson[activeLesson.id]
                        .filter((r) => r.resource_type !== "video")
                        .map((r) => (
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
                    disabled={markingComplete}
                  >
                    {progressByLesson[activeLesson.id]
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
              </>
            ) : (
              <p className="small-block-text">
                Select a lesson from the list to begin.
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
