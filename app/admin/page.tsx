"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import AdminSidebar from "../components/AdminSidebar";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: "internal" | "external" | null;
  role: string | null;
};

type UserAnalytics = {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: "internal" | "external" | null;
  courses_enrolled: number;
  lessons_completed: number;
};

type RecentCompletion = {
  id: string;
  user_name: string;
  user_type: string | null;
  completed_at: string;
};

export default function AdminPage() {
  const router = useRouter();

  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // stats
  const [totalUsers, setTotalUsers] = useState(0);
  const [internalUsers, setInternalUsers] = useState(0);
  const [externalUsers, setExternalUsers] = useState(0);
  const [totalCourses, setTotalCourses] = useState(0);
  const [totalEnrollments, setTotalEnrollments] = useState(0);
  const [totalCompletions, setTotalCompletions] = useState(0);

  const [users, setUsers] = useState<UserAnalytics[]>([]);
  const [recentCompletions, setRecentCompletions] = useState<RecentCompletion[]>(
    []
  );
  const [userFilter, setUserFilter] = useState<"all" | "internal" | "external">(
    "all"
  );

  // ---------- AUTH / ADMIN CHECK ----------
  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
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
      router.replace("/dashboard");
      return;
    }

    setAdminProfile(data as Profile);
    setLoadingProfile(false);
  }, [router]);

  // ---------- ANALYTICS ----------
  const loadAnalytics = useCallback(async () => {
    setLoadingData(true);
    setError(null);

    try {
      // All counts EXCLUDE admin users
      const [
        { count: usersCount },
        { count: internalCount },
        { count: externalCount },
        { count: coursesCount },
        { count: enrollmentsCount },
        { count: completionsCount },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .neq("role", "admin"),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("user_type", "internal")
          .neq("role", "admin"),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("user_type", "external")
          .neq("role", "admin"),
        supabase.from("courses").select("*", { count: "exact", head: true }),
        supabase
          .from("course_enrollments")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("lesson_progress")
          .select("*", { count: "exact", head: true }),
      ]);

      setTotalUsers(usersCount || 0);
      setInternalUsers(internalCount || 0);
      setExternalUsers(externalCount || 0);
      setTotalCourses(coursesCount || 0);
      setTotalEnrollments(enrollmentsCount || 0);
      setTotalCompletions(completionsCount || 0);

      // Profiles for analytics, EXCLUDING admins
      const [{ data: profileRows }, { data: enrollments }, { data: lessonRows }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, email, user_type, role")
            .neq("role", "admin"),
          supabase.from("course_enrollments").select("user_id"),
          supabase
            .from("lesson_progress")
            .select("user_id, completed_at, id")
            .order("completed_at", { ascending: false })
            .limit(25),
        ]);

      if (!profileRows) {
        setUsers([]);
      } else {
        const enrollMap = new Map<string, number>();
        const completeMap = new Map<string, number>();

        (enrollments || []).forEach((e: any) => {
          enrollMap.set(e.user_id, (enrollMap.get(e.user_id) || 0) + 1);
        });

        (lessonRows || []).forEach((l: any) => {
          completeMap.set(l.user_id, (completeMap.get(l.user_id) || 0) + 1);
        });

        const userAnalytics: UserAnalytics[] = profileRows.map((u: any) => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          user_type: u.user_type,
          courses_enrolled: enrollMap.get(u.id) || 0,
          lessons_completed: completeMap.get(u.id) || 0,
        }));

        setUsers(userAnalytics);
      }

      // Recent completions – only for non-admin users
      if (lessonRows && profileRows) {
        const profileMap = new Map<string, Profile>();
        profileRows.forEach((p: any) => profileMap.set(p.id, p as Profile));

        const recent: RecentCompletion[] = (lessonRows as any[])
          .filter((l) => {
            const p = profileMap.get(l.user_id);
            return p && p.role !== "admin";
          })
          .map((l: any) => {
            const p = profileMap.get(l.user_id);
            return {
              id: l.id,
              user_name: p?.full_name || "Unknown user",
              user_type: p?.user_type || null,
              completed_at: l.completed_at,
            };
          });

        setRecentCompletions(recent);
      }
    } catch (err) {
      console.error(err);
      setError("Error loading admin analytics.");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (adminProfile?.role === "admin") {
      loadAnalytics();
    }
  }, [adminProfile, loadAnalytics]);

  // ---------- RENDER ----------

  if (loadingProfile) {
    return <div style={{ padding: 24 }}>Loading admin dashboard…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: "red", fontWeight: 500 }}>{error}</div>
    );
  }

  if (!adminProfile) return null;

  const filteredUsers =
    userFilter === "all"
      ? users
      : users.filter((u) => u.user_type === userFilter);

  const internalPercent =
    totalUsers === 0 ? 0 : Math.round((internalUsers / totalUsers) * 100);
  const externalPercent =
    totalUsers === 0 ? 0 : Math.round((externalUsers / totalUsers) * 100);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="dashboard-root">
      {/* ADMIN SIDEBAR */}
      <AdminSidebar
        active="overview"   
        fullName={adminProfile.full_name}
        email={adminProfile.email}
      />

      {/* MAIN CONTENT */}
      <div className="main">
        {/* TOPBAR */}
        <div className="topbar">
          <div>
            <div className="topbar-title">Admin Activity Dashboard</div>
            <div className="topbar-subtitle">
              Track internal &amp; external learners, course usage, and progress.
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12 }}>
            <div>{today}</div>
            <div>Logged in as {adminProfile.email}</div>
          </div>
        </div>

        {/* STATS STRIP */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total Users</div>
            <div className="stat-value">{totalUsers}</div>
            <div className="small-block-text">
              {internalUsers} internal • {externalUsers} external
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Courses Live</div>
            <div className="stat-value">{totalCourses}</div>
            <div className="small-block-text">
              {totalEnrollments} total enrollments
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Lesson Completions</div>
            <div className="stat-value">{totalCompletions}</div>
            <div className="small-block-text">
              All-time completions (excluding admin).
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">External Share</div>
            <div className="stat-value">{externalPercent}%</div>
            <div className="small-block-text">
              Of all users are potential customers.
            </div>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="content-grid">
          {/* LEFT – Recent activity */}
          <div className="column-main">
            <div className="block">
              <div className="block-header">
                <div className="block-title">Recent Learning Activity</div>
              </div>
              <p className="small-block-text">
                Last 25 lesson completions across internal and external users
                (admin excluded).
              </p>

              {recentCompletions.length === 0 ? (
                <p className="small-block-text">No recent completions yet.</p>
              ) : (
                <div className="course-list">
                  {recentCompletions.map((rc) => (
                    <div className="course-card" key={rc.id}>
                      <div className="course-card-main">
                        <div className="course-title">
                          {rc.user_name}
                          {rc.user_type && (
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: 10,
                                textTransform: "capitalize",
                                padding: "2px 8px",
                                borderRadius: 999,
                                background:
                                  rc.user_type === "internal"
                                    ? "#e0f2fe"
                                    : "#fef3c7",
                                color:
                                  rc.user_type === "internal"
                                    ? "#0369a1"
                                    : "#92400e",
                              }}
                            >
                              {rc.user_type}
                            </span>
                          )}
                        </div>
                        <div className="course-meta">Completed a lesson</div>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#6b7280",
                          minWidth: 140,
                          textAlign: "right",
                        }}
                      >
                        {new Date(rc.completed_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT – Internal vs external + user table */}
          <div className="column-side">
            {/* Internal vs external */}
            <div className="block">
              <div className="block-header">
                <div className="block-title">Internal vs External</div>
              </div>
              <p className="small-block-text">
                Percentage of non-admin users by type.
              </p>

              <div className="progress-track" style={{ marginBottom: 8 }}>
                <div
                  className="progress-fill"
                  style={{ width: `${internalPercent}%`, background: "#3b82f6" }}
                />
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${externalPercent}%`, background: "#f97316" }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 8,
                  fontSize: 12,
                }}
              >
                <span>
                  Internal • {internalUsers} ({internalPercent}%)
                </span>
                <span>
                  External • {externalUsers} ({externalPercent}%)
                </span>
              </div>
            </div>

            {/* User progress table */}
            <div className="block">
              <div className="block-header">
                <div className="block-title">User Progress Overview</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={
                      userFilter === "all"
                        ? {}
                        : { background: "#e5e7eb", color: "#374151" }
                    }
                    onClick={() => setUserFilter("all")}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={
                      userFilter === "internal"
                        ? {}
                        : { background: "#e5e7eb", color: "#374151" }
                    }
                    onClick={() => setUserFilter("internal")}
                  >
                    Internal
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={
                      userFilter === "external"
                        ? {}
                        : { background: "#e5e7eb", color: "#374151" }
                    }
                    onClick={() => setUserFilter("external")}
                  >
                    External
                  </button>
                </div>
              </div>

              {loadingData ? (
                <p className="small-block-text">Loading user progress…</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "8px 10px",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          User
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "8px 10px",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          Email
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "8px 10px",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          Type
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "8px 10px",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          Courses
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "8px 10px",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          Lessons
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            style={{
                              textAlign: "center",
                              padding: "10px 0",
                              color: "#9ca3af",
                            }}
                          >
                            No users for this filter.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => (
                          <tr key={u.id}>
                            <td
                              style={{
                                padding: "8px 10px",
                                borderBottom: "1px solid #e5e7eb",
                              }}
                            >
                              {u.full_name || "Unnamed user"}
                            </td>
                            <td
                              style={{
                                padding: "8px 10px",
                                borderBottom: "1px solid #e5e7eb",
                              }}
                            >
                              {u.email}
                            </td>
                            <td
                              style={{
                                padding: "8px 10px",
                                borderBottom: "1px solid #e5e7eb",
                              }}
                            >
                              {u.user_type || "—"}
                            </td>
                            <td
                              style={{
                                padding: "8px 10px",
                                borderBottom: "1px solid #e5e7eb",
                              }}
                            >
                              {u.courses_enrolled}
                            </td>
                            <td
                              style={{
                                padding: "8px 10px",
                                borderBottom: "1px solid #e5e7eb",
                              }}
                            >
                              {u.lessons_completed}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
