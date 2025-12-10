"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  FormEvent,
  useRef,
} from "react";

import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabaseClient";
import AdminSidebar from "../../../../components/AdminSidebar";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: "internal" | "external" | null;
  role: string | null;
};

type Course = {
  id: string;
  title: string;
  slug: string;
};

type Module = {
  id: string;
  course_id: string;
  title: string;
};

type Lesson = {
  id: string;
  module_id: string;
  title: string;
  content: string | null;
};

type LessonResource = {
  id: string;
  lesson_id: string;
  title: string;
  resource_type: "video" | "file" | "link" | "ppt" | "pdf" | "quiz" | string;
  url: string | null;
};

type ResourceFormState = {
  title: string;
  resource_type: "video" | "file" | "link" | "ppt" | "pdf" | "quiz" | "";
  url: string;
};

type Quiz = {
  id: string;
  lesson_id: string;
  title: string;
  pass_score: number | null;
  max_attempts: number | null;
};

type QuizQuestion = {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: string;
  sort_order: number | null;
};

type QuizOption = {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  sort_order: number | null;
};

export default function AdminCourseContentPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params?.courseId as string;

  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(true);

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [resources, setResources] = useState<LessonResource[]>([]);

  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const [loadingStructure, setLoadingStructure] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // inline form state
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonContent, setNewLessonContent] = useState("");

  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editingModuleTitle, setEditingModuleTitle] = useState("");

  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingLessonTitle, setEditingLessonTitle] = useState("");
  const [editingLessonContent, setEditingLessonContent] = useState("");

  const [resourceForm, setResourceForm] = useState<ResourceFormState>({
    title: "",
    resource_type: "",
    url: "",
  });
  const [editingResourceId, setEditingResourceId] = useState<string | null>(
    null
  );

  // drag & drop / file upload state
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // QUIZ STATE
  // ===============================
// ===============================
// QUIZ STATE
// ===============================
const [quizzes, setQuizzes] = useState<Quiz[]>([]);
const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
const [quizOptions, setQuizOptions] = useState<QuizOption[]>([]);

// Form used for creating/updating the quiz metadata
const [quizForm, setQuizForm] = useState({
  title: "",
  pass_score: 7,          // numeric value
  pass_score_label: "Passing Score",      // 🔹 label added
  max_attempts: 3,         // numeric value
  max_attempts_label: "Allowed Attempts", // 🔹 label added
});

const [editingQuizId, setEditingQuizId] = useState<string | null>(null);

// Form used for adding/updating a quiz question + options
const [questionForm, setQuestionForm] = useState({
  question_text: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_option: "A" as "A" | "B" | "C" | "D",
});
const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

