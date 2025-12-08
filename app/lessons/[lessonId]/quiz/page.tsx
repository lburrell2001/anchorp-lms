"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

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

  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [passed, setPassed] = useState<boolean | null>(null);

  // --------------------------------------------------
  // LOAD USER, LESSON, COURSE, QUIZ, QUESTIONS, OPTIONS
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

    try {
      // current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("You must be logged in to take this quiz.");
      setUserId(user.id);

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

      if (moduleRow?.course_id) {
        const { data: courseRow, error: courseError } = await supabase
          .from("courses")
          .select("id, title, description, audience")
          .eq("id", moduleRow.course_id)
          .maybeSingle();
        if (courseError) throw courseError;
        if (courseRow) setCourse(courseRow as Course);
      }

      // quiz for this lesson  (REAL TABLE: quizzes)
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

    // ensure all answered
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

      // record attempt
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
    } catch (e: any) {
      console.error("Error submitting quiz:", e);
      setError(e.message ?? "Failed to submit quiz.");
    } finally {
      setSubmitting(false);
    }
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------
  if (loading) {
    return (
      <div className="dashboard-root">
        <aside className="sidebar" />
        <main className="main" style={{ display: "flex", alignItems: "center" }}>
          <p>Loading quiz...</p>
        </main>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="dashboard-root">
        <aside className="sidebar" />
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

  const courseTitle = course?.title ?? "Course";

  return (
    <div className="dashboard-root">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-profile">
          <div>
            <div className="profile-name">{courseTitle}</div>
            <div className="profile-email">Quiz for: {lesson.title}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className="nav-item"
            onClick={() => router.push(`/lessons/${lesson.id}`)}
          >
            ← Back to lesson
          </button>
          <button className="nav-item" onClick={() => router.push("/dashboard")}>
            Dashboard
          </button>
        </nav>
      </aside>

      {/* MAIN */}
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">Lesson quiz</div>
            <div className="topbar-subtitle">
              Answer the questions below to complete this lesson.
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
