"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import AppSidebar from "../components/AppSidebar";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: "internal" | "external" | "both" | null;
};

export default function LearningPathPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [hasEnrollment, setHasEnrollment] = useState(false);
  const [hasLessonProgress, setHasLessonProgress] = useState(false);
  const [hasCertificate, setHasCertificate] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("You must be signed in to view the learning path.");

      // ---- PROFILE FOR SIDEBAR ----
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

      // ---- STEP DATA ----

      // Step 1 – any enrollments?
      const { data: enrollRows, error: enrollError } = await supabase
        .from("course_enrollments")
        .select("id")
        .eq("user_id", user.id);

      if (enrollError) throw enrollError;
      const hasEnroll = (enrollRows || []).length > 0;
      setHasEnrollment(hasEnroll);

      // Step 2 – any completed lessons?
      const { data: lpRows, error: lpError } = await supabase
        .from("lesson_progress")
        .select("lesson_id, completed_at")
        .eq("user_id", user.id);

      if (lpError) throw lpError;
      const hasLessonsDone = (lpRows || []).some(
        (row: any) => row.completed_at != null
      );
      setHasLessonProgress(hasLessonsDone);

      // Step 3 – any certificates?
      const { data: certRows, error: certError } = await supabase
        .from("certificates")
        .select("id")
        .eq("user_id", user.id);

      if (certError) throw certError;
      const hasCert = (certRows || []).length > 0;
      setHasCertificate(hasCert);
    } catch (e: any) {
      console.error("Error loading learning path:", e);
      setError(e.message ?? "Failed to load learning path.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const fullName = profile?.full_name ?? null;
  const email = profile?.email ?? null;

  const stepsCompleted =
    (hasEnrollment ? 1 : 0) +
    (hasLessonProgress ? 1 : 0) +
    (hasCertificate ? 1 : 0);

  let overallStatus = "Not started";
  if (hasCertificate) overallStatus = "Completed";
  else if (hasEnrollment || hasLessonProgress) overallStatus = "In progress";

  return (
    <div className="dashboard-root">
      {/* SHARED SIDEBAR */}
      <AppSidebar
        active="dashboard" // still no dedicated nav item
        fullName={fullName}
        email={email}
      />

      {/* MAIN */}
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">Learning path</div>
            <div className="topbar-subtitle">
              Follow a simple path from first enrollment to completed CEUs.
            </div>
          </div>
        </div>

        <section className="block map-block">
          {loading && <p>Loading learning path…</p>}

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

          {!loading && !error && (
            <>
              {/* Header row */}
              <div className="map-header-row">
                <div>
                  <div className="map-label">LEARNING PATH</div>
                  <div className="map-title">Anchorp LMS Overview</div>
                  <div className="map-subtitle">
                    Move from enrolling in your first course to earning
                    certificates and tracking CEUs.
                  </div>
                </div>

                <div className="lp-status">
                  <div className="lp-status-label">Path status</div>
                  <div
                    className={`lp-status-chip lp-status-${overallStatus
                      .replace(" ", "-")
                      .toLowerCase()}`}
                  >
                    {overallStatus}
                  </div>
                  <div className="lp-status-steps">
                    {stepsCompleted} / 3 steps complete
                  </div>
                </div>
              </div>

              {/* Steps */}
              <div className="map-steps" style={{ marginTop: 16 }}>
                {/* STEP 1 */}
                <div
                  className={
                    "map-step lp-step" +
                    (hasEnrollment ? " map-step-active" : "")
                  }
                >
                  <div className="map-step-dot" />
                  <div>
                    <div className="lp-step-header">
                      <span className="map-step-title">Step 1</span>
                      <span
                        className={
                          "lp-step-pill " +
                          (hasEnrollment
                            ? "lp-pill-completed"
                            : "lp-pill-not-started")
                        }
                      >
                        {hasEnrollment ? "Completed" : "Not started"}
                      </span>
                    </div>
                    <div className="map-step-meta">
                      Enroll in your first course.
                    </div>
                    <div className="map-step-detail">
                      Browse the <strong>All Courses</strong> catalog, choose
                      the training that fits your role, and click{" "}
                      <strong>Enroll</strong>. Once you’re in at least one
                      course, this step is checked off.
                    </div>
                  </div>
                </div>

                {/* STEP 2 */}
                <div
                  className={
                    "map-step lp-step" +
                    (hasLessonProgress ? " map-step-active" : "")
                  }
                >
                  <div className="map-step-dot" />
                  <div>
                    <div className="lp-step-header">
                      <span className="map-step-title">Step 2</span>
                      <span
                        className={
                          "lp-step-pill " +
                          (hasLessonProgress
                            ? "lp-pill-in-progress"
                            : "lp-pill-not-started")
                        }
                      >
                        {hasLessonProgress ? "In progress" : "Not started"}
                      </span>
                    </div>
                    <div className="map-step-meta">
                      Complete all lessons in at least one course.
                    </div>
                    <div className="map-step-detail">
                      Work through the lessons in your enrolled courses. When
                      you finish every lesson in one course, this step is
                      considered complete.
                    </div>
                  </div>
                </div>

                {/* STEP 3 */}
                <div
                  className={
                    "map-step lp-step" +
                    (hasCertificate ? " map-step-active" : "")
                  }
                >
                  <div className="map-step-dot" />
                  <div>
                    <div className="lp-step-header">
                      <span className="map-step-title">Step 3</span>
                      <span
                        className={
                          "lp-step-pill " +
                          (hasCertificate
                            ? "lp-pill-completed"
                            : "lp-pill-locked")
                        }
                      >
                        {hasCertificate ? "Completed" : "Locked"}
                      </span>
                    </div>
                    <div className="map-step-meta">
                      Earn certificates and track CEUs.
                    </div>
                    <div className="map-step-detail">
                      After you’ve completed eligible courses, certificates are
                      generated on your <strong>Certificates</strong> page. Use
                      them to document CEUs and compliance training.
                    </div>
                  </div>
                </div>
              </div>

              <p
                className="small-block-text"
                style={{
                  marginTop: 16,
                  maxWidth: 520,
                  color: "#4b5563",
                }}
              >
                As you enroll in courses, complete lessons, and earn
                certificates, the steps above will highlight to show your path
                through Anchorp Academy. Hover over each step to see more detail
                about what it means.
              </p>
            </>
          )}
        </section>
      </main>

      {/* Scoped styles just for this page */}
      <style jsx>{`
        /* Override the green "map-block" just on this page */
        .map-block {
          background: #ffffff;
          border-radius: 18px;
          border: 1px solid #e5e7eb;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
        }

        .map-label {
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 4px;
        }

        .map-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #111827;
        }

        .map-subtitle {
          font-size: 0.85rem;
          color: #4b5563;
          margin-top: 2px;
        }

        .map-header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
        }

        .lp-status {
          text-align: right;
          font-size: 0.75rem;
          color: #6b7280;
        }

        .lp-status-label {
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .lp-status-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .lp-status-in-progress {
          background: #11500f;
          border: 1px solid #11500f;
          color: #fff;
        }

        .lp-status-completed {
          background: #ecfdf3;
          border: 1px solid #bbf7d0;
          color: #166534;
        }

        .lp-status-not-started {
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          color: #4b5563;
        }

        .lp-status-steps {
          font-size: 0.75rem;
          color: #6b7280;
        }

        .map-steps {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .map-step {
          background: #f9fafb;
          border-radius: 999px;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: background 0.15s ease, transform 0.15s ease,
            box-shadow 0.15s ease;
        }

        .map-step-active {
          background: #ecfdf3;
          box-shadow: 0 6px 18px rgba(16, 185, 129, 0.15);
        }

        .map-step-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #10b981;
          flex-shrink: 0;
        }

        .lp-step {
          position: relative;
        }

        .lp-step-header {
          display: flex;
          align-items: center;
          width: 100%;
        }

        .map-step-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: #111827;
        }

        .lp-step-pill {
          margin-left: auto; /* right-align tag */
          padding: 2px 10px;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 600;
          white-space: nowrap;
          border: 1px solid transparent;
        }

        .lp-pill-completed {
          background: #ecfdf3;
          border-color: #bbf7d0;
          color: #166534;
        }

        .lp-pill-in-progress {
          background: #11500f;
          border-color: #11500f;
          color: #fffff;
        }

        .lp-pill-locked {
          background: #fef2f2;
          border-color: #fecaca;
          color: #b91c1c;
        }

        .lp-pill-not-started {
          background: #f3f4f6;
          border-color: #e5e7eb;
          color: #4b5563;
        }

        .map-step-meta {
          font-size: 0.8rem;
          color: #374151;
          margin-top: 2px;
        }

        .map-step-detail {
          display: none;
          margin-top: 4px;
          font-size: 0.75rem;
          color: #4b5563;
        }

        .map-step:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }

        .map-step:hover .map-step-detail {
          display: block;
        }

        @media (max-width: 768px) {
          .map-header-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .lp-status {
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
}
