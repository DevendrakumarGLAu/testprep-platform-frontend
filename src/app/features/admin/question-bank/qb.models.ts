export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Subject {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  topic_count: number;
  question_count: number;
}

export interface Topic {
  id: number;
  subject: number;
  subject_name: string;
  name: string;
  description: string;
  is_active: boolean;
  question_count: number;
}

export interface QOption {
  id?: number;
  text: string;
  text_hi?: string;
  is_correct: boolean;
}

export interface Question {
  id: number;
  text: string;
  text_hi?: string;
  explanation_hi?: string;
  /** The date the question is about (for current affairs, when the event happened). YYYY-MM-DD, or null if unknown. */
  question_date?: string | null;
  video_url?: string;
  review_status?: 'approved' | 'needs_review';
  open_reports?: number;
  /** The tests (not archived) this question is part of. */
  used_in?: { id: number; title: string; status: string }[];
  languages?: ('en' | 'hi')[];
  subject: number;
  subject_name: string;
  topic: number | null;
  topic_name: string | null;
  difficulty: Difficulty;
  question_type: string;
  explanation: string;
  marks: string;
  negative_marks: string;
  tags: string[];
  options: QOption[];
  image_url: string | null;
  is_active: boolean;
  source: string;
  source_info: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface DuplicateMatch {
  id: number;
  text: string;
  similarity: number;
  exact: boolean;
}

export type BulkAction = 'activate' | 'deactivate' | 'set_difficulty' | 'add_tags' | 'set_review_status' | 'set_question_date' | 'set_subject';

export interface DuplicateGroup {
  text: string;
  questions: { id: number; subject: string; question_date: string | null; review_status: string; created_at: string; used_in: string[] }[];
}

export interface QuestionReportRow {
  id: number;
  question: number;
  question_text: string;
  student_name: string;
  exam_title: string;
  reason: string;
  reason_label: string;
  message: string;
  status: 'open' | 'resolved' | 'rejected';
  admin_note: string;
  resolved_at: string | null;
  created_at: string;
}

/** The few fields the test builder needs from a question. */
export type PickedQuestion = Pick<Question, 'id' | 'text' | 'text_hi' | 'subject_name' | 'difficulty' | 'marks' | 'negative_marks' | 'version' | 'question_date'>;

export const MAX_QUESTIONS_PER_TEST = 300;