// Global UI state
const [saving, setSaving] = useState(false);
const [message, setMessage] = useState<string | null>(null);


  // ---------- AUTH / ADMIN CHECK ----------
  useEffect(() => {
    const loadAdmin = async () => {
      setLoadingAdmin(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, user_type, role")
        .eq("id", session.user.id)
        .single();

      if (error || !data || data.role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      setAdminProfile(data as Profile);
      setLoadingAdmin(false);
    };

    loadAdmin();
  }, [router]);

  // ---------- LOAD COURSE + STRUCTURE ----------
  const loadStructure = useCallback(async () => {
    if (!courseId) return;
    setLoadingStructure(true);
    setError(null);

    try {
      // course
      const { data: courseRow, error: courseError } = await supabase
        .from("courses")
        .select("id, title, slug")
        .eq("id", courseId)
        .single();

      if (courseError || !courseRow) {
        throw courseError || new Error("Course not found");
      }

      setCourse(courseRow as Course);

      // modules
      const { data: moduleRows, error: moduleError } = await supabase
        .from("modules")
        .select("id, course_id, title")
        .eq("course_id", courseId);

      if (moduleError) throw moduleError;

      const moduleList = (moduleRows || []) as Module[];
      setModules(moduleList);

      // lessons
      let lessonList: Lesson[] = [];
      if (moduleList.length) {
        const moduleIds = moduleList.map((m) => m.id);
        const { data: lessonRows, error: lessonError } = await supabase
          .from("lessons")
          .select("id, module_id, title, content")
          .in("module_id", moduleIds);

        if (lessonError) throw lessonError;
        lessonList = (lessonRows || []) as Lesson[];
      }
      setLessons(lessonList);

      // resources
      let resourceList: LessonResource[] = [];
      if (lessonList.length) {
        const lessonIds = lessonList.map((l) => l.id);
        const { data: resourceRows, error: resourceError } = await supabase
          .from("lesson_resources")
          .select("id, lesson_id, title, resource_type, url")
          .in("lesson_id", lessonIds);

        if (resourceError) throw resourceError;
        resourceList = (resourceRows || []) as LessonResource[];
      }
      setResources(resourceList);

      // quizzes
      let quizList: Quiz[] = [];
      if (lessonList.length) {
        const lessonIds = lessonList.map((l) => l.id);
        const { data: quizRows, error: quizError } = await supabase
          .from("quizzes")
          .select("id, lesson_id, title, pass_score, max_attempts")
          .in("lesson_id", lessonIds);

        if (quizError) throw quizError;
        quizList = (quizRows || []) as Quiz[];
      }
      setQuizzes(quizList);

      // quiz questions
      let questionList: QuizQuestion[] = [];
      if (quizList.length) {
        const quizIds = quizList.map((q) => q.id);
        const { data: questionRows, error: questionError } = await supabase
          .from("quiz_questions")
          .select("id, quiz_id, question_text, question_type, sort_order")
          .in("quiz_id", quizIds);

        if (questionError) throw questionError;
        questionList = (questionRows || []) as QuizQuestion[];
      }
      setQuizQuestions(questionList);

      // quiz options
      let optionList: QuizOption[] = [];
      if (questionList.length) {
        const questionIds = questionList.map((q) => q.id);
        const { data: optionRows, error: optionError } = await supabase
          .from("quiz_options")
          .select("id, question_id, option_text, is_correct, sort_order")
          .in("question_id", questionIds);

        if (optionError) throw optionError;
        optionList = (optionRows || []) as QuizOption[];
      }
      setQuizOptions(optionList);

      // default selections
      if (moduleList.length && !selectedModuleId) {
        setSelectedModuleId(moduleList[0].id);
      }
      if (lessonList.length && !selectedLessonId) {
        const baseModuleId = selectedModuleId || moduleList[0]?.id;
        const firstLessonForModule = lessonList.find(
          (l) => l.module_id === baseModuleId
        );
        if (firstLessonForModule) {
          setSelectedLessonId(firstLessonForModule.id);
        }
      }
    } catch (err: any) {
      console.warn("Error loading course structure:", err);
      setError(err?.message ?? "Failed to load course content.");
      setModules([]);
      setLessons([]);
      setResources([]);
      setQuizzes([]);
      setQuizQuestions([]);
      setQuizOptions([]);
    } finally {
      setLoadingStructure(false);
    }
  }, [courseId, selectedLessonId, selectedModuleId]);

  useEffect(() => {
    if (adminProfile?.role === "admin") {
      loadStructure();
    }
  }, [adminProfile, loadStructure]);

  // ---------- DERIVED HELPERS ----------
  const resourcesForSelectedLesson = resources.filter(
    (r) => r.lesson_id === selectedLessonId
  );

  const getQuizForSelectedLesson = (): Quiz | null => {
    if (!selectedLessonId) return null;
    return quizzes.find((q) => q.lesson_id === selectedLessonId) || null;
  };

  const getQuestionsForSelectedQuiz = (quizId: string): QuizQuestion[] =>
    quizQuestions
      .filter((q) => q.quiz_id === quizId)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const getOptionsForQuestion = (questionId: string): QuizOption[] =>
    quizOptions
      .filter((o) => o.question_id === questionId)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const quizForSelectedLesson = getQuizForSelectedLesson();
  const questionsForSelectedQuiz = quizForSelectedLesson
    ? getQuestionsForSelectedQuiz(quizForSelectedLesson.id)
    : [];

  // ---------- MODULE CRUD ----------
  const handleAddModule = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const title = newModuleTitle.trim();
    if (!title || !courseId) return;

    setSaving(true);
    setMessage(null);

    try {
      const { data, error } = await supabase
        .from("modules")
        .insert({
          course_id: courseId,
          title,
        })
        .select("id")
        .single();

      if (error) throw error;

      setNewModuleTitle("");
      setMessage("Module added.");
      await loadStructure();
      setSelectedModuleId(data?.id ?? null);
    } catch (err: any) {
      console.error("Error adding module:", err);
      setMessage(err.message ?? "Error adding module.");
    } finally {
      setSaving(false);
    }
  };

  const startEditModule = (module: Module) => {
    setEditingModuleId(module.id);
    setEditingModuleTitle(module.title);
  };

  const cancelEditModule = () => {
    setEditingModuleId(null);
    setEditingModuleTitle("");
  };

  const handleSaveModuleTitle = async (moduleId: string) => {
    const title = editingModuleTitle.trim();
    if (!title) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from("modules")
        .update({ title })
        .eq("id", moduleId);

      if (error) throw error;

      setMessage("Module updated.");
      setEditingModuleId(null);
      setEditingModuleTitle("");
      await loadStructure();
    } catch (err: any) {
      console.error("Error updating module:", err);
      setMessage(err.message ?? "Error updating module.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    const confirmDelete = window.confirm(
      "Delete this module and all its lessons & resources?"
    );
    if (!confirmDelete) return;

    setSaving(true);
    setMessage(null);

    try {
      const moduleLessons = lessons.filter((l) => l.module_id === moduleId);
      const lessonIds = moduleLessons.map((l) => l.id);

      if (lessonIds.length) {
        await supabase
          .from("lesson_resources")
          .delete()
          .in("lesson_id", lessonIds);
        await supabase.from("lessons").delete().in("id", lessonIds);
      }

      const { error } = await supabase
        .from("modules")
        .delete()
        .eq("id", moduleId);

      if (error) throw error;

      setMessage("Module deleted.");
      if (selectedModuleId === moduleId) {
        setSelectedModuleId(null);
        setSelectedLessonId(null);
      }
      await loadStructure();
    } catch (err: any) {
      console.error("Error deleting module:", err);
      setMessage(err.message ?? "Error deleting module.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- LESSON CRUD ----------
  const handleAddLesson = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedModuleId) {
      setMessage("Select a module before adding a lesson.");
      return;
    }

    const title = newLessonTitle.trim();
    if (!title) return;

    setSaving(true);
    setMessage(null);

    try {
      const { data, error } = await supabase
        .from("lessons")
        .insert({
          module_id: selectedModuleId,
          title,
          content: newLessonContent.trim() || null,
        })
        .select("id")
        .single();

      if (error) throw error;

      setNewLessonTitle("");
      setNewLessonContent("");
      setMessage("Lesson added.");
      await loadStructure();
      setSelectedLessonId(data?.id ?? null);
    } catch (err: any) {
      console.error("Error adding lesson:", err);
      setMessage(err.message ?? "Error adding lesson.");
    } finally {
      setSaving(false);
    }
  };

  const startEditLesson = (lesson: Lesson) => {
    setEditingLessonId(lesson.id);
    setEditingLessonTitle(lesson.title);
    setEditingLessonContent(lesson.content ?? "");
  };

  const cancelEditLesson = () => {
    setEditingLessonId(null);
    setEditingLessonTitle("");
    setEditingLessonContent("");
  };

  const handleSaveLesson = async (lessonId: string) => {
    const title = editingLessonTitle.trim();
    if (!title) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from("lessons")
        .update({
          title,
          content: editingLessonContent.trim() || null,
        })
        .eq("id", lessonId);

      if (error) throw error;

      setMessage("Lesson updated.");
      setEditingLessonId(null);
      setEditingLessonTitle("");
      setEditingLessonContent("");
      await loadStructure();
    } catch (err: any) {
      console.error("Error updating lesson:", err);
      setMessage(err.message ?? "Error updating lesson.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    const confirmDelete = window.confirm(
      "Delete this lesson and all attached resources?"
    );
    if (!confirmDelete) return;

    setSaving(true);
    setMessage(null);

    try {
      await supabase
        .from("lesson_resources")
        .delete()
        .eq("lesson_id", lessonId);

      const { error } = await supabase
        .from("lessons")
        .delete()
        .eq("id", lessonId);

      if (error) throw error;

      setMessage("Lesson deleted.");
      if (selectedLessonId === lessonId) {
        setSelectedLessonId(null);
      }
      await loadStructure();
    } catch (err: any) {
      console.error("Error deleting lesson:", err);
      setMessage(err.message ?? "Error deleting lesson.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- RESOURCE HELPERS (drag & drop) ----------
  const handleResourceInputChange = (
    field: keyof ResourceFormState,
    value: string
  ) => {
    setResourceForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFileSelected = (file: File | null) => {
    if (!file) {
      setResourceFile(null);
      return;
    }
    setResourceFile(file);

    // just show the file name in the URL field so the admin sees *something*
    setResourceForm((prev) => ({
      ...prev,
      url: file.name,
    }));
  };

  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  };

  const handleDragOverFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleDragLeaveFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  // ---------- RESOURCE CRUD ----------
  const handleAddOrUpdateResource = async (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  if (!selectedLessonId) {
    setMessage("Select a lesson before adding resources.");
    return;
  }

  const title = resourceForm.title.trim();
  const type = resourceForm.resource_type;
  const url = resourceForm.url.trim();

  if (!title || !type) {
    setMessage("Please enter a title and choose a resource type.");
    return;
  }

  setSaving(true);
  setMessage(null);

  try {
    // what we will store
    let finalUrl: string | null = url || null;
    // storage_path MUST be non-null because of your DB constraint
    // default to url or a dummy string so it's never null
    let storagePath: string = url || "";

    // If a file was dropped/selected and this is a file-type resource,
    // upload it to Supabase Storage and get a public URL + storage path.
    if (resourceFile && type !== "link" && type !== "quiz") {
      const ext = resourceFile.name.split(".").pop();
      const filePath = `${selectedLessonId}/${Date.now()}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("course-videos") // ⬅️ your actual bucket name
        .upload(filePath, resourceFile);

      if (uploadError) throw uploadError;

      // public URL
      const { data: publicData } = supabase.storage
        .from("course-videos")
        .getPublicUrl(uploadData.path);

      finalUrl = publicData.publicUrl;
      storagePath = uploadData.path; // <- this satisfies NOT NULL storage_path
    }

    if (!editingResourceId) {
      const { error } = await supabase.from("lesson_resources").insert({
        lesson_id: selectedLessonId,
        title,
        resource_type: type,
        url: finalUrl,
        storage_path: storagePath,
      });

      if (error) throw error;
      setMessage("Resource added.");
    } else {
      const { error } = await supabase
        .from("lesson_resources")
        .update({
          title,
          resource_type: type,
          url: finalUrl,
          storage_path: storagePath,
        })
        .eq("id", editingResourceId);

      if (error) throw error;
      setMessage("Resource updated.");
    }

    setResourceForm({ title: "", resource_type: "", url: "" });
    setResourceFile(null);
    setEditingResourceId(null);
    await loadStructure();
  } catch (err: any) {
    console.error("Error saving resource:", err);
    setMessage(err.message ?? "Error saving resource.");
  } finally {
    setSaving(false);
  }
};

const startEditResource = (resource: LessonResource) => {
  setEditingResourceId(resource.id);
  setResourceForm({
    title: resource.title,
    resource_type: resource.resource_type as ResourceFormState["resource_type"],
    url: resource.url ?? "",
  });
  setResourceFile(null);
};

const cancelEditResource = () => {
  setEditingResourceId(null);
  setResourceForm({ title: "", resource_type: "", url: "" });
  setResourceFile(null);
};

const handleDeleteResource = async (resourceId: string) => {
  const confirmDelete = window.confirm("Delete this resource?");
  if (!confirmDelete) return;

  setSaving(true);
  setMessage(null);

  try {
    const { error } = await supabase
      .from("lesson_resources")
      .delete()
      .eq("id", resourceId);

    if (error) throw error;

    setMessage("Resource deleted.");
    if (editingResourceId === resourceId) {
      cancelEditResource();
    }
    await loadStructure();
  } catch (err: any) {
    console.error("Error deleting resource:", err);
    setMessage(err.message ?? "Error deleting resource.");
  } finally {
    setSaving(false);
  }
};



  // ---------- QUIZ CRUD ----------
  const handleSaveQuiz = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedLessonId) {
      setMessage("Select a lesson before configuring a quiz.");
      return;
    }

    const currentQuiz = getQuizForSelectedLesson();

    const title = quizForm.title.trim() || currentQuiz?.title || "Quiz";
    const passScore = quizForm.pass_score;
    const maxAttempts = quizForm.max_attempts;

    setSaving(true);
    setMessage(null);

    try {
      if (!currentQuiz) {
        const { error } = await supabase.from("quizzes").insert({
          lesson_id: selectedLessonId,
          title,
          pass_score: passScore,
          max_attempts: maxAttempts,
        });

        if (error) throw error;
        setMessage("Quiz created.");
      } else {
        const { error } = await supabase
          .from("quizzes")
          .update({
            title,
            pass_score: passScore,
            max_attempts: maxAttempts,
          })
          .eq("id", currentQuiz.id);

        if (error) throw error;
        setMessage("Quiz updated.");
      }

      setEditingQuizId(null);
      await loadStructure();
    } catch (err: any) {
      console.error("Error saving quiz:", err);
      setMessage(err.message ?? "Error saving quiz.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuiz = async () => {
    const currentQuiz = getQuizForSelectedLesson();
    if (!currentQuiz) return;

    const confirmDelete = window.confirm(
      "Delete this quiz and all its questions & options?"
    );
    if (!confirmDelete) return;

    setSaving(true);
    setMessage(null);

    try {
      const questions = quizQuestions.filter(
        (q) => q.quiz_id === currentQuiz.id
      );
      const questionIds = questions.map((q) => q.id);

      if (questionIds.length) {
        await supabase
          .from("quiz_options")
          .delete()
          .in("question_id", questionIds);
        await supabase.from("quiz_questions").delete().in("id", questionIds);
      }

      const { error } = await supabase
        .from("quizzes")
        .delete()
        .eq("id", currentQuiz.id);

      if (error) throw error;

      setMessage("Quiz deleted.");
      setEditingQuestionId(null);
      setQuestionForm({
        question_text: "",
        option_a: "",
        option_b: "",
        option_c: "",
        option_d: "",
        correct_option: "A",
      });
      await loadStructure();
    } catch (err: any) {
      console.error("Error deleting quiz:", err);
      setMessage(err.message ?? "Error deleting quiz.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQuestion = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const currentQuiz = getQuizForSelectedLesson();
    if (!currentQuiz) {
      setMessage("Create a quiz before adding questions.");
      return;
    }

    const {
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
    } = questionForm;

    if (!question_text.trim() || !option_a.trim() || !option_b.trim()) {
      setMessage("Question, option A, and option B are required.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      let questionId = editingQuestionId;

      if (!editingQuestionId) {
        const sortOrder =
          (questionsForSelectedQuiz[questionsForSelectedQuiz.length - 1]
            ?.sort_order || 0) + 1;

        const { data, error } = await supabase
          .from("quiz_questions")
          .insert({
            quiz_id: currentQuiz.id,
            question_text: question_text.trim(),
            question_type: "multiple_choice",
            sort_order: sortOrder,
          })
          .select("id")
          .single();

        if (error) throw error;
        questionId = data.id as string;
      } else {
        const { error } = await supabase
          .from("quiz_questions")
          .update({
            question_text: question_text.trim(),
          })
          .eq("id", editingQuestionId);

        if (error) throw error;

        await supabase
          .from("quiz_options")
          .delete()
          .eq("question_id", editingQuestionId);
      }

      if (!questionId) throw new Error("Missing question ID after save.");

      const optionsToInsert: any[] = [];
      let sort = 1;

      const addOption = (text: string, letter: "A" | "B" | "C" | "D") => {
        if (!text.trim()) return;
        optionsToInsert.push({
          question_id: questionId,
          option_text: text.trim(),
          is_correct: correct_option === letter,
          sort_order: sort++,
        });
      };

      addOption(option_a, "A");
      addOption(option_b, "B");
      addOption(option_c, "C");
      addOption(option_d, "D");

      if (optionsToInsert.length) {
        const { error: optError } = await supabase
          .from("quiz_options")
          .insert(optionsToInsert);
        if (optError) throw optError;
      }

      setMessage(editingQuestionId ? "Question updated." : "Question added.");
      setEditingQuestionId(null);
      setQuestionForm({
        question_text: "",
        option_a: "",
        option_b: "",
        option_c: "",
        option_d: "",
        correct_option: "A",
      });

      await loadStructure();
    } catch (err: any) {
      console.error("Error saving question:", err);
      setMessage(err.message ?? "Error saving question.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    const confirmDelete = window.confirm("Delete this question?");
    if (!confirmDelete) return;

    setSaving(true);
    setMessage(null);

    try {
      await supabase.from("quiz_options").delete().eq("question_id", questionId);
      const { error } = await supabase
        .from("quiz_questions")
        .delete()
        .eq("id", questionId);

      if (error) throw error;

      setMessage("Question deleted.");
      if (editingQuestionId === questionId) {
        setEditingQuestionId(null);
      }
      await loadStructure();
    } catch (err: any) {
      console.error("Error deleting question:", err);
      setMessage(err.message ?? "Error deleting question.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- RENDER ----------
  if (loadingAdmin || !adminProfile) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }

  return (
    <div className="dashboard-root">
      <AdminSidebar
        active="courses"
        fullName={adminProfile.full_name}
        email={adminProfile.email}
      />

      <div className="main">
        {/* TOP BAR */}
        <div className="topbar">
          <div>
            <div className="topbar-title">
              {course ? `Manage Content: ${course.title}` : "Manage Content"}
            </div>
            <div className="topbar-subtitle">
              Build modules, lessons, and resources for this Anchor Academy
              course.
            </div>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.push("/admin/courses")}
          >
            ← Back to Courses
          </button>
        </div>

        {error && (
          <p
            style={{
              marginBottom: 12,
              fontSize: 12,
              color: "#b91c1c",
            }}
          >
            {error}
          </p>
        )}

        {message && (
          <p
            style={{
              marginBottom: 12,
              fontSize: 12,
              color: message.toLowerCase().includes("error")
                ? "#b91c1c"
                : "#047857",
            }}
          >
            {message}
          </p>
        )}

        <div className="content-grid">
          {/* LEFT COLUMN: MODULES & LESSONS */}
          <div className="column-main">
            <div className="block">
              <div className="block-header">
                <div className="block-title">Course Outline</div>
              </div>
              <p className="small-block-text">
                Add modules and lessons to structure your course. Each lesson
                can have multiple videos, files, quizzes, and more.
              </p>

              {loadingStructure ? (
                <p className="small-block-text">Loading outline…</p>
              ) : (
                <>
                  {/* Modules list */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      marginBottom: 16,
                    }}
                  >
                    {modules.map((m) => {
                      const isActive = selectedModuleId === m.id;
                      const lessonsForModule = lessons.filter(
                        (l) => l.module_id === m.id
                      );

                      return (
                        <div
                          key={m.id}
                          style={{
                            borderRadius: 12,
                            border: "1px solid #e5e7eb",
                            padding: 10,
                            background: isActive ? "#ecfdf5" : "#ffffff",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            {editingModuleId === m.id ? (
                              <input
                                type="text"
                                value={editingModuleTitle}
                                onChange={(e) =>
                                  setEditingModuleTitle(e.target.value)
                                }
                                style={{
                                  flex: 1,
                                  padding: "6px 8px",
                                  borderRadius: 999,
                                  border: "1px solid #d1d5db",
                                  fontSize: 13,
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSelectedModuleId(m.id)}
                                style={{
                                  flex: 1,
                                  textAlign: "left",
                                  background: "none",
                                  border: "none",
                                  padding: 0,
                                  fontSize: 14,
                                  fontWeight: 600,
                                  color: "#111827",
                                  cursor: "pointer",
                                }}
                              >
                                {m.title}
                              </button>
                            )}

                            {editingModuleId === m.id ? (
                              <>
                                <button
                                  type="button"
                                  className="btn-primary"
                                  style={{ fontSize: 12, padding: "4px 10px" }}
                                  onClick={() => handleSaveModuleTitle(m.id)}
                                  disabled={saving}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ fontSize: 12, padding: "4px 10px" }}
                                  onClick={cancelEditModule}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ fontSize: 12, padding: "4px 10px" }}
                                  onClick={() => startEditModule(m)}
                                >
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{
                                    fontSize: 12,
                                    padding: "4px 10px",
                                    background: "#fee2e2",
                                    color: "#b91c1c",
                                  }}
                                  onClick={() => handleDeleteModule(m.id)}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>

                          {/* Lessons for this module */}
                          {selectedModuleId === m.id && (
                            <div
                              style={{
                                marginTop: 8,
                                paddingTop: 8,
                                borderTop: "1px solid #e5e7eb",
                              }}
                            >
                              {lessonsForModule.map((l) => {
                                const isLessonActive =
                                  selectedLessonId === l.id;
                                return (
                                  <div
                                    key={l.id}
                                    style={{
                                      borderRadius: 10,
                                      padding: 8,
                                      marginBottom: 6,
                                      background: isLessonActive
                                        ? "#eff6ff"
                                        : "#f9fafb",
                                      border: "1px solid #e5e7eb",
                                    }}
                                  >
                                    {editingLessonId === l.id ? (
                                      <>
                                        <input
                                          type="text"
                                          value={editingLessonTitle}
                                          onChange={(e) =>
                                            setEditingLessonTitle(
                                              e.target.value
                                            )
                                          }
                                          style={{
                                            width: "100%",
                                            padding: "6px 8px",
                                            borderRadius: 999,
                                            border: "1px solid #d1d5db",
                                            fontSize: 13,
                                            marginBottom: 4,
                                          }}
                                        />
                                        <textarea
                                          value={editingLessonContent}
                                          onChange={(e) =>
                                            setEditingLessonContent(
                                              e.target.value
                                            )
                                          }
                                          rows={2}
                                          placeholder="Optional short description / notes"
                                          style={{
                                            width: "100%",
                                            padding: "6px 8px",
                                            borderRadius: 10,
                                            border: "1px solid #d1d5db",
                                            fontSize: 12,
                                            marginBottom: 4,
                                          }}
                                        />
                                        <div
                                          style={{
                                            display: "flex",
                                            gap: 6,
                                          }}
                                        >
                                          <button
                                            type="button"
                                            className="btn-primary"
                                            style={{
                                              fontSize: 12,
                                              padding: "4px 10px",
                                            }}
                                            onClick={() =>
                                              handleSaveLesson(l.id)
                                            }
                                            disabled={saving}
                                          >
                                            Save
                                          </button>
                                          <button
                                            type="button"
                                            className="btn-secondary"
                                            style={{
                                              fontSize: 12,
                                              padding: "4px 10px",
                                            }}
                                            onClick={cancelEditLesson}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setSelectedLessonId(l.id)
                                          }
                                          style={{
                                            background: "none",
                                            border: "none",
                                            padding: 0,
                                            textAlign: "left",
                                            width: "100%",
                                            cursor: "pointer",
                                          }}
                                        >
                                          <div
                                            style={{
                                              fontSize: 13,
                                              fontWeight: 600,
                                              color: "#111827",
                                            }}
                                          >
                                            {l.title}
                                          </div>
                                          {l.content && (
                                            <div
                                              style={{
                                                fontSize: 12,
                                                color: "#6b7280",
                                                marginTop: 2,
                                              }}
                                            >
                                              {l.content}
                                            </div>
                                          )}
                                        </button>
                                        <div
                                          style={{
                                            display: "flex",
                                            gap: 6,
                                            marginTop: 4,
                                          }}
                                        >
                                          <button
                                            type="button"
                                            className="btn-secondary"
                                            style={{
                                              fontSize: 11,
                                              padding: "3px 8px",
                                            }}
                                            onClick={() => startEditLesson(l)}
                                          >
                                            Edit
                                          </button>
                                          <button
                                            type="button"
                                            className="btn-secondary"
                                            style={{
                                              fontSize: 11,
                                              padding: "3px 8px",
                                              background: "#fee2e2",
                                              color: "#b91c1c",
                                            }}
                                            onClick={() =>
                                              handleDeleteLesson(l.id)
                                            }
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Add lesson form */}
                              <form
                                onSubmit={handleAddLesson}
                                style={{
                                  marginTop: 8,
                                  paddingTop: 8,
                                  borderTop: "1px dashed #d1d5db",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 6,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: "#4b5563",
                                  }}
                                >
                                  Add lesson
                                </div>
                                <input
                                  type="text"
                                  value={newLessonTitle}
                                  onChange={(e) =>
                                    setNewLessonTitle(e.target.value)
                                  }
                                  placeholder="Lesson title"
                                  style={{
                                    width: "100%",
                                    padding: "6px 8px",
                                    borderRadius: 999,
                                    border: "1px solid #d1d5db",
                                    fontSize: 13,
                                  }}
                                />
                                <textarea
                                  value={newLessonContent}
                                  onChange={(e) =>
                                    setNewLessonContent(e.target.value)
                                  }
                                  placeholder="Optional short description / notes"
                                  rows={2}
                                  style={{
                                    width: "100%",
                                    padding: "6px 8px",
                                    borderRadius: 10,
                                    border: "1px solid #d1d5db",
                                    fontSize: 12,
                                  }}
                                />
                                <button
                                  type="submit"
                                  className="btn-primary"
                                  style={{ alignSelf: "flex-start" }}
                                  disabled={saving}
                                >
                                  Add lesson
                                </button>
                              </form>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add module form */}
                  <form
                    onSubmit={handleAddModule}
                    style={{ display: "flex", gap: 8, marginTop: 4 }}
                  >
                    <input
                      type="text"
                      value={newModuleTitle}
                      onChange={(e) => setNewModuleTitle(e.target.value)}
                      placeholder="New module title"
                      style={{
                        flex: 1,
                        padding: "8px 10px",
                        borderRadius: 999,
                        border: "1px solid #d1d5db",
                        fontSize: 13,
                      }}
                    />
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={saving}
                    >
                      Add module
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: RESOURCES + QUIZ */}
          <div className="column-side">
            {/* LESSON RESOURCES */}
            <div className="block">
              <div className="block-header">
                <div className="block-title">Lesson Resources</div>
              </div>
              <p className="small-block-text">
                Attach videos, slide decks, PDFs, links, or quizzes to the
                selected lesson. Learners will see these in order.
              </p>

              {!selectedLessonId ? (
                <p className="small-block-text">
                  Select a module and lesson on the left to manage its
                  resources.
                </p>
              ) : (
                <>
                  {/* Existing resources */}
                  {resourcesForSelectedLesson.length === 0 ? (
                    <p className="small-block-text">
                      No resources yet. Add your first video, PowerPoint link,
                      or quiz below.
                    </p>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        marginBottom: 12,
                      }}
                    >
                      {resourcesForSelectedLesson.map((r) => (
                        <div
                          key={r.id}
                          style={{
                            borderRadius: 10,
                            border: "1px solid #e5e7eb",
                            padding: 8,
                            background: "#f9fafb",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: "#111827",
                                }}
                              >
                                {r.title}
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#6b7280",
                                  marginTop: 2,
                                }}
                              >
                                Type: {r.resource_type}
                                {r.url && (
                                  <>
                                    {" • "}
                                    <a
                                      href={r.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        color: "#047857",
                                        textDecoration: "underline",
                                      }}
                                    >
                                      Open link
                                    </a>
                                  </>
                                )}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{
                                  fontSize: 11,
                                  padding: "3px 8px",
                                }}
                                onClick={() => startEditResource(r)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{
                                  fontSize: 11,
                                  padding: "3px 8px",
                                  background: "#fee2e2",
                                  color: "#b91c1c",
                                }}
                                onClick={() => handleDeleteResource(r.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add / edit resource form */}
                  <form
                    onSubmit={handleAddOrUpdateResource}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      marginTop: 4,
                      borderTop: "1px dashed #d1d5db",
                      paddingTop: 10,
                    }}
                  >
                    {/* Drag & drop upload zone */}
                    <div
                      onDrop={handleDropFile}
                      onDragOver={handleDragOverFile}
                      onDragLeave={handleDragLeaveFile}
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        borderRadius: 12,
                        border: "1px dashed #d1d5db",
                        padding: 12,
                        textAlign: "center",
                        fontSize: 12,
                        cursor: "pointer",
                        background: isDraggingFile ? "#ecfdf5" : "#f9fafb",
                      }}
                    >
                      {resourceFile ? (
                        <>
                          Selected file:{" "}
                          <strong>{resourceFile.name}</strong> (click to change)
                        </>
                      ) : (
                        <>Drag &amp; drop a video/PDF/PPT here, or click to browse</>
                      )}
                    </div>

                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      accept="video/*,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      onChange={(e) =>
                        handleFileSelected(e.target.files?.[0] ?? null)
                      }
                    />

                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#4b5563",
                      }}
                    >
                      {editingResourceId ? "Edit resource" : "Add resource"}
                    </div>

                    <input
                      type="text"
                      value={resourceForm.title}
                      onChange={(e) =>
                        handleResourceInputChange("title", e.target.value)
                      }
                      placeholder="Resource title (e.g. 'Introduction video')"
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 999,
                        border: "1px solid #d1d5db",
                        fontSize: 13,
                      }}
                    />

                    <select
                      value={resourceForm.resource_type}
                      onChange={(e) =>
                        handleResourceInputChange(
                          "resource_type",
                          e.target.value as ResourceFormState["resource_type"]
                        )
                      }
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 999,
                        border: "1px solid #d1d5db",
                        fontSize: 13,
                      }}
                    >
                      <option value="">Choose resource type…</option>
                      <option value="video">Video</option>
                      <option value="ppt">PowerPoint / slides</option>
                      <option value="pdf">PDF</option>
                      <option value="file">File download</option>
                      <option value="link">External link</option>
                      <option value="quiz">Quiz</option>
                    </select>

                    <input
                      type="text"
                      value={resourceForm.url}
                      onChange={(e) =>
                        handleResourceInputChange("url", e.target.value)
                      }
                      placeholder="URL to video, file, or quiz (optional for some types)"
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 999,
                        border: "1px solid #d1d5db",
                        fontSize: 13,
                      }}
                    />

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginTop: 2,
                      }}
                    >
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={saving}
                      >
                        {saving
                          ? "Saving…"
                          : editingResourceId
                          ? "Save changes"
                          : "Add resource"}
                      </button>
                      {editingResourceId && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={cancelEditResource}
                          disabled={saving}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </>
              )}
            </div>

            {/* QUIZ BUILDER */}
            <div className="block" style={{ marginTop: 16 }}>
              <div className="block-header">
                <div className="block-title">Quiz</div>
              </div>
              <p className="small-block-text">
                Create a quiz for this lesson. Learners will answer questions at
                the end of the lesson.
              </p>

              {!selectedLessonId ? (
                <p className="small-block-text">
                  Select a lesson on the left to configure its quiz.
                </p>
              ) : (
                <>
                  {/* Quiz config */}
                  <form
                    onSubmit={handleSaveQuiz}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      marginTop: 8,
                      paddingBottom: 8,
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <input
                      type="text"
                      value={quizForm.title}
                      onChange={(e) =>
                        setQuizForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      placeholder={
                        quizForSelectedLesson?.title || "Quiz title (e.g. 'Final Quiz')"
                      }
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 999,
                        border: "1px solid #d1d5db",
                        fontSize: 13,
                      }}
                    />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
  <label
    style={{
      fontSize: 12,
      fontWeight: 500,
      color: "#4b5563",
      marginBottom: 4,
    }}
  >
    Passing Score
  </label>

  <input
    type="number"
    min={1}
    value={quizForm.pass_score}
    onChange={(e) =>
      setQuizForm((prev) => ({
        ...prev,
        pass_score: Number(e.target.value),
      }))
    }
    placeholder="7"
    style={{
      width: "100%",
      padding: "8px 10px",
      borderRadius: 999,
      border: "1px solid #d1d5db",
      fontSize: 13,
    }}
  />
</div>

                    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
  <label
    style={{
      fontSize: 12,
      fontWeight: 500,
      color: "#4b5563",
      marginBottom: 4,
    }}
  >
    Allowed Attempts
  </label>

  <input
    type="number"
    min={1}
    value={quizForm.max_attempts}
    onChange={(e) =>
      setQuizForm((prev) => ({
        ...prev,
        max_attempts: Number(e.target.value),
      }))
    }
    placeholder="3"
    style={{
      width: "100%",
      padding: "8px 10px",
      borderRadius: 999,
      border: "1px solid #d1d5db",
      fontSize: 13,
    }}
  />
</div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={saving}
                      >
                        {quizForSelectedLesson ? "Save quiz" : "Create quiz"}
                      </button>
                      {quizForSelectedLesson && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ background: "#fee2e2", color: "#b91c1c" }}
                          onClick={handleDeleteQuiz}
                          disabled={saving}
                        >
                          Delete quiz
                        </button>
                      )}
                    </div>
                  </form>

                  {/* Questions list / form */}
                  {quizForSelectedLesson ? (
                    <>
                      {questionsForSelectedQuiz.length === 0 ? (
                        <p
                          className="small-block-text"
                          style={{ marginTop: 8 }}
                        >
                          No questions yet. Add your first question below.
                        </p>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            marginTop: 8,
                          }}
                        >
                          {questionsForSelectedQuiz.map((q) => {
                            const opts = getOptionsForQuestion(q.id);
                            return (
                              <div
                                key={q.id}
                                style={{
                                  borderRadius: 10,
                                  border: "1px solid #e5e7eb",
                                  padding: 8,
                                  background: "#f9fafb",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    marginBottom: 4,
                                  }}
                                >
                                  {q.question_text}
                                </div>
                                <ul
                                  style={{
                                    fontSize: 12,
                                    marginLeft: 16,
                                    marginBottom: 4,
                                  }}
                                >
                                  {opts.map((o, idx) => (
                                    <li key={o.id}>
                                      {String.fromCharCode(65 + idx)}.{" "}
                                      {o.option_text} {o.is_correct && "✓"}
                                    </li>
                                  ))}
                                </ul>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{ fontSize: 11, padding: "3px 8px" }}
                                    onClick={() => {
                                      setEditingQuestionId(q.id);
                                      const options = getOptionsForQuestion(
                                        q.id
                                      );
                                      const correctIndex = options.findIndex(
                                        (o) => o.is_correct
                                      );
                                      setQuestionForm({
                                        question_text: q.question_text,
                                        option_a: options[0]?.option_text || "",
                                        option_b: options[1]?.option_text || "",
                                        option_c: options[2]?.option_text || "",
                                        option_d: options[3]?.option_text || "",
                                        correct_option:
                                          (["A", "B", "C", "D"][
                                            correctIndex >= 0
                                              ? correctIndex
                                              : 0
                                          ] as "A" | "B" | "C" | "D"),
                                      });
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{
                                      fontSize: 11,
                                      padding: "3px 8px",
                                      background: "#fee2e2",
                                      color: "#b91c1c",
                                    }}
                                    onClick={() => handleDeleteQuestion(q.id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add / edit question form */}
                      <form
                        onSubmit={handleSaveQuestion}
                        style={{
                          marginTop: 10,
                          borderTop: "1px dashed #d1d5db",
                          paddingTop: 8,
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: "#4b5563",
                          }}
                        >
                          {editingQuestionId ? "Edit question" : "Add question"}
                        </div>
                        <textarea
                          value={questionForm.question_text}
                          onChange={(e) =>
                            setQuestionForm((prev) => ({
                              ...prev,
                              question_text: e.target.value,
                            }))
                          }
                          placeholder="Question text"
                          rows={2}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 10,
                            border: "1px solid #d1d5db",
                            fontSize: 12,
                          }}
                        />
                        <input
                          type="text"
                          value={questionForm.option_a}
                          onChange={(e) =>
                            setQuestionForm((prev) => ({
                              ...prev,
                              option_a: e.target.value,
                            }))
                          }
                          placeholder="Option A"
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 999,
                            border: "1px solid #d1d5db",
                            fontSize: 12,
                          }}
                        />
                        <input
                          type="text"
                          value={questionForm.option_b}
                          onChange={(e) =>
                            setQuestionForm((prev) => ({
                              ...prev,
                              option_b: e.target.value,
                            }))
                          }
                          placeholder="Option B"
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 999,
                            border: "1px solid #d1d5db",
                            fontSize: 12,
                          }}
                        />
                        <input
                          type="text"
                          value={questionForm.option_c}
                          onChange={(e) =>
                            setQuestionForm((prev) => ({
                              ...prev,
                              option_c: e.target.value,
                            }))
                          }
                          placeholder="Option C (optional)"
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 999,
                            border: "1px solid #d1d5db",
                            fontSize: 12,
                          }}
                        />
                        <input
                          type="text"
                          value={questionForm.option_d}
                          onChange={(e) =>
                            setQuestionForm((prev) => ({
                              ...prev,
                              option_d: e.target.value,
                            }))
                          }
                          placeholder="Option D (optional)"
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 999,
                            border: "1px solid #d1d5db",
                            fontSize: 12,
                          }}
                        />
                        <select
                          value={questionForm.correct_option}
                          onChange={(e) =>
                            setQuestionForm((prev) => ({
                              ...prev,
                              correct_option: e.target
                                .value as "A" | "B" | "C" | "D",
                            }))
                          }
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 999,
                            border: "1px solid #d1d5db",
                            fontSize: 12,
                          }}
                        >
                          <option value="A">Correct answer: A</option>
                          <option value="B">Correct answer: B</option>
                          <option value="C">Correct answer: C</option>
                          <option value="D">Correct answer: D</option>
                        </select>

                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="submit"
                            className="btn-primary"
                            disabled={saving}
                          >
                            {editingQuestionId
                              ? "Save question"
                              : "Add question"}
                          </button>
                          {editingQuestionId && (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => {
                                setEditingQuestionId(null);
                                setQuestionForm({
                                  question_text: "",
                                  option_a: "",
                                  option_b: "",
                                  option_c: "",
                                  option_d: "",
                                  correct_option: "A",
                                });
                              }}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </form>
                    </>
                  ) : (
                    <p className="small-block-text" style={{ marginTop: 8 }}>
                      Create a quiz above, then add questions.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
