// app/lessons/[lessonId]/page.tsx

import LessonPageClient from './LessonPageClient';

type LessonPageProps = {
  // In Next.js 16, params is a Promise
  params: Promise<{ lessonId: string }>;
};

export default async function LessonPage({ params }: LessonPageProps) {
  // unwrap the params Promise
  const { lessonId } = await params;

  // hand everything off to the client component
  return <LessonPageClient lessonId={lessonId} />;
}
