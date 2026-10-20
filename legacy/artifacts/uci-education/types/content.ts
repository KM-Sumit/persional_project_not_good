export interface User {
  id: number;
  name: string;
  email: string;
  mobile: string;
  role: "student" | "admin";
}

export interface Banner {
  id: number;
  title: string;
  subtitle: string;
  imageUrl?: string;
  ctaLabel: string;
  href?: string | null;
}

export interface Course {
  id: number;
  title: string;
  description: string;
  instructor: string;
  category: string;
  exam: string;
  lessonCount: number;
  durationMinutes: number;
  priceCents: number;
  thumbnailUrl?: string;
  completedLessons?: number;
}

export interface Note {
  id: number;
  title: string;
  description: string;
  body: string;
  subject: string;
  exam: string;
  pdfUrl?: string;
  createdAt?: string;
}

export interface ExamCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  sortOrder: number;
  exams?: Exam[];
}

export interface Exam {
  id: number;
  categoryId: number;
  categoryName?: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  pyqCount?: number;
  mockCount?: number;
  scheduledCount?: number;
}

export interface TestSummary {
  id: number;
  title: string;
  subject: string;
  topic: string;
  questionCount: number;
  durationMinutes: number;
  difficulty: string;
  attempted?: boolean;
  activeAttemptId?: number | null;
  testType?: "practice" | "mock" | "pyq" | "scheduled";
  description?: string;
  instructions?: string;
  marksPerQuestion?: number;
  negativeMarking?: number;
  totalMarks?: number;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  status?: string;
  computedStatus?: "draft" | "scheduled" | "live" | "completed" | "cancelled";
  liveStatus?: "draft" | "scheduled" | "live" | "completed" | "cancelled";
  examId?: number | null;
  isPasswordProtected?: boolean;
  requiresPassword?: boolean;
  year?: number | null;
  shift?: string | null;
  language?: string;
  sourceInfo?: string;
  isVerifiedPyq?: boolean;
  examName?: string;
  categoryName?: string;
  accessType?: 'free' | 'password' | 'paid';
  isPrecision?: boolean;
  price?: number;
  bundleName?: string;
  hasPurchased?: boolean;
}

export interface HomeData {
  student: User;
  banners: Banner[];
  continueLearning: null | {
    courseId: number;
    courseTitle: string;
    completedLessons: number;
    lessonCount: number;
    lastLesson?: string | null;
    progress: number;
  };
  popularCourses: Course[];
  upcomingTests: TestSummary[];
  latestNotes: Note[];
}

export interface Lesson {
  id: number | null;
  chapterId: number;
  chapterTitle: string;
  title: string | null;
  kind: string | null;
  durationMinutes: number | null;
  resourceUrl: string | null;
  body: string | null;
  sortOrder: number | null;
  completed: boolean;
}

export interface TestQuestion {
  id: number;
  prompt: string;
  options: string[];
  marks?: number;
  negativeMarks?: number;
  topic?: string;
  difficulty?: string;
  explanation?: string;
  correctIndex?: number;
}

export interface TestAttemptSession {
  attemptId: number;
  startedAt: string;
  deadline: string;
  serverTime?: string;
  test: {
    id: number;
    title: string;
    subject: string;
    topic: string;
    durationMinutes: number;
    marksPerQuestion?: number;
    negativeMarking?: number;
    totalMarks?: number;
    instructions?: string;
  };
  questions: TestQuestion[];
  savedAnswers?: Record<string, number | null>;
}

export interface AttemptResult {
  id: number;
  attemptId?: number;
  testId: number;
  testTitle: string;
  startedAt: string;
  submittedAt: string;
  score: number;
  totalQuestions: number;
  correct: number;
  wrong: number;
  unattempted: number;
  percentage: number;
  accuracy: number;
  timeTakenSeconds: number;
  maxMarks?: number;
}

export interface AdminStats {
  students: number;
  courses: number;
  notes: number;
  tests: number;
  attempts: number;
}

export interface AdminResult {
  studentName: string;
  email: string;
  testTitle: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  accuracy: number;
  timeTakenSeconds: number;
  submittedAt: string;
}

export interface ScheduledTestAdmin {
  id: number;
  title: string;
  subject: string;
  topic: string;
  questionCount: number;
  durationMinutes: number;
  difficulty: string;
  published: boolean;
  examId: number;
  examName?: string;
  categoryName?: string;
  description: string;
  instructions: string;
  marksPerQuestion: number;
  negativeMarking: number;
  totalMarks: number;
  status: string;
  liveStatus: "draft" | "scheduled" | "live" | "completed" | "cancelled";
  scheduledStartAt: string;
  scheduledEndAt: string;
  hasPassword: boolean;
  participantCount: number;
  completedCount: number;
  avgScore: number | null;
  topScore: number | null;
}

export interface ScheduledTestStatsResponse {
  test: ScheduledTestAdmin;
  stats: {
    totalStarted: number;
    totalCompleted: number;
    inProgressCount: number;
    avgScore: number;
    topScore: number;
    lowestScore: number;
  };
  participants: Array<{
    attemptId: number;
    userId: number;
    studentName: string;
    email: string;
    mobile: string;
    startedAt: string;
    submittedAt: string | null;
    score: number | null;
    totalQuestions: number;
    correct: number | null;
    wrong: number | null;
    unattempted: number | null;
    percentage: number | null;
    accuracy: number | null;
    timeTakenSeconds: number | null;
    status: string;
  }>;
}

export interface PyqPaperAdmin {
  id: number;
  title: string;
  year: number;
  shift: string;
  language: string;
  sourceInfo: string;
  isVerifiedPyq: boolean;
  questionCount: number;
  durationMinutes: number;
  totalMarks: number;
  marksPerQuestion: number;
  negativeMarking: number;
  published: boolean;
  createdAt: string;
  examId: number;
  examName?: string;
  categoryName?: string;
}