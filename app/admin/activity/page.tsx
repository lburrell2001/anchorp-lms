"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AdminSidebar from "../../components/AdminSidebar";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: "internal" | "external" | null;
  role: string | null;
};

type ActivityPoint = {
  iso: string;
  label: string;
  completions: number;
  enrollments: number;
};

type ActivityMetrics = {
  totalCompletions7d: number;
  totalEnrollments7d: number;
  activeLearners30d: number;
};

export default function AdminActivityPage() {
  const router = useRouter();

  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [activity, setActivity] = useState<ActivityPoint[]>([]);
  const [metrics, setMetrics] = useState<ActivityMetrics>({
    totalCompletions7d: 0,
    totalEnrollments7d: 0,
    activeLearners30d: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ MOBILE SIDEBAR STATE
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ---------- AUTH / ADMIN CHECK ----------
  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    setError(null);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error(sessionError);
      setError("Could not verify your session.");
      setLoadingProfile(false);
      return;
    }

    if (!session?.user) {
      setLoadingProfile(false);
      router.replace("/login");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, user_type, role")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
      console.error(error);
      setError("Could not load your profile.");
      setLoadingProfile(false);
      return;
    }

    if (data.role !== "admin") {
      setLoadingProfile(false);
      router.replace("/dashboard");
      return;
    }

    setAdminProfile(data as Profile);
    setLoadingProfile(false);
  }, [router]);

  // ---------- ACTIVITY / METRICS ----------
  const loadActivity = useCallback(async () => {
    if (!adminProfile?.id) return;

    setLoadingStats(true);
    setError(null);

    try {
      const now = new Date();

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 6);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);

      const sevenIso = sevenDaysAgo.toISOString();
      const thirtyIso = thirtyDaysAgo.toISOString();

      const [
        { data: completionRows, error: completionError },
        { data: enrollmentRows, error: enrollmentError },
        { data: activeRows, error: activeError },
      ] = await Promise.all([
        supabase
          .from("lesson_progress")
          .select("user_id, completed_at, status")
          .gte("completed_at", sevenIso),
        supabase
          .from("course_enrollments")
          .select("user_id, created_at")
          .gte("created_at", sevenIso),
        supabase
          .from("lesson_progress")
          .select("user_id, completed_at")
          .gte("completed_at", thirtyIso),
      ]);

      if (completionError) console.warn("lesson_progress query failed:", completionError);
      if (enrollmentError) console.warn("course_enrollments query failed:", enrollmentError);
      if (activeError) console.warn("active learners query failed:", activeError);

      const completions = completionRows || [];
      const enrollments = enrollmentRows || [];
      const active = activeRows || [];

      const buckets: Record<string, { completions: number; enrollments: number }> = {};
      const days: ActivityPoint[] = [];

      for (let i = 0; i < 7; i++) {
        const d = new Date(sevenDaysAgo);
        d.setDate(sevenDaysAgo.getDate() + i);

        const iso = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

        buckets[iso] = { completions: 0, enrollments: 0 };
        days.push({ iso, label, completions: 0, enrollments: 0 });
      }

      completions.forEach((row: any) => {
        if (!row.completed_at) return;
        if (row.status && row.status !== "completed") return;
        const isoDate = String(row.completed_at).slice(0, 10);
        if (!buckets[isoDate]) return;
        buckets[isoDate].completions += 1;
      });

      enrollments.forEach((row: any) => {
        if (!row.created_at) return;
        const isoDate = String(row.created_at).slice(0, 10);
        if (!buckets[isoDate]) return;
        buckets[isoDate].enrollments += 1;
      });

      const activityPoints = days.map((d) => ({
        ...d,
        completions: buckets[d.iso].completions,
        enrollments: buckets[d.iso].enrollments,
      }));

      setActivity(activityPoints);
      setMetrics({
        totalCompletions7d: completions.length,
        totalEnrollments7d: enrollments.length,
        activeLearners30d: new Set(active.map((r: any) => r.user_id)).size,
      });
    } catch (err) {
      console.error("Unexpected error loading activity stats:", err);
      setError("Failed to load activity data.");
      setActivity([]);
      setMetrics({ totalCompletions7d: 0, totalEnrollments7d: 0, activeLearners30d: 0 });
    } finally {
      setLoadingStats(false);
    }
  }, [adminProfile]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (adminProfile?.role === "admin") loadActivity();
  }, [adminProfile, loadActivity]);

  if (loadingProfile) {
    return <div style={{ padding: 24 }}>Loading activity &amp; progress…</div>;
  }

  if (!adminProfile) return null;

  return (
    <div className="dashboard-root admin-root">
      {/* ✅ Sidebar (mobile dropdown capable) */}
      <AdminSidebar
        active="activity"
        fullName={adminProfile.full_name}
        email={adminProfile.email}
        isOpen={sidebarOpen}
        onNavClick={() => setSidebarOpen(false)}
      />

      {/* ✅ Overlay (tap to close) */}
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        />
      )}

      <div className="main">
        <div className="topbar">
          {/* ✅ Hamburger (mobile only via CSS) */}
          <button
            type="button"
            className="mobile-menu-button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>

          <div>
            <div className="topbar-title">Activity &amp; Progress</div>
            <div className="topbar-subtitle">
              Deeper look at completions, enrollments, and active learners over time.
            </div>
          </div>
        </div>

        <div className="content-grid">
          <div className="column-main">
            <div className="block">
              <div className="block-header">
                <div className="block-title">Activity Timeline (7 days)</div>
              </div>

              <p className="small-block-text">
                Pulled from <code>lesson_progress</code> and <code>course_enrollments</code>.
              </p>

              {error && (
                <p style={{ marginBottom: 8, fontSize: 12, color: "#b91c1c" }}>
                  {error}
                </p>
              )}

              {loadingStats ? (
                <p className="small-block-text">Loading activity…</p>
              ) : activity.length === 0 ? (
                <p className="small-block-text">
                  No completions or enrollments in the last 7 days.
                </p>
              ) : (
                <div className="course-list">
                  {activity.map((day) => (
                    <div className="course-card" key={day.iso}>
                      <div className="course-card-main">
                        <div className="course-title">{day.label}</div>
                        <div className="course-meta">
                          {day.completions} completion{day.completions === 1 ? "" : "s"} •{" "}
                          {day.enrollments} enrollment{day.enrollments === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {day.iso}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="column-side">
            <div className="block">
              <div className="block-header">
                <div className="block-title">Key Metrics</div>
              </div>

              <div className="stats-row" style={{ marginTop: 10 }}>
                <div className="stat-card">
                  <div className="stat-label">Completions (7 days)</div>
                  <div className="stat-value">{metrics.totalCompletions7d}</div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Enrollments (7 days)</div>
                  <div className="stat-value">{metrics.totalEnrollments7d}</div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Active Learners (30 days)</div>
                  <div className="stat-value">{metrics.activeLearners30d}</div>
                  <div className="small-block-text">
                    Unique users with at least one completion.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div> 
    </div>
  );
}
