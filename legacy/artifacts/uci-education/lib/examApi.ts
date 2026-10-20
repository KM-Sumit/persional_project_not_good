import { apiFetch } from "./apiFetch";
import type {
  ExamCategory,
  Exam,
  TestSummary,
  ScheduledTestAdmin,
  ScheduledTestStatsResponse,
  PyqPaperAdmin,
  TestAttemptSession,
  AttemptResult,
  TestQuestion,
} from "@/types/content";

// ─── STUDENT APIS ───

export async function fetchCategories(): Promise<{ categories: ExamCategory[] }> {
  return apiFetch<{ categories: ExamCategory[] }>("/api/categories");
}

export async function fetchExam(id: number): Promise<{ exam: Exam }> {
  return apiFetch<{ exam: Exam }>(`/api/exams/${id}`);
}

export async function fetchExamTests(
  id: number,
  params: { type?: string; year?: number; shift?: string; search?: string } = {},
): Promise<{ tests: TestSummary[] }> {
  const query = new URLSearchParams();
  if (params.type) query.set("type", params.type);
  if (params.year) query.set("year", String(params.year));
  if (params.shift) query.set("shift", params.shift);
  if (params.search) query.set("search", params.search);
  const qStr = query.toString();
  return apiFetch<{ tests: TestSummary[] }>(`/api/exams/${id}/tests${qStr ? `?${qStr}` : ""}`);
}

export async function fetchScheduledTests(): Promise<{ tests: TestSummary[] }> {
  return apiFetch<{ tests: TestSummary[] }>("/api/scheduled-tests");
}

export async function fetchAllTests(params: { search?: string; type?: string } = {}): Promise<{ tests: TestSummary[] }> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.type) query.set("type", params.type);
  const qStr = query.toString();
  return apiFetch<{ tests: TestSummary[] }>(`/api/tests${qStr ? `?${qStr}` : ""}`);
}

export async function fetchTestDetails(id: number): Promise<{ test: TestSummary }> {
  return apiFetch<{ test: TestSummary }>(`/api/tests/${id}`);
}

