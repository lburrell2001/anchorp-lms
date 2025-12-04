import CoursePageClient from './CoursePageClient';

// In Next 16 app router, params in server components are a Promise
export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <CoursePageClient slug={slug} />;
}
