"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Course = {
  id: string;
  title?: string;
};

type EnrollmentRow = {
  id: string;
  course_id: string;
};

type Lesson = {
  id: string;
  course_id: string;
};

type LessonProgressRow = {
  lesson_id: string;
};

type CourseWithProgress = {
  enrollmentId: string;
  course: Course;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profileName, setProfileName] = useState<string>("");
  const [inProgressCourses, setInProgressCourses] = useState<CourseWithProgress[]>([]);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [lessonsCompleted, setLessonsCompleted] = useState<number>(0);
  const [recommendedCourses, setRecommendedCourses] = useState<Course[]>([]);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      // 1. Current auth user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("You must be logged in to view the dashboard.");
        setLoading(false);
        return;
      }

      // 2. Profile (name)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name") // change if your column is named differently
        .eq("id", user.id)
        .maybeSingle();

      if (!profileError && profile?.full_name) {
        setProfileName(profile.full_name);
      }

      // 3. Enrollments
      const { data: enrollmentRows, error: enrollError } = await supabase
        .from("course_enrollments")
        .select("id, course_id")
        .eq("user_id", user.id); // adjust if your FK is called something else

      if (enrollError) {
        setError(enrollError.message);
        setLoading(false);
        return;
      }

      const enrollments = (enrollmentRows || []) as EnrollmentRow[];

      // If the user has NO enrollments yet, we only need recommended courses
      if (enrollments.length === 0) {
        const { data: recCourses, error: recError } = await supabase
          .from("courses")
          .select("*") // no specific columns, so no chance of wrong names
          .limit(6);

        if (recError) {
          setError(recError.message);
        } else {
          setRecommendedCourses((recCourses || []) as Course[]);
        }

        setInProgressCourses([]);
        setCompletedCount(0);
        setLessonsCompleted(0);
        setLoading(false);
        return;
      }

      const courseIds = enrollments.map((e) => e.course_id);

      // 4. Courses for those enrollments
      const { data: enrolledCourses, error: coursesError } = await supabase
        .from("courses")
        .select("*") // <-- IMPORTANT: no category/level specified
        .in("id", courseIds);

      if (coursesError) {
        setError(coursesError.message);
        setLoading(false);
        return;
      }

      const coursesById = new Map<string, Course>();
      (enrolledCourses || []).forEach((c) => {
        const course = c as Course;
        coursesById.set(course.id, course);
      });

      // 5. Lessons for those courses
      const { data: lessonRows, error: lessonsError } = await supabase
        .from("lessons")
        .select("id, course_id")
        .in("course_id", courseIds);

      if (lessonsError) {
        setError(lessonsError.message);
        setLoading(false);
        return;
      }

      const lessons = (lessonRows || []) as Lesson[];

      const lessonsByCourse = new Map<string, Lesson[]>();
      lessons.forEach((lesson) => {
        if (!lessonsByCourse.has(lesson.course_id)) {
          lessonsByCourse.set(lesson.course_id, []);
        }
        lessonsByCourse.get(lesson.course_id)!.push(lesson);
      });

      // 6. Lesson progress
      const { data: progressRows, error: progressError } = await supabase
        .from("lesson_progress")
        .select("lesson_id")
        .eq("user_id", user.id);

      if (progressError) {
        setError(progressError.message);
        setLoading(false);
        return;
      }

      const lessonProgress = (progressRows || []) as LessonProgressRow[];
      const completedLessonIds = new Set(
        lessonProgress.map((lp) => lp.lesson_id)
      );

      setLessonsCompleted(completedLessonIds.size);

      // 7. Compute per-course progress
      const courseWithProgress: CourseWithProgress[] = enrollments.map(
        (enrollment) => {
          const course = coursesById.get(enrollment.course_id);
          const courseLessons = lessonsByCourse.get(enrollment.course_id) || [];

          const totalLessons = courseLessons.length;
          const completedLessons = courseLessons.filter((lesson) =>
            completedLessonIds.has(lesson.id)
          ).length;

          const progressPercent =
            totalLessons === 0
              ? 0
              : Math.round((completedLessons / totalLessons) * 100);

          return {
            enrollmentId: enrollment.id,
            course: course || { id: enrollment.course_id },
            progressPercent,
            completedLessons,
            totalLessons,
          };
        }
      );

      const completedCoursesCount = courseWithProgress.filter(
        (c) => c.totalLessons > 0 && c.completedLessons === c.totalLessons
      ).length;

      setCompletedCount(completedCoursesCount);

      const inProgress = courseWithProgress.filter(
        (c) => c.progressPercent < 100
      );
      setInProgressCourses(inProgress);

      // 8. Recommended courses = not enrolled
      const { data: recCourses, error: recError } = await supabase
        .from("courses")
        .select("*") // again, no explicit column list
        .not("id", "in", `(${courseIds.join(",")})`)
        .limit(6);

      if (recError) {
        setError(recError.message);
      } else {
        setRecommendedCourses((recCourses || []) as Course[]);
      }

      setLoading(false);
    };

    loadDashboard();
  }, []);

  const displayName = profileName || "Learner";

  return (
    <div className="dashboard-root">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-profile">
          <div className="avatar-circle">
            {displayName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div>
            <div className="profile-name">{displayName}</div>
            <div className="profile-email">academy@anchorp.com</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button className="nav-item nav-item-active">Dashboard</button>
          <button className="nav-item">My Courses</button>
          <button className="nav-item">Certificates</button>
          <button className="nav-item">Reports</button>
          <button className="nav-item">Settings</button>
        </nav>

        <div className="sidebar-footer">
          <p className="sidebar-footer-title">Active users</p>
          <div className="sidebar-avatars">
            <div className="avatar-sm">AP</div>
            <div className="avatar-sm">RB</div>
            <div className="avatar-sm">KS</div>
            <div className="avatar-count">+12</div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">
        <header className="topbar">
          <div>
            <h1 className="topbar-title">Welcome back, {displayName} 👋</h1>
            <p className="topbar-subtitle">
              View your course progress and discover new training from
              Anchorp Academy.
            </p>
          </div>
          <div className="topbar-actions">
            <button className="btn-secondary">View all courses</button>
            <button className="btn-primary">Resume last course</button>
          </div>
        </header>

        {error && (
          <p style={{ color: "red", marginBottom: 16 }}>
            {error}
          </p>
        )}

        {loading && <p>Loading your dashboard…</p>}

        {!loading && !error && (
          <>
            {/* STATS */}
            <section className="stats-row">
              <div className="stat-card">
                <p className="stat-label">Courses in progress</p>
                <p className="stat-value">{inProgressCourses.length}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Courses completed</p>
                <p className="stat-value">{completedCount}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Lessons completed</p>
                <p className="stat-value">{lessonsCompleted}</p>
              </div>
            </section>

            <section className="content-grid">
              {/* LEFT COLUMN */}
              <div className="column-main">
                {/* IN PROGRESS */}
                <section className="block">
                  <div className="block-header">
                    <h2 className="block-title">In progress</h2>
                    <button className="link-button">View all</button>
                  </div>
                  <div className="course-list">
                    {inProgressCourses.length === 0 && (
                      <p className="course-meta">
                        You don’t have any in-progress courses yet.
                      </p>
                    )}
                    {inProgressCourses.map((item) => (
                      <article
                        key={item.enrollmentId}
                        className="course-card"
                      >
                        <div className="course-card-main">
                          <h3 className="course-title">
                            {item.course.title || "Untitled course"}
                          </h3>
                          <p className="course-meta">
                            {item.completedLessons}/{item.totalLessons} lessons
                            completed
                          </p>
                          <div className="progress-row">
                            <div className="progress-track">
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${item.progressPercent}%`,
                                }}
                              />
                            </div>
                            <span className="progress-label">
                              {item.progressPercent}% complete
                            </span>
                          </div>
                        </div>
                        <button className="btn-primary btn-small">
                          Continue
                        </button>
                      </article>
                    ))}
                  </div>
                </section>

                {/* RECOMMENDED */}
                <section className="block">
                  <div className="block-header">
                    <h2 className="block-title">Recommended for you</h2>
                    <button className="link-button">See more</button>
                  </div>
                  <div className="course-grid">
                    {recommendedCourses.length === 0 && (
                      <p className="course-meta">
                        No additional recommendations right now.
                      </p>
                    )}
                    {recommendedCourses.map((course) => (
                      <article
                        key={course.id}
                        className="course-card-mini"
                      >
                        <h3 className="course-title">
                          {course.title || "Untitled course"}
                        </h3>
                        <p className="course-meta">Course</p>
                        <button className="btn-secondary btn-small">
                          Add to my courses
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              </div>

              {/* RIGHT COLUMN */}
              <aside className="column-side">
                <section className="block map-block">
                  <p className="map-label">Learning path</p>
                  <h2 className="map-title">Anchorp LMS Overview</h2>
                  <p className="map-subtitle">
                    Courses above are pulled directly from your Supabase
                    tables. Progress is based on finished lessons.
                  </p>

                  <div className="map-steps">
                    <div className="map-step map-step-active">
                      <span className="map-step-dot" />
                      <div>
                        <p className="map-step-title">Step 1</p>
                        <p className="map-step-meta">
                          Enroll in your first course.
                        </p>
                      </div>
                    </div>
                    <div className="map-step">
                      <span className="map-step-dot" />
                      <div>
                        <p className="map-step-title">Step 2</p>
                        <p className="map-step-meta">
                          Complete all lessons in a course.
                        </p>
                      </div>
                    </div>
                    <div className="map-step">
                      <span className="map-step-dot" />
                      <div>
                        <p className="map-step-title">Step 3</p>
                        <p className="map-step-meta">
                          Earn certificates & track CEUs.
                        </p>
                      </div>
                    </div>
                  </div>

                  <button className="btn-primary btn-full">
                    View all learning paths
                  </button>
                </section>

                <section className="block">
                  <h3 className="block-title">Browse all courses</h3>
                  <p className="small-block-text">
                    Open the full course catalog powered by your Supabase
                    <code> courses </code> table.
                  </p>
                  <button className="btn-secondary btn-full">
                    See all courses
                  </button>
                </section>
              </aside>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
