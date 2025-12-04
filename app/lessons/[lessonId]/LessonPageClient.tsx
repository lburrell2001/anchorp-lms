'use client';

import React, { useState, FormEvent } from 'react';

type Lesson = {
  id: string;
  title: string;
  content: string | null;
  videoUrl: string | null;
};

type Quiz = {
  id: string;
  title: string;
};

type QuizOption = {
  id: string;
  option_text: string;
  is_correct: boolean;
  sort_order?: number | null;
};

type QuizQuestion = {
  id: string;
  question_text: string;
  question_type: string;
  quiz_options: QuizOption[];
};

type Props = {
  lesson: Lesson;
  quiz: Quiz | null;
  questions: QuizQuestion[];
};

export default function LessonPageClient({ lesson, quiz, questions }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState<number | null>(null);
  const [quizVisible, setQuizVisible] = useState(false);

  const handleOptionChange = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!quiz) return;

    let correctCount = 0;

    questions.forEach((q) => {
      const selectedOptionId = answers[q.id];
      if (!selectedOptionId) return;

      const correctOption = q.quiz_options.find((o) => o.is_correct);
      if (correctOption && correctOption.id === selectedOptionId) {
        correctCount += 1;
      }
    });

    setScore(correctCount);
  };

  const hasQuiz = quiz && questions.length > 0;

  return (
    <main
      style={{
        padding: '40px',
        maxWidth: '900px',
        margin: '0 auto',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* Title */}
      <h1 style={{ fontSize: '32px', marginBottom: '16px' }}>
        {lesson.title}
      </h1>

      {/* Video */}
      {lesson.videoUrl && (
        <section style={{ marginBottom: '24px' }}>
          <video
            src={lesson.videoUrl}
            controls
            onEnded={() => setQuizVisible(true)} // show quiz after video ends
            style={{
              width: '100%',
              maxHeight: '480px',
              borderRadius: '8px',
              backgroundColor: 'black',
            }}
          />
          {!quizVisible && hasQuiz && (
            <p style={{ fontSize: '14px', marginTop: '8px' }}>
              Watch the full video. The quiz will appear when the video
              finishes.{' '}
              <button
                type="button"
                onClick={() => setQuizVisible(true)}
                style={{
                  marginLeft: 8,
                  padding: '4px 10px',
                  borderRadius: 4,
                  border: '1px solid #999',
                  background: 'transparent',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Skip to quiz
              </button>
            </p>
          )}
        </section>
      )}

      {/* Transcript / content */}
      {lesson.content && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>
            Lesson Transcript
          </h2>
          <p style={{ lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {lesson.content}
          </p>
        </section>
      )}

      {/* Quiz */}
      {hasQuiz && quizVisible && (
        <section>
          <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>
            Quiz: {quiz!.title}
          </h2>

          <form onSubmit={handleSubmit}>
            {questions.map((q, index) => (
              <div
                key={q.id}
                style={{ marginBottom: '24px', paddingBottom: '8px' }}
              >
                <p style={{ fontWeight: 600, marginBottom: '8px' }}>
                  {index + 1}. {q.question_text}
                </p>

                {q.quiz_options.map((opt) => (
                  <label
                    key={opt.id}
                    style={{
                      display: 'block',
                      marginBottom: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={opt.id}
                      checked={answers[q.id] === opt.id}
                      onChange={() => handleOptionChange(q.id, opt.id)}
                      style={{ marginRight: '8px' }}
                    />
                    {opt.option_text}
                  </label>
                ))}
              </div>
            ))}

            <button
              type="submit"
              style={{
                padding: '10px 18px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#047835',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Submit Quiz
            </button>
          </form>

          {score !== null && (
            <p style={{ marginTop: '16px', fontWeight: 600 }}>
              You scored {score} out of {questions.length}.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
