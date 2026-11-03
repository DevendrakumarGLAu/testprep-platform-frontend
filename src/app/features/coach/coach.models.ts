// What the study plan, doubt box, rank, listen and teacher-progress screens get from the server.

export type TaskKind = 'test' | 'revise' | 'practice' | 'listen' | 'exam_day';

export interface PlanTask {
  id: number;
  date: string;
  kind: TaskKind;
  title: string;
  minutes: number;
  done: boolean;
  link: string;
  overdue: boolean;
  /** The subject this task is about, when the plan is organised by subject. */
  subject?: string | null;
  subject_id?: number | null;
}

export interface PlanSummary {
  target_name: string;
  exam_date: string;
  daily_minutes: number;
  /** The public code of the exam the plan is for. */
  category: string | number | null;
  days_left: number;
  total: number;
  done: number;
  percent: number;
  overdue_count: number;
  finished: boolean;
}

/** One subject of the plan: how the student is doing in it and how much of its work in the plan is done. */
export interface PlanSubject {
  id: number;
  name: string;
  /** Accuracy so far (percent), or null when the student has not answered anything in the subject yet. */
  accuracy: number | null;
  answered: number;
  weak: boolean;
  tasks: number;
  done: number;
  tests: number;
  tests_done: number;
  next_date: string | null;
}

export interface PlanData {
  plan: PlanSummary | null;
  subjects?: PlanSubject[];
  today: PlanTask[];
  overdue: PlanTask[];
  upcoming: { date: string; tasks: PlanTask[] }[];
}

export interface NewPlan {
  exam_date: string;
  target_name: string;
  category: string | number | null;
  daily_minutes: number;
}

export type DoubtStatus = 'open' | 'answered' | 'resolved';

export interface DoubtReply {
  id: number;
  role: 'student' | 'staff';
  author: string;
  body: string;
  via_ai: boolean;
  created_at: string;
}

export interface DoubtRow {
  id: number;
  status: DoubtStatus;
  exam_title: string;
  question_text: string;
  created_at: string;
  updated_at: string;
  reply_count: number | null;
  student?: string;
}

export interface DoubtDetail extends DoubtRow {
  question_text_hi: string;
  options: { text: string; text_hi: string; is_correct: boolean }[];
  explanation: string;
  explanation_hi: string;
  selected_option_text: string;
  replies: DoubtReply[];
  student?: string;
  ai_available?: boolean;
}

export interface DoubtInbox {
  counts: Record<DoubtStatus, number>;
  results: DoubtRow[];
}

export const DOUBT_LABEL: Record<DoubtStatus, string> = { open: 'Waiting for an answer', answered: 'Answered', resolved: 'Resolved' };

export interface RankRow {
  exam_id: string;
  exam_title: string;
  date: string;
  rank: number;
  participants: number;
  percentile: number;
  score: string;
  total_marks: string;
  percent: number | null;
  attempt_id: string;
}

export interface RanksData {
  results: RankRow[];
  average_percentile: number | null;
}

export type ProgressStatus = 'behind' | 'declining' | 'steady' | 'improving' | 'new';

export interface ProgressRow {
  id: number;
  name: string;
  username: string;
  status: ProgressStatus;
  reasons: string[];
  tests_taken: number;
  average_percent: number | null;
  trend: number | null;
  last_active: string | null;
  days_inactive: number | null;
  plan_overdue: number;
  series: number[];
}

export interface BatchProgressData {
  batch: { id: number; name: string };
  days: number;
  students: number;
  counts: Record<ProgressStatus, number>;
  average_percent: number | null;
  results: ProgressRow[];
}

export const STATUS_LABEL: Record<ProgressStatus, string> = {
  behind: 'Falling behind',
  declining: 'Scores dropping',
  steady: 'Steady',
  improving: 'Improving',
  new: 'Not started',
};

export interface BatchOption {
  id: number;
  name: string;
}
