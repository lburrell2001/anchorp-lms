// app/lessons/[lessonId]/LessonPageClient.tsx
'use client';

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
  question_type?: string | null;
  sort_order?: number | null;
};

type LessonPageClientProps = {
  lesson: Lesson;
  quiz: Quiz;
  questions: Question[];
};

export default function LessonPageClient({
  lesson,
  quiz,
  questions,
}: LessonPageClientProps) {
  return (
    <main style={{ padding: 40 }}>
      <h1>{lesson.title}</h1>
      {lesson.content && <p>{lesson.content}</p>}

      {quiz && (
        <section style={{ marginTop: 32 }}>
          <h2>Quiz: {quiz.title}</h2>

          {(!questions || questions.length === 0) && (
            <p>No quiz questions have been added yet.</p>
          )}

          {questions && questions.length > 0 && (
            <ul style={{ marginTop: 16 }}>
              {questions.map((q) => (
                <li key={q.id}>{q.question_text}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
