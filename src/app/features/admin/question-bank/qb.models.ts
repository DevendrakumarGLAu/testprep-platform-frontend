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

export type BulkAction = 'activate' | 'deactivate' | 'set_difficulty' | 'add_tags';

/** The few fields the test builder needs from a question. */
export type PickedQuestion = Pick<Question, 'id' | 'text' | 'subject_name' | 'difficulty' | 'marks' | 'negative_marks' | 'version'>;

export const MAX_QUESTIONS_PER_TEST = 300;
