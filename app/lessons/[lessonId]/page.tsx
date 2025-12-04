// app/lessons/[lessonId]/page.tsx
import { createClient } from '@supabase/supabase-js';
import LessonPageClient from './LessonPageClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function LessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  // 🔹 Next.js 16: params is a Promise, so we must await it
  const { lessonId } = await params;

  // 1) Fetch the lesson (including video_url + content)
  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('id, title, content, video_url')
    .eq('id', lessonId)
    .single();

  if (lessonError || !lesson) {
    console.error('Lesson error:', lessonError?.message ?? lessonError);
    return <div>Lesson not found</div>;
  }

  // 2) Fetch quiz for this lesson
  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .select('id, title')
    .eq('lesson_id', lessonId)
    .single();

  if (quizError) {
    console.warn('No quiz for this lesson or quiz error:', quizError.message);
  }

  // 3) Fetch quiz questions + options if quiz exists
  let questions: any[] = [];
  if (quiz) {
    const { data: questionRows, error: questionsError } = await supabase
      .from('quiz_questions')
      .select(
        `
        id,
        question_text,
        question_type,
        sort_order,
        quiz_options (
          id,
          option_text,
          is_correct,
          sort_order
        )
      `
      )
      .eq('quiz_id', quiz.id)
      .order('sort_order', { ascending: true });

    if (questionsError) {
      console.error('Quiz questions error:', questionsError);
    } else {
      questions = questionRows ?? [];
    }
  }

  return (
    <LessonPageClient
      lesson={{
        id: lesson.id,
        title: lesson.title,
        content: lesson.content,
        videoUrl: lesson.video_url ?? null,
      }}
      quiz={quiz ? { id: quiz.id, title: quiz.title } : null}
      questions={questions}
    />
  );
}