export async function verifyScheduledTestAccess(
  testId: number,
  password: string,
): Promise<{ verified: boolean; message: string }> {
  return apiFetch<{ verified: boolean; message: string }>(`/api/tests/${testId}/verify-access`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function startScheduledOrPyqTest(
  testId: number,
  password?: string,
): Promise<TestAttemptSession> {
  return apiFetch<TestAttemptSession>(`/api/tests/${testId}/start`, {
    method: "POST",
    body: JSON.stringify({ password: password ?? "" }),
  });
}

export async function submitExamAnswers(
  attemptId: number,
  answers: Record<string, number | null>,
): Promise<AttemptResult> {
  return apiFetch<AttemptResult>(`/api/test-attempts/${attemptId}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

// ─── ADMIN APIS ───

export async function fetchAdminScheduledTests(): Promise<{ tests: ScheduledTestAdmin[] }> {
  return apiFetch<{ tests: ScheduledTestAdmin[] }>("/api/admin/scheduled-tests");
}

export async function createAdminScheduledTest(data: {
  title: string;
  description?: string;
  instructions?: string;
  examId: number;
  scheduledStartAt: string;
  durationMinutes: number;
  marksPerQuestion: number;
  negativeMarking: number;
  totalMarks: number;
  publish?: boolean;
}): Promise<{
  testId: number;
  title: string;
  accessPassword: string;
  status: string;
  message: string;
}> {
  return apiFetch("/api/admin/scheduled-tests", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAdminScheduledTest(
  id: number,
  data: Partial<{
    title: string;
    description: string;
    instructions: string;
    examId: number;
    scheduledStartAt: string;
    durationMinutes: number;
    marksPerQuestion: number;
    negativeMarking: number;
    totalMarks: number;
  }>,
): Promise<{ message: string; id: number }> {
  return apiFetch(`/api/admin/scheduled-tests/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function publishAdminScheduledTest(
  id: number,
): Promise<{ published: boolean; status: string; accessPassword?: string; message: string }> {
  return apiFetch(`/api/admin/scheduled-tests/${id}/publish`, {
    method: "POST",
  });
}

export async function cancelAdminScheduledTest(
  id: number,
): Promise<{ cancelled: boolean; message: string }> {
  return apiFetch(`/api/admin/scheduled-tests/${id}/cancel`, {
    method: "POST",
  });
}

export async function regenerateAdminScheduledTestPassword(
  id: number,
): Promise<{ testId: number; accessPassword: string; message: string }> {
  return apiFetch(`/api/admin/scheduled-tests/${id}/regenerate-password`, {
    method: "POST",
  });
}

export async function fetchAdminScheduledTestStats(
  id: number,
): Promise<ScheduledTestStatsResponse> {
  return apiFetch<ScheduledTestStatsResponse>(`/api/admin/scheduled-tests/${id}/stats`);
}

// Admin PYQ APIs
export async function fetchAdminPyqPapers(params: {
  examId?: number;
  year?: number;
  search?: string;
} = {}): Promise<{ papers: PyqPaperAdmin[] }> {
  const query = new URLSearchParams();
  if (params.examId) query.set("examId", String(params.examId));
  if (params.year) query.set("year", String(params.year));
  if (params.search) query.set("search", params.search);
  const qStr = query.toString();
  return apiFetch<{ papers: PyqPaperAdmin[] }>(`/api/admin/pyq${qStr ? `?${qStr}` : ""}`);
}

export async function createAdminPyqPaper(data: {
  title: string;
  examId: number;
  year: number;
  shift?: string;
  language?: string;
  sourceInfo?: string;
  instructions?: string;
  durationMinutes: number;
  marksPerQuestion: number;
  negativeMarking: number;
  totalMarks: number;
  isVerifiedPyq?: boolean;
  published?: boolean;
}): Promise<{ paperId: number; title: string; message: string }> {
  return apiFetch("/api/admin/pyq", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAdminPyqPaper(
  id: number,
  data: Partial<{
    title: string;
    examId: number;
    year: number;
    shift: string;
    language: string;
    sourceInfo: string;
    instructions: string;
    durationMinutes: number;
    marksPerQuestion: number;
    negativeMarking: number;
    totalMarks: number;
    isVerifiedPyq: boolean;
  }>,
): Promise<{ message: string }> {
  return apiFetch(`/api/admin/pyq/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteAdminPyqPaper(id: number): Promise<{ message: string }> {
  return apiFetch(`/api/admin/pyq/${id}`, {
    method: "DELETE",
  });
}

export async function publishAdminPyqPaper(id: number): Promise<{ published: boolean; message: string }> {
  return apiFetch(`/api/admin/pyq/${id}/publish`, {
    method: "POST",
  });
}

export async function unpublishAdminPyqPaper(id: number): Promise<{ published: boolean; message: string }> {
  return apiFetch(`/api/admin/pyq/${id}/unpublish`, {
    method: "POST",
  });
}

export async function fetchAdminTestQuestions(
  testId: number,
): Promise<{ questions: TestQuestion[] }> {
  return apiFetch<{ questions: TestQuestion[] }>(`/api/admin/tests/${testId}/questions`);
}

export async function addAdminTestQuestion(
  testId: number,
  data: {
    prompt: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
    marks?: number;
    negativeMarks?: number;
    topic?: string;
    difficulty?: string;
  },
): Promise<{ questionId: number; message: string }> {
  return apiFetch(`/api/admin/tests/${testId}/questions`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteAdminQuestion(questionId: number): Promise<{ message: string }> {
  return apiFetch(`/api/admin/questions/${questionId}`, {
    method: "DELETE",
  });
}

export async function bulkImportAdminQuestions(
  testId: number,
  questions: Array<{
    prompt: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
    marks?: number;
    negativeMarks?: number;
    topic?: string;
    difficulty?: string;
  }>,
): Promise<{ importedCount: number; message: string }> {
  return apiFetch(`/api/admin/tests/${testId}/questions/bulk`, {
    method: "POST",
    body: JSON.stringify({ questions }),
  });
}
// ─── ADMIN: TEST MANAGEMENT (Free/Password/Paid) ───

export async function fetchAdminTests(accessType?: string): Promise<{ tests: any[] }> {
  const query = accessType ? `?accessType=${accessType}` : "";
  return apiFetch(`/api/admin/tests${query}`);
}

export async function createAdminTest(data: {
  title: string;
  subject?: string;
  topic?: string;
  examId: number;
  durationMinutes?: number;
  marksPerQuestion?: number;
  negativeMarking?: number;
  totalMarks?: number;
  difficulty?: string;
  accessType: "free" | "password" | "paid";
  isPrecision?: boolean;
  price?: number;
  bundleName?: string;
  accessPassword?: string;
  publish?: boolean;
}): Promise<{ testId: number; title: string; accessType: string; accessPassword?: string; message: string }> {
  return apiFetch("/api/admin/tests", { method: "POST", body: JSON.stringify(data) });
}

export async function publishAdminTest(id: number): Promise<{ published: boolean; message: string }> {
  return apiFetch(`/api/admin/tests/${id}/publish`, { method: "POST" });
}

export async function unpublishAdminTest(id: number): Promise<{ published: boolean; message: string }> {
  return apiFetch(`/api/admin/tests/${id}/unpublish`, { method: "POST" });
}

export async function deleteAdminTest(id: number): Promise<{ message: string }> {
  return apiFetch(`/api/admin/tests/${id}`, { method: "DELETE" });
}

export async function setAdminTestPassword(id: number, password?: string): Promise<{ testId: number; accessPassword: string; message: string }> {
  return apiFetch(`/api/admin/tests/${id}/set-password`, { method: "POST", body: JSON.stringify({ password }) });
}

export async function fetchAdminCategories(): Promise<{ categories: any[] }> {
  return apiFetch("/api/admin/categories");
}

export async function createAdminCategory(name: string): Promise<{ id: number; name: string; slug: string; message: string }> {
  return apiFetch("/api/admin/categories", { method: "POST", body: JSON.stringify({ name }) });
}

export async function createAdminExam(name: string, categoryId: number): Promise<{ id: number; name: string; slug: string; message: string }> {
  return apiFetch("/api/admin/exams", { method: "POST", body: JSON.stringify({ name, categoryId }) });
}
