export interface ResultData {
  attempt: {
    id: number | string; // students get a public id (string); admins get the numeric id
    attempt_number: number;
    submitted_at: string;
    auto_submitted: boolean;
    student?: { id: number; name: string; email: string };
  };
  exam: { id: number | string; title: string };
  summary: {
    score: string;
    total_marks: string;
    passing_marks: string;
    passed: boolean;
    percentage: number | null;
    correct: number;
    incorrect: number;
    unanswered: number;
    accuracy: string;
    time_taken_seconds: number;
  };
  sections: { name: string; marks: string; max_marks: string; correct: number; incorrect: number; unanswered: number; time_seconds: number }[];
  timing: { total_seconds: number; average_seconds: number; slowest: { number: number; seconds: number } | null };
  subjects: { subject: string; marks: string; max_marks: string; accuracy: number }[];
  comparison: { attempts_count: number; average_percentage: number | null };
  solutions_available: boolean;
  questions: {
    number: number;
    section: string;
    subject: string;
    text: string;
    text_hi?: string;
    image_url: string | null;
    marks: string;
    options: { id: number; text: string; text_hi?: string; is_correct?: boolean }[];
    selected_option: number | null;
    time_spent_seconds: number;
    correct_option?: number | null;
    status?: 'correct' | 'incorrect' | 'unanswered';
    marks_awarded?: string;
    explanation?: string;
    explanation_hi?: string;
    video_url?: string;
    /** Set on a student's own review: the saved-question id and the state of their report on this question. */
    saved_id?: number | null;
    report_status?: 'open' | 'resolved' | 'rejected' | null;
  }[];
}
