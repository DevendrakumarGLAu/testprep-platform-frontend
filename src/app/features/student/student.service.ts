import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ResultData } from '../../shared/result.models';
import { AnswerPatch, AttemptState, Dashboard, HistoryRow, PrepExam, PrepHubData, StudentExam, SubmitResponse } from './student.models';

@Injectable({ providedIn: 'root' })
export class StudentService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/student`;

  dashboard() {
    return this.http.get<Dashboard>(`${this.api}/dashboard/`);
  }

  exams(filters: Record<string, string | number | null | undefined> = {}) {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== null && v !== undefined && v !== '') params = params.set(k, String(v));
    }
    return this.http.get<StudentExam[]>(`${this.api}/exams/`, { params });
  }

  prep() {
    return this.http.get<{ exams: PrepExam[]; preparing: string[] }>(`${this.api}/prep/`);
  }

  setPrep(categoryIds: string[]) {
    return this.http.put<{ exams: PrepExam[]; preparing: string[] }>(`${this.api}/prep/`, { category_ids: categoryIds });
  }

  hub(id: string) {
    return this.http.get<PrepHubData>(`${this.api}/prep/${id}/`);
  }

  filters() {
    return this.http.get<{ categories: { id: string; name: string }[]; subjects: { id: number; name: string }[] }>(`${this.api}/filters/`);
  }

  exam(id: string) {
    return this.http.get<StudentExam>(`${this.api}/exams/${id}/`);
  }

  start(examId: string) {
    return this.http.post<{ attempt_id: number; created: boolean }>(`${this.api}/exams/${examId}/start/`, {});
  }

  attempt(id: string) {
    return this.http.get<AttemptState>(`${this.api}/attempts/${id}/`);
  }

  saveAnswers(id: string, answers: AnswerPatch[]) {
    return this.http.put<{ saved: number; ignored?: number; server_now: string; deadline: string; remaining_seconds: number }>(
      `${this.api}/attempts/${id}/answers/`,
      { answers },
    );
  }

  submitSection(id: string, order: number) {
    return this.http.post<AttemptState & { moved: boolean }>(`${this.api}/attempts/${id}/sections/submit/`, { order });
  }

  submit(id: string) {
    return this.http.post<SubmitResponse>(`${this.api}/attempts/${id}/submit/`, {});
  }

  result(id: string) {
    return this.http.get<ResultData>(`${this.api}/attempts/${id}/result/`);
  }

  history() {
    return this.http.get<HistoryRow[]>(`${this.api}/attempts/`);
  }
}
