export type ExamStatus = 'draft' | 'published' | 'archived';
export type AccessType = 'public' | 'assigned' | 'batch';
export type ResultRelease = 'immediate' | 'scheduled' | 'manual';
export type SolutionRelease = 'with_result' | 'after_end' | 'manual';
export type TestType = 'full_test' | 'sectional' | 'previous_year';

export const TEST_TYPE_LABELS: Record<TestType, string> = {
  full_test: 'Full test',
  sectional: 'Subject test',
  previous_year: 'Previous year paper',
};

export interface Exam {
  id: number;
  title: string;
  description: string;
  instructions: string;
  category: number | null;
  category_name: string | null;
  test_type: TestType;
  subject: number | null;
  subject_name: string | null;
  year: number | null;
  thumbnail_url: string | null;
  duration_minutes: number;
  passing_marks: string;
  marks_per_question: string | null;
  negative_marking_enabled: boolean;
  negative_mode: 'question' | 'fraction' | 'fixed';
  sectional_timing: boolean;
  negative_value: string;
  unanswered_penalty: string;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  max_attempts: number;
  start_at: string | null;
  end_at: string | null;
  access_type: AccessType;
  assigned_student_ids: number[];
  assigned_batch_ids: number[];
  is_premium: boolean;
  price: string | null;
  premium_student_ids: number[];
  premium_batch_ids: number[];
  status: ExamStatus;
  published_at: string | null;
  version: number;
  locked: boolean;
  result_release: ResultRelease;
  result_release_at: string | null;
  results_released: boolean;
  solution_release: SolutionRelease;
  solutions_released: boolean;
  total_marks: string;
  question_count: number;
  created_at: string;
  updated_at: string;
  sections?: ExamSection[];
}

export interface ExamSection {
  id?: number;
  name: string;
  duration_minutes?: number | null;
  questions: ExamQuestion[];
}

export interface ExamQuestion {
  question: number;
  text: string;
  question_date?: string | null;
  /** Titles of the other tests this question is also in. */
  also_in?: string[];
  subject_name?: string;
  difficulty?: string;
  is_active?: boolean;
  marks: string;
  negative_marks: string;
  question_version?: number;
  current_version?: number;
}

export interface Batch {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  member_count: number;
}

export interface ExamCategory {
  id: number;
  name: string;
  description: string;
  subjects: number[];
  subject_names: string[];
  is_active: boolean;
  exam_count: number;
}

export interface ExamPreview {
  title: string;
  description: string;
  instructions: string;
  duration_minutes: number;
  total_marks: string;
  question_count: number;
  negative_marking_enabled: boolean;
  max_attempts: number;
  start_at: string | null;
  end_at: string | null;
  sections: {
    id: number;
    name: string;
    questions: {
      id: number;
      text: string;
      text_hi?: string;
      image_url: string | null;
      marks: string;
      negative_marks: string;
      options: { id: number; text: string; text_hi?: string }[];
    }[];
  }[];
}

/** ISO string -> value for <input type="datetime-local"> in the browser's local time. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value -> ISO string (UTC) or null. */
export function fromLocalInput(v: string | null | undefined): string | null {
  return v ? new Date(v).toISOString() : null;
}

export interface AdminAttempt {
  id: number;
  student: number;
  student_name: string;
  student_email: string;
  attempt_number: number;
  status: 'in_progress' | 'submitted';
  started_at: string;
  submitted_at: string | null;
  auto_submitted: boolean;
  score: string | null;
  total_marks: string;
  percentage: number | null;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  accuracy: string | null;
  passed: boolean | null;
  time_taken_seconds: number | null;
}

export interface ResultsSummary {
  exam: {
    id: number;
    title: string;
    result_release: ResultRelease;
    results_released: boolean;
    solution_release: SolutionRelease;
    solutions_released: boolean;
    result_release_at: string | null;
    results_visible: boolean;
    solutions_visible: boolean;
  };
  attempts_submitted: number;
  attempts_in_progress: number;
  students: number;
  average_score: string | null;
  average_percentage: number | null;
  highest_score: string | null;
  lowest_score: string | null;
  pass_rate: number | null;
  questions: { question: number; text: string; subject: string; attempts: number; correct_percent: number; answered_percent: number; average_seconds: number }[];
}
