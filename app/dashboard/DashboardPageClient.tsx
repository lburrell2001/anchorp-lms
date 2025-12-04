"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

type Course = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
};

type LessonWithCourse = {
  lesson_id: string;
  course_id: string;
};

type CourseWithProgress = Course & {
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
};

export default function DashboardPageClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError(null);

      // 1) get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUser(user);

      // 2) get courses
      const { data: courseRows, error: courseError } = await supabase
        .from("courses")
        .select("id, title, slug, description");

      if (courseError) {
        setError(courseError.message);
        setLoading(false);
        return;
      }

      // 3) lessons → course
      const { data: lessonRows, error: lessonError } = await supabase
        .from("lessons")
        .select("id, module:modules!inner(course_id)");

      if (lessonError) {
        setError(lessonError.message);
        setLoading(false);
        return;
      }

      const lessonsWithCourse: LessonWithCourse[] =
        (lessonRows as any[])?.map((row) => ({
          lesson_id: row.id,
          course_id: row.module.course_id,
        })) ?? [];

      // 4) completed lessons for this user
      const { data: progressRows, error: progressError } = await supabase
        .from("lesson_progress")
        .select("lesson_id, status")
        .eq("user_id", user.id)
        .eq("status", "completed");

      if (progressError) {
        setError(progressError.message);
        setLoading(false);
        return;
      }

      const completedLessonIds = new Set(
        (progressRows ?? []).map((p) => p.lesson_id as string)
      );

      const lessonsByCourse: Record<
        string,
        { total: number; completed: number }
      > = {};

      for (const l of lessonsWithCourse) {
        if (!lessonsByCourse[l.course_id]) {
          lessonsByCourse[l.course_id] = { total: 0, completed: 0 };
        }
        lessonsByCourse[l.course_id].total += 1;
        if (completedLessonIds.has(l.lesson_id)) {
          lessonsByCourse[l.course_id].completed += 1;
        }
      }

      const coursesWithProgress: CourseWithProgress[] =
        (courseRows ?? []).map((c: any) => {
          const stats = lessonsByCourse[c.id] ?? {
            total: 0,
            completed: 0,
          };
          const progressPercent =
            stats.total === 0
              ? 0
              : Math.round((stats.completed / stats.total) * 100);

          return {
            id: c.id,
            title: c.title,
            slug: c.slug,
            description: c.description,
            totalLessons: stats.total,
            completedLessons: stats.completed,
            progressPercent,
          };
        });

      setCourses(coursesWithProgress);
      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <main style={{ padding: 40 }}>
        <h1>AnchorP LMS</h1>
        <p>Loading your dashboard…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 40 }}>
        <h1>AnchorP LMS</h1>
        <p style={{ color: "red" }}>Error: {error}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 40, maxWidth: 960 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h1>AnchorP LMS Dashboard</h1>
          {user && (
            <p style={{ color: "#aaa", fontSize: 14 }}>
              Logged in as {user.email}
            </p>
          )}
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #333",
            background: "transparent",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Log out
        </button>
      </header>

      {/* courses list (same as before) */}
      {courses.length === 0 ? (
        <p>No courses available yet.</p>
      ) : (
        <section style={{ display: "grid", gap: 20 }}>
          {courses.map((course) => (
            <div
              key={course.id}
              style={{
                borderRadius: 12,
                padding: 20,
                border: "1px solid #333",
                background: "#111",
              }}
            >
              <h2 style={{ marginBottom: 4 }}>{course.title}</h2>
              <p style={{ color: "#aaa", marginBottom: 12 }}>
                {course.description || "No description yet."}
              </p>

              <div style={{ marginBottom: 8, fontSize: 14 }}>
                <span>
                  Lessons:{" "}
                  <strong>
                    {course.completedLessons}/{course.totalLessons}
                  </strong>
                </span>
                <span style={{ marginLeft: 12 }}>
                  Progress:{" "}
                  <strong>{course.progressPercent.toString()}%</strong>
                </span>
              </div>

              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: "#222",
                  overflow: "hidden",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${course.progressPercent}%`,
                    background:
                      course.progressPercent === 100 ? "#4dff98" : "#7c5cff",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>

              <Link
                href={`/courses/${course.slug}`}
                style={{
                  display: "inline-block",
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: "#4dff98",
                  color: "#000",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {course.progressPercent === 0 ? "Start Course" : "Continue"}
              </Link>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
