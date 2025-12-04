'use client';

import { useEffect, useState } from 'react';
// If your project uses a different path, copy it from your other working file
import { supabase } from '@/lib/supabaseClient';

type Lesson = {
  id: string;
  title: string;
  content: string | null;
};

type Quiz = {
  id: string;
  title: string;
} | null;

type Question = {
  id: string;
  question_text: string;
};

type Option = {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  sort_order: number | null;
};

type LessonPageClientProps = {
  lessonId: string;
};

export default function LessonPageClient({ lessonId }: LessonPageClientProps) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [quiz, setQuiz] = useState<Quiz>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [optionsByQuestion, setOptionsByQuestion] = useState<
    Record<string, Option[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      setScore(null);
      setAnswers({});
      setOptionsByQuestion({});

      // 1) Lesson
      const { data: lessonRow, error: lessonErr } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single();

      if (lessonErr || !lessonRow) {
        console.error(lessonErr);
        setError('Lesson not found');
        setLoading(false);
        return;
      }

      setLesson(lessonRow as Lesson);

      // 2) Quiz for this lesson (optional)
      const { data: quizRow, error: quizErr } = await supabase
        .from('quizzes')
        .select('*')
        .eq('lesson_id', lessonId)
        .single();

      if (quizErr) {
        // Not fatal – just means no quiz yet
        console.log('No quiz or quiz error:', quizErr.message);
      }

      if (!quizRow) {
        setQuiz(null);
        setQuestions([]);
        setLoading(false);
        return;
      }

      setQuiz(quizRow as Quiz);

      // 3) Questions for this quiz
      const { data: questionRows, error: questionsErr } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizRow.id)
        .order('sort_order', { ascending: true });

      if (questionsErr) {
        console.error(questionsErr);
        setError('Error loading quiz questions');
        setLoading(false);
        return;
      }

      const qRows = (questionRows ?? []) as Question[];
      setQuestions(qRows);

      // 4) Options for these questions
      const questionIds = qRows.map((q) => q.id);
      if (questionIds.length > 0) {
        const { data: optionRows, error: optionsErr } = await supabase
          .from('quiz_options')
          .select('*')
          .in('question_id', questionIds)
          .order('sort_order', { ascending: true });

        if (optionsErr) {
          console.error(optionsErr);
          setError('Error loading answer options');
          setLoading(false);
          return;
        }

        const map: Record<string, Option[]> = {};
        (optionRows ?? []).forEach((opt: any) => {
          const qid = opt.question_id;
          if (!map[qid]) map[qid] = [];
          map[qid].push(opt as Option);
        });

        setOptionsByQuestion(map);
      }

      setLoading(false);
    }

    if (lessonId) {
      load();
    }
  }, [lessonId]);

  const handleChange = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmit = () => {
    if (!quiz) return;

    let correct = 0;

    questions.forEach((q) => {
      const selectedOptionId = answers[q.id];
      const opts = optionsByQuestion[q.id] || [];
      const selectedOption = opts.find((o) => o.id === selectedOptionId);
      if (selectedOption && selectedOption.is_correct) {
        correct += 1;
      }
    });

    setScore(correct);
  };

  if (loading) {
    return <main style={{ padding: 40 }}>Loading lesson...</main>;
  }

  if (error || !lesson) {
    return <main style={{ padding: 40, color: 'red' }}>{error || 'Error'}</main>;
  }

  return (
    <main style={{ padding: 40 }}>
      <h1 style={{ fontSize: 32, marginBottom: 16 }}>{lesson.title}</h1>
      {lesson.content && (
        <p style={{ marginBottom: 24, maxWidth: 640 }}>{lesson.content}</p>
      )}

      {quiz ? (
        <section>
          <h2 style={{ fontSize: 24, marginBottom: 12 }}>
            Quiz: {quiz.title}
          </h2>

          {questions.length === 0 && (
            <p>No quiz questions have been added yet.</p>
          )}

          {questions.map((q) => {
            const opts = optionsByQuestion[q.id] || [];

            return (
              <div key={q.id} style={{ marginBottom: 24 }}>
                <p style={{ fontWeight: 'bold', marginBottom: 8 }}>
                  {q.question_text}
                </p>

                {opts.length === 0 && (
                  <p style={{ fontStyle: 'italic' }}>
                    No options have been added for this question yet.
                  </p>
                )}

                {opts.map((option) => (
                  <label
                    key={option.id}
                    style={{
                      display: 'block',
                      marginBottom: 4,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name={`question-${q.id}`}
                      value={option.id}
                      checked={answers[q.id] === option.id}
                      onChange={() => handleChange(q.id, option.id)}
                      style={{ marginRight: 8 }}
                    />
                    {option.option_text}
                  </label>
                ))}
              </div>
            );
          })}

          {questions.length > 0 && (
            <>
              <button
                onClick={handleSubmit}
                style={{
                  marginTop: 8,
                  padding: '8px 16px',
                  backgroundColor: '#047835',
                  color: 'white',
                  borderRadius: 4,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Submit Quiz
              </button>

              {score !== null && (
                <p style={{ marginTop: 12 }}>
                  You scored {score} out of {questions.length}.
                </p>
              )}
            </>
          )}
        </section>
      ) : (
        <p>No quiz has been created for this lesson yet.</p>
      )}
    </main>
  );
}
