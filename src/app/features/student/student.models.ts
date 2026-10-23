export type StudentExamStatus = 'available' | 'upcoming' | 'in_progress' | 'completed' | 'missed' | 'locked';

export interface StudentExam {
  id: string;
  title: string;
  description: string;
  category: string | null;
  category_name: string | null;
  test_type: 'full_test' | 'sectional' | 'previous_year';
  test_type_label: string;
  subject: number | null;
  subject_name: string | null;
  year: number | null;
  thumbnail_url: string | null;
  question_count: number;
  total_marks: string;
  duration_minutes: number;
  start_at: string | null;
  end_at: string | null;
  max_attempts: number;
  attempts_used: number;
  negative_marking_enabled: boolean;
  sectional_timing: boolean;
  /** A premium test can only be started with access granted by an admin. */
  premium?: boolean;
  price?: string | null;
  locked?: boolean;
  status: StudentExamStatus;
  can_start: boolean;
  reason: string;
  active_attempt_id: string | null;
  instructions?: string;
  unanswered_penalty?: string;
  sections?: { name: string; question_count: number; duration_minutes: number | null }[];
  languages?: ('en' | 'hi')[];
}

export interface ResultSummary {
  score: string;
  total_marks: string;
  passing_marks: string;
  passed: boolean;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: string;
  time_taken_seconds: number;
}

export interface AttemptQuestion {
  id: number;
  number: number;
  text: string;
  text_hi?: string;
  image_url: string | null;
  marks: string;
  negative_marks: string;
  options: { id: number; text: string; text_hi?: string }[];
  selected_option: number | null;
  marked_for_review: boolean;
  visited: boolean;
  time_spent: number;
}

/** One section of an attempt. For tests with timed sections only the open one carries its questions. */
export interface AttemptSectionState {
  name: string;
  questions: AttemptQuestion[];
  order?: number;
  status?: 'done' | 'active' | 'upcoming';
  duration_seconds?: number;
  remaining_seconds?: number;
  question_count?: number;
  answered_count?: number;
  closed_by?: 'submitted' | 'expired' | null;
}

export interface AttemptState {
  id: string;
  status: 'in_progress' | 'submitted';
  attempt_number: number;
  exam: { id: string; title: string; duration_minutes: number; total_marks: string; negative_marking_enabled: boolean };
  server_now: string;
  deadline: string;
  remaining_seconds: number;
  sections?: AttemptSectionState[];
  sectional?: boolean;
  /** Languages the test is written in. */
  languages?: ('en' | 'hi')[];
  active_section?: number | null;
  submitted_at?: string;
  auto_submitted?: boolean;
  result_available?: boolean;
  result?: ResultSummary | null;
}

export interface SubmitResponse {
  id: string;
  status: string;
  submitted_at: string;
  auto_submitted: boolean;
  result_available: boolean;
  result: ResultSummary | null;
}

export interface AnswerPatch {
  question: number;
  selected_option?: number | null;
  marked_for_review?: boolean;
  visited?: boolean;
  /** Running total of seconds on this question (not a delta). */
  time_spent?: number;
}

export interface HistoryRow {
  id: string;
  exam: string;
  exam_title: string;
  attempt_number: number;
  status: string;
  started_at: string;
  submitted_at: string | null;
  auto_submitted: boolean;
  result_available: boolean;
  score: string | null;
  total_marks: string;
  passed: boolean | null;
  percentage: number | null;
}

export interface PrepExam {
  id: string;
  name: string;
  description: string;
  subjects: string[];
  counts: { full_test: number; sectional: number; previous_year: number; total: number };
  preparing: boolean;
}

export interface PrepHubData {
  exam: { id: string; name: string; description: string; subjects: { id: number; name: string }[] };
  preparing: boolean;
  full_tests: StudentExam[];
  subject_tests: { subject: number | null; subject_name: string; tests: StudentExam[] }[];
  previous_year: StudentExam[];
  progress: { total: number; attempted: number };
}

