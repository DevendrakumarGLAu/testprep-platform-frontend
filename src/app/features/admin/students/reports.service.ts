import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Page } from '../../../core/models';

export interface AdminDashboardData {
  students: { total: number; active: number; new_last_30_days: number };
  questions: { total: number; active: number };
  tests: { total: number; published: number; draft: number; archived: number };
  attempts: { submitted: number; in_progress: number; participating_students: number };
  average_percentage: number | null;
  pass_rate: number | null;
  participation: { date: string; attempts: number }[];
  score_distribution: { range: string; count: number }[];
  subjects: { subject: string; accuracy: number; correct: number; incorrect: number; unanswered: number }[];
  top_tests: { id: number; title: string; attempts: number }[];
  recent_activity: {
    attempt: number; student: string; exam: string; score: string; total_marks: string;
    percentage: number | null; passed: boolean; submitted_at: string;
  }[];
}

export interface StudentRow {
  id: number;
  name: string;
  username: string;
  email: string;
  phone: string;
  is_active: boolean;
  date_joined: string;
  attempts_count: number;
  average_percentage: number | null;
  last_attempt_at: string | null;
  batches: { id: number; name: string }[];
}

export interface Performance {
  attempts_count: number;
  in_progress_count: number;
  average_percentage: number | null;
  best_percentage: number | null;
  accuracy_percent: number | null;
  pass_rate: number | null;
  subjects: { subject: string; accuracy: number; correct: number; incorrect: number; unanswered: number; marks: string; max_marks: string }[];
  trend: { attempt: number; title: string; percentage: number | null; submitted_at: string }[];
  history: {
    id: number; exam: number; exam_title: string; attempt_number: number; status: string; started_at: string;
    submitted_at: string | null; score: string | null; total_marks: string; percentage: number | null;
    passed: boolean | null; auto_submitted: boolean; time_taken_seconds: number | null;
  }[];
}

export interface StudentProfileData {
  id: number;
  name: string;
  username: string;
  email: string;
  phone: string;
  is_active: boolean;
  date_joined: string;
  batches: { id: number; name: string }[];
  assigned_exams: { id: number; title: string; status: string; access_type: string }[];
  performance: Performance;
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  dashboard() {
    return this.http.get<AdminDashboardData>(`${this.api}/admin/dashboard/`);
  }

  students(q: Record<string, string | number | null | undefined>) {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(q)) if (v !== null && v !== undefined && v !== '') params = params.set(k, String(v));
    return this.http.get<Page<StudentRow>>(`${this.api}/students/`, { params });
  }

  student(id: number) {
    return this.http.get<StudentProfileData>(`${this.api}/students/${id}/`);
  }

  assignTests(id: number, examIds: number[], mode: 'add' | 'remove') {
    return this.http.post<{ assigned_exams: StudentProfileData['assigned_exams']; notes: string[] }>(
      `${this.api}/students/${id}/assign-tests/`, { exam_ids: examIds, mode },
    );
  }

  setBatches(id: number, batchIds: number[]) {
    return this.http.put<{ batches: { id: number; name: string }[] }>(`${this.api}/students/${id}/batches/`, { batch_ids: batchIds });
  }

  studentReportPdf(id: number) {
    return this.http.get(`${this.api}/students/${id}/report.pdf`, { responseType: 'blob' });
  }

  consolidatedPdf(body: { student_ids?: number[]; exam_ids?: number[] }) {
    return this.http.post(`${this.api}/reports/consolidated.pdf`, body, { responseType: 'blob' });
  }
}
