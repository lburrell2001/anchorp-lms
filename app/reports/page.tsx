"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import AppSidebar from "../components/AppSidebar"; // ⬅️ shared sidebar

type Course = {
  id: string;
  title: string;
  slug: string;
};

type EnrollmentRow = {
  course_id: string;
};

type QuizAttempt = {
  quiz_id: string;
  score: number | null;
  passed: boolean | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: "internal" | "external" | "both" | null;
};

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Basic access check (must be signed in)
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("You must be signed in to view reports.");

      // ---------- PROFILE FOR SIDEBAR ----------
      const { data: existingProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, user_type")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      let profileRow = existingProfile as Profile | null;

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
      }

      setProfile(profileRow);

      // ---------- ORIGINAL REPORTS QUERIES (UNCHANGED) ----------

      // Courses
      const { data: courseRows, error: courseError } = await supabase
        .from("courses")
        .select("id, title, slug")
        .order("title", { ascending: true });

      if (courseError) throw courseError;
      setCourses((courseRows || []) as Course[]);

      // Enrollments
      const { data: enrollmentRows, error: enrollmentError } = await supabase
        .from("course_enrollments")
        .select("course_id");

      if (enrollmentError) throw enrollmentError;
      setEnrollments((enrollmentRows || []) as EnrollmentRow[]);

      // Quiz attempts
      const { data: attemptRows, error: attemptsError } = await supabase
        .from("quiz_attempts")
        .select("quiz_id, score, passed");

      if (attemptsError) throw attemptsError;
      setAttempts((attemptRows || []) as QuizAttempt[]);
    } catch (e: any) {
      console.error("Error loading reports:", e);
      setError(e.message ?? "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- derived stats ---
  const totalCourses = courses.length;
  const totalEnrollments = enrollments.length;

  const totalAttempts = attempts.length;
  const totalPassed = attempts.filter((a) => a.passed).length;
  const passRate =
    totalAttempts === 0
      ? 0
      : Math.round((totalPassed / totalAttempts) * 100);

  // Enrollment count per course
  const enrollCountByCourse = courses.map((c) => {
    const count = enrollments.filter((e) => e.course_id === c.id).length;
    return { ...c, enrollmentCount: count };
  });

  const fullName = profile?.full_name ?? null;
  const email = profile?.email ?? null;

  return (
    <div className="dashboard-root">
      {/* SHARED SIDEBAR WITH REAL USER INFO */}
      <AppSidebar active="reports" fullName={fullName} email={email} />

      {/* MAIN */}
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">Reports</div>
            <div className="topbar-subtitle">
              Review overall usage and quiz performance.
            </div>
          </div>
        </div>

        <section className="block">
          {loading && <p>Loading reports...</p>}

          {error && (
            <p
              style={{ marginBottom: 12, fontSize: "0.8rem", color: "#b91c1c" }}
            >
              {error}
            </p>
          )}

          {!loading && !error && (
            <>
              {/* Summary cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <div className="small-metric-card">
                  <div className="small-metric-label">Total courses</div>
                  <div className="small-metric-value">{totalCourses}</div>
                </div>

                <div className="small-metric-card">
                  <div className="small-metric-label">Total enrollments</div>
                  <div className="small-metric-value">{totalEnrollments}</div>
                </div>

                <div className="small-metric-card">
                  <div className="small-metric-label">Quiz attempts</div>
                  <div className="small-metric-value">{totalAttempts}</div>
                </div>

                <div className="small-metric-card">
                  <div className="small-metric-label">Quiz pass rate</div>
                  <div className="small-metric-value">{passRate}%</div>
                </div>
              </div>

              {/* Per-course enrollments */}
              <div
                style={{
                  marginTop: 8,
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                Enrollment by course
              </div>
              <p className="small-block-text" style={{ marginBottom: 8 }}>
                Quick snapshot of how many learners are in each course.
              </p>

              {enrollCountByCourse.length === 0 ? (
                <p className="small-block-text">
                  No courses or enrollments yet.
                </p>
              ) : (
                <div style={{ marginTop: 8 }}>
                  {enrollCountByCourse.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        padding: "10px 0",
                        borderBottom: "1px solid #e5e7eb",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.9rem",
                          color: "#111827",
                          fontWeight: 500,
                        }}
                      >
                        {c.title}
                      </div>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "#4b5563",
                        }}
                      >
                        {c.enrollmentCount} enrollment
                        {c.enrollmentCount === 1 ? "" : "s"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
