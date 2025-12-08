"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient"; // adjust path if needed
import AppSidebar from "../components/AppSidebar";   // ⬅️ shared sidebar

type Course = {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  audience: "internal" | "external" | "both" | null;
};

type EnrollmentWithCourse = {
  id: string;
  course_id: string;
  courses: Course | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: "internal" | "external" | "both" | null;
};

export default function MyCoursesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<EnrollmentWithCourse[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("You must be signed in to view your courses.");

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

      // ---------- ENROLLMENTS (unchanged) ----------
      const { data: enrollmentRows, error: enrollmentError } = await supabase
        .from("course_enrollments")
        .select(
          `
          id,
          course_id,
          courses (
            id,
            title,
            description,
            audience,
            slug
          )
        `
        )
        .eq("user_id", user.id); // 👈 no created_at ordering

      if (enrollmentError) throw enrollmentError;

      setItems((enrollmentRows || []) as EnrollmentWithCourse[]);
    } catch (e: any) {
      console.error("Error loading my courses:", e);
      setError(e.message ?? "Failed to load enrolled courses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const fullName = profile?.full_name ?? null;
  const email = profile?.email ?? null;

  return (
    <div className="dashboard-root">
      {/* SHARED SIDEBAR WITH REAL USER INFO */}
      <AppSidebar active="my-courses" fullName={fullName} email={email} />

      {/* MAIN */}
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">My courses</div>
            <div className="topbar-subtitle">
              Continue learning where you left off.
            </div>
          </div>
        </div>

        <section className="block">
          {loading && <p>Loading your courses...</p>}

          {error && (
            <p
              style={{
                marginBottom: 12,
                fontSize: "0.8rem",
                color: "#b91c1c",
              }}
            >
              {error}
            </p>
          )}

          {!loading && !error && items.length === 0 && (
            <p className="small-block-text">
              You’re not enrolled in any courses yet. Visit{" "}
              <button
                onClick={() => router.push("/courses")}
                style={{
                  border: "none",
                  background: "none",
                  padding: 0,
                  margin: 0,
                  color: "#047857",
                  fontSize: "0.8rem",
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                All courses
              </button>{" "}
              to get started.
            </p>
          )}

          {!loading &&
            !error &&
            items
              .filter((row) => row.courses)
              .map((row) => {
                const course = row.courses as Course;

                let audienceLabel = "Internal & external";
                if (course.audience === "internal") audienceLabel = "Internal only";
                if (course.audience === "external") audienceLabel = "External";

                return (
                  <div
                    key={row.id}
                    style={{
                      borderBottom: "1px solid #e5e7eb",
                      padding: "14px 0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: 600,
                          color: "#111827",
                        }}
                      >
                        {course.title}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: "0.8rem",
                          color: "#4b5563",
                        }}
                      >
                        {course.description || "No description provided yet."}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: "0.75rem",
                          color: "#6b7280",
                        }}
                      >
                        Audience: {audienceLabel}
                      </div>
                    </div>

                    <button
                      onClick={() => router.push(`/courses/${course.slug}`)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: "none",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        backgroundColor: "#111827",
                        color: "#fff",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Continue course
                    </button>
                  </div>
                );
              })}
        </section>
      </main>
    </div>
  );
}
