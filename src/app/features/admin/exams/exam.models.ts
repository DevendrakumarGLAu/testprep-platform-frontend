export type ExamStatus = 'draft' | 'published' | 'archived';
export type AccessType = 'public' | 'assigned' | 'batch';
export type ResultRelease = 'immediate' | 'scheduled' | 'manual';
export type SolutionRelease = 'with_result' | 'after_end' | 'manual';
export type TestType = 'full_test' | 'mini_mock' | 'sectional' | 'previous_year';

export const TEST_TYPE_LABELS: Record<TestType, string> = {
  full_test: 'Full test',
  mini_mock: 'Mini mock',
  sectional: 'Subject test',
  previous_year: 'Previous year paper',
};

export interface Exam {
  id: number;
  /** The id students and public links use. */
  public_id: string;
  title: string;
  description: string;
  instructions: string;
  category: number | null;
  also_in: number[];
  category_name: string | null;
  test_type: TestType;
  subject: number | null;
  subject_name: string | null;
  year: number | null;
  /** One of the exam's own tabs to show this test in; empty means the tab of its type. */
  tab_key?: string;
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
  /** Students may pause a running attempt (clock stops, questions hidden). */
  allow_pause: boolean;
  /** A live test: everyone starts together and finishes together. */
  is_live: boolean;
  /** Minutes after the start during which students can still join a live test. */
  late_join_minutes: number;
  /** 0 = unlimited. */
  max_pauses: number;
  /** Longest a single pause may last, in minutes. */
  pause_minutes: number;
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

/** A family of exams, for example SSC (MTS, CHSL, CGL). */
export interface ExamGroup {
  id: number;
  public_id: string;
  name: string;
  description: string;
  order: number;
  is_active: boolean;
  /** How many exams are in this family. */
  exam_count: number;
}

/** An exam's usual settings, used to fill in a new test. Every setting is optional. */
export interface ExamPattern {
  duration_minutes?: number;
  marks_per_question?: number;
  passing_marks?: number;
  negative_option?: 'off' | 'question' | 'fraction' | 'fixed';
  negative_value?: number;
  sectional_timing?: boolean;
  max_attempts?: number;
  sections?: { name: string; duration_minutes: number | null }[];
}

/**
 * One tab students see inside an exam. The four built-in keys (full, mini, previous, subject) each hold one type of test; a tab the
 * admin adds has its own key (custom: true) and holds the tests put in it. The admin sets names, order and whether each shows.
 */
export interface ExamTab {
  key: string;
  label: string;
  visible: boolean;
  custom?: boolean;
}

export const STANDARD_TABS: ExamTab[] = [
  { key: 'full', label: 'Full tests', visible: true },
  { key: 'mini', label: 'Mini mocks', visible: true },
  { key: 'previous', label: 'Previous year', visible: true },
  { key: 'subject', label: 'Subject wise', visible: true },
];

export interface ExamCategory {
  id: number;
  name: string;
  description: string;
  subjects: number[];
  subject_names: string[];
  group: number | null;
  group_name: string | null;
  pattern: ExamPattern;
  tabs?: ExamTab[];
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
