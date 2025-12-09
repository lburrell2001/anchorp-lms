"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import AppSidebar from "../../../components/AppSidebar";
import {
  generateCertificate,
  type CertificateRow,
} from "../../../../lib/certificateService";

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

type Quiz = {
  id: string;
  title: string | null;
  pass_score: number | null;
  max_attempts: number | null;
};

type QuizQuestion = {
  id: string;
  question_text: string;
  sort_order: number | null;
};

type QuizOption = {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  sort_order: number | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: "internal" | "external" | "both" | null;
};

export default function LessonQuizPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [options, setOptions] = useState<QuizOption[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, string>
  >({});
  const [userId, setUserId] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [passed, setPassed] = useState<boolean | null>(null);

  // certificate state
  const [certificate, setCertificate] = useState<CertificateRow | null>(null);
  const [generatingCert, setGeneratingCert] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);

  // 3 text inputs for certificate
  const [nameText, setNameText] = useState("");
  const [completionLine, setCompletionLine] = useState("");
  const [completionDate, setCompletionDate] = useState("");

  // --------------------------------------------------
  // LOAD USER, PROFILE, LESSON, COURSE, QUIZ, QUESTIONS, OPTIONS, CERTIFICATE
  // --------------------------------------------------
  const loadData = useCallback(async () => {
    if (!lessonId) {
      setError("Missing lesson id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setResultMessage(null);
    setPassed(null);
    setSelectedAnswers({});
    setCertificate(null);
    setCertError(null);

    try {
      // current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("You must be logged in to take this quiz.");
      setUserId(user.id);

      // profile for sidebar + name on certificate
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

      // lesson
      const { data: lessonRow, error: lessonError } = await supabase
        .from("lessons")
        .select("id, title, module_id")
        .eq("id", lessonId)
        .maybeSingle();

      if (lessonError) throw lessonError;
      if (!lessonRow) throw new Error("Lesson not found.");
      const lessonTyped = lessonRow as Lesson;
      setLesson(lessonTyped);

      // module -> course
      const { data: moduleRow, error: moduleError } = await supabase
        .from("modules")
        .select("course_id")
        .eq("id", lessonTyped.module_id)
        .maybeSingle();
      if (moduleError) throw moduleError;

      let courseRow: Course | null = null;

      if (moduleRow?.course_id) {
        const { data: courseData, error: courseError } = await supabase
          .from("courses")
          .select("id, title, description, audience")
          .eq("id", moduleRow.course_id)
          .maybeSingle();
        if (courseError) throw courseError;
        if (courseData) {
          courseRow = courseData as Course;
          setCourse(courseRow);
        }
      }

      // quiz for this lesson
      const { data: quizRow, error: quizError } = await supabase
        .from("quizzes")
        .select("id, title, pass_score, max_attempts")
        .eq("lesson_id", lessonId)
        .maybeSingle();

      if (quizError) throw quizError;
      if (!quizRow) {
        setQuiz(null);
        setQuestions([]);
        setOptions([]);
        setError("No quiz has been configured for this lesson yet.");
        return;
      }
      const quizTyped = quizRow as Quiz;
      setQuiz(quizTyped);

      // questions
      const { data: questionRows, error: questionError } = await supabase
        .from("quiz_questions")
        .select("id, question_text, sort_order")
        .eq("quiz_id", quizTyped.id)
        .order("sort_order", { ascending: true });

      if (questionError) throw questionError;
      const qs = (questionRows || []) as QuizQuestion[];
      setQuestions(qs);

      // options for questions
      if (qs.length) {
        const qIds = qs.map((q) => q.id);
        const { data: optionRows, error: optionError } = await supabase
          .from("quiz_options")
          .select("id, question_id, option_text, is_correct, sort_order")
          .in("question_id", qIds)
          .order("sort_order", { ascending: true });

        if (optionError) throw optionError;
        setOptions((optionRows || []) as QuizOption[]);
      } else {
        setOptions([]);
      }

      // existing certificate for this course + user (if any)
      if (courseRow) {
        const { data: certRow, error: certError } = await supabase
          .from("certificates")
          .select(
            `
            id,
            certificate_url,
            certificate_number,
            issued_at,
            completed_at
          `
          )
          .eq("user_id", user.id)
          .eq("course_id", courseRow.id)
          .maybeSingle();

        if (certError && certError.code !== "PGRST116") {
          console.error("Error loading certificate:", certError);
        }

        if (certRow) {
          setCertificate(certRow as CertificateRow);
          setPassed(true);
          setResultMessage(
            "You have already passed this quiz and earned a certificate."
          );
        }
      }
    } catch (e: any) {
      console.error("Error loading quiz:", e);
      setError(e.message ?? "Failed to load quiz.");
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --------------------------------------------------
  // HANDLERS
  // --------------------------------------------------
  const handleSelectOption = (questionId: string, optionId: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmit = async () => {
    if (!quiz || !userId || !questions.length) return;

    for (const q of questions) {
      if (!selectedAnswers[q.id]) {
        setResultMessage("Please answer all questions before submitting.");
        setPassed(null);
        return;
      }
    }

    setSubmitting(true);
    setResultMessage(null);
    setError(null);
    setCertError(null);

    try {
      const correctIds = new Set(
        options.filter((o) => o.is_correct).map((o) => o.id)
      );

      let correctCount = 0;
      const rawAnswers: Record<string, string> = {};

      for (const q of questions) {
        const chosen = selectedAnswers[q.id];
        rawAnswers[q.id] = chosen;
        if (correctIds.has(chosen)) correctCount += 1;
      }

      const passScore = quiz.pass_score ?? questions.length;
      const didPass = correctCount >= passScore;

      const { error: attemptError } = await supabase
        .from("quiz_attempts")
        .insert({
          user_id: userId,
          quiz_id: quiz.id,
          score: correctCount,
          passed: didPass,
          started_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          raw_answers: rawAnswers,
        });

      if (attemptError) throw attemptError;

      // mark lesson complete if passed
      if (didPass && lessonId) {
        const { error: lpError } = await supabase
          .from("lesson_progress")
          .upsert(
            [
              {
                user_id: userId,
                lesson_id: lessonId,
                completed_at: new Date().toISOString(),
              },
            ],
            { onConflict: "user_id,lesson_id" }
          );
        if (lpError) console.error("Error marking progress:", lpError);
      }

      setPassed(didPass);
      setResultMessage(
        didPass
          ? `You passed! You answered ${correctCount} of ${questions.length} correctly.`
          : `You scored ${correctCount} of ${questions.length}. You need at least ${passScore} correct to pass.`
      );

      // prefill certificate inputs when they pass
      if (didPass) {
        const defaultName =
          profile?.full_name ||
          (profile?.email ?? "").split("@")[0] ||
          "Learner";

        const courseName = course?.title ?? "this course";
        setNameText(defaultName);
        setCompletionLine(`for completing ${courseName}`);
        setCompletionDate(
          new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        );
      }
    } catch (e: any) {
      console.error("Error submitting quiz:", e);
      setError(e.message ?? "Failed to submit quiz.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateCertificate = async () => {
    if (!userId || !course) return;

    if (!nameText || !completionLine || !completionDate) {
      setCertError("Please fill out all certificate fields.");
      return;
    }

    setGeneratingCert(true);
    setCertError(null);

    try {
      const cert = await generateCertificate({
        userId,
        courseId: course.id,
        nameText,
        completionLine,
        completionDate,
      });

      setCertificate(cert);
      if (cert.certificate_url) {
        window.open(cert.certificate_url, "_blank");
      }
    } catch (err: any) {
      console.error("Error generating certificate:", err);
      setCertError(
        err?.message || "You passed, but we could not create a certificate."
      );
    } finally {
      setGeneratingCert(false);
    }
  };

  const handleOpenCertificate = () => {
    if (certificate?.certificate_url) {
      window.open(certificate.certificate_url, "_blank");
    }
  };

  const fullName = profile?.full_name ?? null;
  const email = profile?.email ?? null;
  const courseTitle = course?.title ?? "Course";

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------
  if (loading) {
    return (
      <div className="dashboard-root">
        <AppSidebar active="dashboard" fullName={fullName} email={email} />
        <main className="main" style={{ display: "flex", alignItems: "center" }}>
          <p>Loading quiz...</p>
        </main>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="dashboard-root">
        <AppSidebar active="dashboard" fullName={fullName} email={email} />
        <main className="main">
          <p>Lesson not found.</p>
          {error && (
            <p style={{ marginTop: 8, fontSize: "0.8rem", color: "#b91c1c" }}>
              {error}
            </p>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-root">
      <AppSidebar active="dashboard" fullName={fullName} email={email} />

      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">Lesson quiz</div>
            <div className="topbar-subtitle">
              Answer the questions below to complete this lesson for{" "}
              {courseTitle}.
            </div>
          </div>
          {passed && (
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#047835",
              }}
            >
              ✓ Passed
            </div>
          )}
        </div>

        <section className="block">
          {error && (
            <div
              style={{
                marginBottom: "16px",
                fontSize: "0.8rem",
                color: "#b91c1c",
              }}
            >
              {error}
            </div>
          )}

          {!quiz && !error && (
            <p>No quiz has been configured for this lesson yet.</p>
          )}

          {quiz && questions.length > 0 && (
            <>
              <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {questions.map((q, idx) => (
                  <li
                    key={q.id}
                    style={{
                      marginBottom: "16px",
                      paddingBottom: "16px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        marginBottom: "6px",
                      }}
                    >
                      {idx + 1}. {q.question_text}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#111827" }}>
                      {options
                        .filter((o) => o.question_id === q.id)
                        .map((o) => (
                          <label
                            key={o.id}
                            style={{
                              display: "block",
                              marginBottom: "4px",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              value={o.id}
                              checked={selectedAnswers[q.id] === o.id}
                              onChange={() =>
                                handleSelectOption(q.id, o.id)
                              }
                              style={{ marginRight: "6px" }}
                            />
                            {o.option_text}
                          </label>
                        ))}
                    </div>
                  </li>
                ))}
              </ol>

              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  marginTop: "8px",
                  padding: "8px 16px",
                  borderRadius: "999px",
                  border: "none",
                  backgroundColor: "#047857",
                  color: "#fff",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: submitting ? "default" : "pointer",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Submitting..." : "Submit quiz"}
              </button>

              {resultMessage && (
                <div
                  style={{
                    marginTop: "12px",
                    fontSize: "0.85rem",
                    color: passed ? "#047857" : "#b91c1c",
                  }}
                >
                  {resultMessage}
                </div>
              )}

              {/* Certificate section (after passing) */}
              {passed && (
                <div
                  style={{
                    marginTop: "20px",
                    paddingTop: "16px",
                    borderTop: "1px solid #e5e7eb",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      marginBottom: 6,
                      color: "#111827",
                    }}
                  >
                    Certificate
                  </h3>
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: "#4b5563",
                      marginBottom: 12,
                    }}
                  >
                    Confirm how your information should appear on the certificate,
                    then generate and download it.
                  </p>

                  {certError && (
                    <p
                      style={{
                        marginBottom: 8,
                        fontSize: "0.8rem",
                        color: "#b91c1c",
                      }}
                    >
                      {certError}
                    </p>
                  )}

                  {/* 3 inputs */}
                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                      maxWidth: 420,
                      marginBottom: 12,
                    }}
                  >
                    <label style={{ fontSize: "0.8rem", color: "#374151" }}>
                      Name on certificate
                      <input
                        type="text"
                        value={nameText}
                        onChange={(e) => setNameText(e.target.value)}
                        style={{
                          marginTop: 4,
                          width: "100%",
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #d1d5db",
                          fontSize: "0.85rem",
                        }}
                      />
                    </label>

                    <label style={{ fontSize: "0.8rem", color: "#374151" }}>
                      Completion line
                      <input
                        type="text"
                        value={completionLine}
                        onChange={(e) => setCompletionLine(e.target.value)}
                        style={{
                          marginTop: 4,
                          width: "100%",
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #d1d5db",
                          fontSize: "0.85rem",
                        }}
                      />
                    </label>

                    <label style={{ fontSize: "0.8rem", color: "#374151" }}>
                      Completion date
                      <input
                        type="text"
                        value={completionDate}
                        onChange={(e) => setCompletionDate(e.target.value)}
                        style={{
                          marginTop: 4,
                          width: "100%",
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #d1d5db",
                          fontSize: "0.85rem",
                        }}
                      />
                    </label>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <button
                      onClick={handleGenerateCertificate}
                      disabled={generatingCert}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: "none",
                        backgroundColor: generatingCert ? "#9ca3af" : "#047857",
                        color: "#fff",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: generatingCert ? "default" : "pointer",
                      }}
                    >
                      {generatingCert
                        ? "Generating certificate..."
                        : "Generate & Download Certificate"}
                    </button>

                    {certificate?.certificate_url && (
                      <>
                        <button
                          onClick={handleOpenCertificate}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 999,
                            border: "none",
                            backgroundColor: "#111827",
                            color: "#fff",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          View / Download Again
                        </button>
                        <button
                          onClick={() => router.push("/certificates")}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 999,
                            border: "none",
                            backgroundColor: "#e5e7eb",
                            color: "#111827",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Go to My Certificates
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {quiz && questions.length === 0 && !error && (
            <p>This quiz exists but doesn’t have any questions yet.</p>
          )}
        </section>
      </main>
    </div>
  );
}
