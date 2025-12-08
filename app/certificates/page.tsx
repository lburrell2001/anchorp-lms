"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import AppSidebar from "../components/AppSidebar";

type CertificateRow = {
  id: string;
  certificate_url: string | null;
  certificate_number: string | null;
  issued_at: string;
  completed_at: string | null;
  courses: {
    id: string;
    title: string;
    slug: string;
  } | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: "internal" | "external" | "both" | null;
};

export default function CertificatesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [certs, setCerts] = useState<CertificateRow[]>([]);
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
      if (!user) throw new Error("You must be signed in to view certificates.");

      // ---------- PROFILE (for sidebar) ----------
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

      // ---------- CERTIFICATES ----------
      const { data, error: certError } = await supabase
        .from("certificates")
        .select(
          `
          id,
          certificate_url,
          certificate_number,
          issued_at,
          completed_at,
          courses (
            id,
            title,
            slug
          )
        `
        )
        .eq("user_id", user.id)
        .order("issued_at", { ascending: false });

      if (certError) throw certError;

      setCerts((data || []) as CertificateRow[]);
    } catch (e: any) {
      console.error("Error loading certificates:", e);
      setError(e.message ?? "Failed to load certificates.");
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
      <AppSidebar active="certificates" fullName={fullName} email={email} />

      {/* MAIN */}
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">Certificates</div>
            <div className="topbar-subtitle">
              View certificates for courses you’ve completed.
            </div>
          </div>
        </div>

        <section className="block">
          {loading && <p>Loading certificates...</p>}

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

          {!loading && !error && certs.length === 0 && (
            <p className="small-block-text">
              You don’t have any certificates yet. Finish a course to earn one.
            </p>
          )}

          {!loading &&
            !error &&
            certs.map((row) => {
              const course = row.courses;
              const issuedDate = new Date(row.issued_at).toLocaleDateString();

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
                      {course?.title || "Unknown course"}
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        fontSize: "0.8rem",
                        color: "#4b5563",
                      }}
                    >
                      Issued on {issuedDate}
                      {row.certificate_number && (
                        <> · Certificate #{row.certificate_number}</>
                      )}
                    </div>

                    {row.completed_at && (
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: "0.75rem",
                          color: "#6b7280",
                        }}
                      >
                        Course completed on{" "}
                        {new Date(row.completed_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {course?.slug && (
                      <button
                        onClick={() => router.push(`/courses/${course.slug}`)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          border: "none",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          backgroundColor: "#e5e7eb",
                          color: "#111827",
                          cursor: "pointer",
                        }}
                      >
                        View course
                      </button>
                    )}

                    {row.certificate_url ? (
                      <a
                        href={row.certificate_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: "6px 12px",
                          borderRadius: 999,
                          border: "none",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          backgroundColor: "#047857",
                          color: "#fff",
                          textDecoration: "none",
                          cursor: "pointer",
                        }}
                      >
                        View / Download
                      </a>
                    ) : (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "#9ca3af",
                        }}
                      >
                        No file attached yet
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </section>
      </main>
    </div>
  );
}
