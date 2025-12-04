'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from "../../../lib/supabaseClient";

type Lesson = {
  id: string;
  title: string;
};

type Module = {
  id: string;
  title: string;
  lessons: Lesson[];
};

type Course = {
  id: string;
  title: string;
  description: string | null;
  ceu_hours: number | null;
};

export default function CoursePageClient({ slug }: { slug: string }) {
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCourse() {
      try {
        setLoading(true);
        setError(null);

        // 1) get the course by slug
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select('id, title, description, ceu_hours')
          .eq('slug', slug)
          .maybeSingle();

        if (courseError) {
          setError(courseError.message);
          setLoading(false);
          return;
        }

        if (!courseData) {
          setError('Course not found');
          setLoading(false);
          return;
        }

        setCourse(courseData);

        // 2) get modules for this course
        const { data: modulesData, error: modulesError } = await supabase
          .from('modules')
          .select('id, title, sort_order')
          .eq('course_id', courseData.id)
          .order('sort_order', { ascending: true });

        if (modulesError) {
          setError(modulesError.message);
          setLoading(false);
          return;
        }

        if (!modulesData || modulesData.length === 0) {
          setModules([]);
          setLoading(false);
          return;
        }

        const moduleIds = modulesData.map((m) => m.id);

        const { data: lessonsData, error: lessonsError } = await supabase
          .from('lessons')
          .select('id, title, module_id, sort_order')
          .in('module_id', moduleIds)
          .order('sort_order', { ascending: true });

        if (lessonsError) {
          setError(lessonsError.message);
          setLoading(false);
          return;
        }

        const modulesWithLessons: Module[] = modulesData.map((m) => ({
          id: m.id,
          title: m.title,
          lessons:
            lessonsData
              ?.filter((l) => l.module_id === m.id)
              .map((l) => ({ id: l.id, title: l.title })) ?? [],
        }));

        setModules(modulesWithLessons);
        setLoading(false);
      } catch (e: any) {
        setError(e.message ?? 'Unknown error');
        setLoading(false);
      }
    }

    if (slug) loadCourse();
  }, [slug]);

  if (loading) {
    return (
      <main style={{ padding: 40 }}>
        <h1>Loading course...</h1>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 40 }}>
        <h1 style={{ color: 'red' }}>Error: {error}</h1>
        <p>Slug: {slug}</p>
        <p>
          <Link href="/dashboard">Back to Dashboard</Link>
        </p>
      </main>
    );
  }

  if (!course) {
    return (
      <main style={{ padding: 40 }}>
        <h1 style={{ color: 'red' }}>Course not found</h1>
        <p>Slug: {slug}</p>
        <p>
          <Link href="/dashboard">Back to Dashboard</Link>
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>{course.title}</h1>
      {course.description && <p>{course.description}</p>}
      {course.ceu_hours && <p>CEUs: {course.ceu_hours}</p>}
      <hr style={{ margin: '16px 0' }} />
      <h2>Modules</h2>
      {modules.length === 0 && <p>No modules yet.</p>}
      {modules.map((m) => (
        <section key={m.id} style={{ marginBottom: 24 }}>
          <h3>{m.title}</h3>
          {m.lessons.length === 0 ? (
            <p>No lessons in this module yet.</p>
          ) : (
            <ul>
              {m.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <Link href={`/lessons/${lesson.id}`}>{lesson.title}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p>
        <Link href="/dashboard">Back to Dashboard</Link>
      </p>
    </main>
  );
}