export interface Dashboard {
  preparing: { id: string; name: string; total_tests: number; attempted_tests: number }[];
  counts: { available: number; upcoming: number; in_progress: number; completed: number };
  average_score_percent: number | null;
  accuracy_percent: number | null;
  in_progress: StudentExam[];
  upcoming: StudentExam[];
  recent_results: { id: string; exam_title: string; score: string; total_marks: string; passed: boolean; submitted_at: string }[];
  trend: { attempt: string; title: string; percentage: number; submitted_at: string }[];
  subjects: { subject: string; accuracy: number; marks: string; max_marks: string }[];
  recommended: StudentExam[];
  activity: ActivitySummary;
}

/** How much the student practised: questions answered per day, the streak and the daily goal. */
export interface ActivitySummary {
  streak: number;
  best_streak: number;
  today: number;
  goal: number;
  goal_reached: boolean;
  last_7_days: { date: string; questions: number }[];
}

export interface WeakTopic {
  subject_id: number;
  subject: string;
  topic_id: number | null;
  topic: string;
  answered: number;
  correct: number;
  accuracy: number;
}

export interface WeakTopicsData {
  weak: WeakTopic[];
  all: WeakTopic[];
  rule: string;
}

/** Returned when a practice set or the daily quiz is started: go straight to the exam screen with attempt_id. */
export interface PracticeStart {
  attempt_id: string;
  exam_id: string;
  questions: number;
  created: boolean;
}

export interface SavedQuestion {
  id: number;
  exam_title: string;
  subject: string;
  text: string;
  text_hi: string;
  options: { id: number; text: string; text_hi?: string; is_correct: boolean }[];
  selected_option: number | null;
  explanation: string;
  explanation_hi: string;
  note: string;
  created_at: string;
}

export interface SavedList {
  count: number;
  subjects: string[];
  results: SavedQuestion[];
}

export interface MyReport {
  id: number;
  question: string;
  exam_title: string;
  reason: string;
  message: string;
  status: 'open' | 'resolved' | 'rejected';
  status_label: string;
  admin_note: string;
  created_at: string;
  resolved_at: string | null;
}

export const REPORT_REASONS: { value: string; label: string }[] = [
  { value: 'wrong_answer', label: 'The marked answer is wrong' },
  { value: 'wrong_question', label: 'The question is wrong or unclear' },
  { value: 'typo', label: 'Spelling or typing mistake' },
  { value: 'translation', label: 'Hindi and English do not match' },
  { value: 'other', label: 'Something else' },
];

export interface DailyQuizStatus {
  available: boolean;
  done: boolean;
  in_progress: boolean;
  size: number;
}

export interface LeaderboardRow {
  rank: number;
  name: string;
  score: string;
  total_marks: string;
  percent: number | null;
  time_taken_seconds: number | null;
  is_me: boolean;
}

export interface LeaderboardData {
  exam: string;
  participants: number;
  me: (LeaderboardRow & { better_than_percent: number }) | null;
  top: LeaderboardRow[];
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

/** 45 -> "45s", 125 -> "2m 05s", 120 -> "2m". */
export function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${String(r).padStart(2, '0')}s` : `${m}m`;
}

/** The last seven days compared with the seven before. */
export interface WeeklySummary {
  from: string;
  to: string;
  questions: number;
  questions_before: number;
  tests: number;
  tests_before: number;
  active_days: number;
  accuracy: number | null;
  accuracy_before: number | null;
  accuracy_change: number | null;
  best_subject: { name: string; accuracy: number } | null;
  weakest_subject: { name: string; accuracy: number } | null;
}

export interface ReviseCard {
  key: string;
  subject: string;
  exam_title: string;
  text: string;
  text_hi: string;
  options: { id: number; text: string; text_hi: string; is_correct: boolean }[];
  your_option: number | null;
  explanation: string;
  explanation_hi: string;
}

export interface ReviseData {
  source: 'saved' | 'mistakes';
  total: number;
  cards: ReviseCard[];
}
