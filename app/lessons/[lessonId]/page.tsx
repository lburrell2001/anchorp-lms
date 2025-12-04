// app/lessons/[lessonId]/page.tsx
import { createClient } from '@supabase/supabase-js';
import LessonPageClient from './LessonPageClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type LessonPageProps = {
  params: Promise<{ lessonId: string }>;
};

export default async function LessonPage({ params }: LessonPageProps) {
  // 🔑 IMPORTANT: params is a Promise in Next 16
  const { lessonId } = await params;

  console.log('Lesson route param lessonId:', lessonId);

  // 1) Fetch the lesson
  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('id, title, content')
    .eq('id', lessonId)
    .single();

  console.log('Lesson from Supabase:', lesson);
  if (lessonError) console.error('lessonError:', lessonError);

  if (!lesson) {
    return <div>Lesson not found</div>;
  }

  // 2) Fetch quiz for this lesson
  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .select('id, title, lesson_id')
    .eq('lesson_id', lessonId)
    .single();

  console.log('Quiz for lesson:', quiz);
  if (quizError) console.error('quizError:', quizError);

  // 3) Fetch quiz questions (only if quiz exists)
  let questions:
    | {
        id: string;
        question_text: string;
        question_type: string | null;
        sort_order: number | null;
      }[]
    | [] = [];

  if (quiz) {
    const { data: questionRows, error: questionsError } = await supabase
      .from('quiz_questions')
      .select('id, question_text, question_type, sort_order')
      .eq('quiz_id', quiz.id)
      .order('sort_order', { ascending: true });

    console.log('quiz.id used to fetch questions:', quiz.id);
    console.log('questionRows:', questionRows);
    if (questionsError) console.error('questionsError:', questionsError);

    questions = questionRows ?? [];
  }

  return (
    <LessonPageClient
      lesson={lesson}
      quiz={quiz ?? null}
      questions={questions}
    />
  );
}
