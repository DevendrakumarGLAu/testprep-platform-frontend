import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  BatchOption, BatchProgressData, DoubtDetail, DoubtInbox, DoubtRow, DoubtStatus, NewPlan, PlanData, RanksData,
} from './coach.models';

/** Everything the new study-plan, doubt, rank and teacher-progress screens ask the server for. */
@Injectable({ providedIn: 'root' })
export class CoachService {
  private http = inject(HttpClient);
  private student = `${environment.apiUrl}/student`;
  private admin = `${environment.apiUrl}/admin`;

  // ---- study plan ----
  plan() {
    return this.http.get<PlanData>(`${this.student}/study-plan/`);
  }

  createPlan(body: NewPlan) {
    return this.http.post<PlanData>(`${this.student}/study-plan/`, body);
  }

  deletePlan() {
    return this.http.delete<void>(`${this.student}/study-plan/`);
  }

  markTask(id: number, done: boolean) {
    return this.http.post<PlanData>(`${this.student}/study-plan/tasks/${id}/done/`, { done });
  }

  reschedule() {
    return this.http.post<PlanData & { moved: number; dropped: number }>(`${this.student}/study-plan/reschedule/`, {});
  }

  /** Plan the coming days again with the latest results, so weak subjects come round more often. */
  refreshPlan() {
    return this.http.post<PlanData & { replanned: number; removed: number }>(`${this.student}/study-plan/refresh/`, {});
  }

  // ---- doubts (student) ----
  askDoubt(attemptId: string, number: number, message: string) {
    return this.http.post<DoubtDetail>(`${this.student}/attempts/${attemptId}/questions/${number}/doubt/`, { message });
  }

  myDoubts(status: DoubtStatus | '' = '') {
    return this.http.get<DoubtRow[]>(`${this.student}/doubts/`, { params: status ? { status } : {} });
  }

  myDoubt(id: number | string) {
    return this.http.get<DoubtDetail>(`${this.student}/doubts/${id}/`);
  }

  replyToDoubt(id: number, body: string) {
    return this.http.post<DoubtDetail>(`${this.student}/doubts/${id}/reply/`, { body });
  }

  resolveDoubt(id: number) {
    return this.http.post<DoubtDetail>(`${this.student}/doubts/${id}/resolve/`, {});
  }

  // ---- rank ----
  ranks() {
    return this.http.get<RanksData>(`${this.student}/ranks/`);
  }

  // ---- doubts (teacher) ----
  inbox(status: DoubtStatus | '' = '', search = '') {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);
    return this.http.get<DoubtInbox>(`${this.admin}/doubts/`, { params });
  }

  doubt(id: number) {
    return this.http.get<DoubtDetail>(`${this.admin}/doubts/${id}/`);
  }

  answer(id: number, body: string, viaAi: boolean) {
    return this.http.post<DoubtDetail>(`${this.admin}/doubts/${id}/reply/`, { body, via_ai: viaAi });
  }

  setDoubtStatus(id: number, status: DoubtStatus) {
    return this.http.post<DoubtDetail>(`${this.admin}/doubts/${id}/status/`, { status });
  }

  aiSuggest(id: number) {
    return this.http.post<{ suggestion: string }>(`${this.admin}/doubts/${id}/ai-suggest/`, {});
  }

  // ---- teacher: batch progress ----
  batches() {
    return this.http.get<{ results: BatchOption[] }>(`${environment.apiUrl}/batches/`, { params: { page_size: 200 } });
  }

  batchProgress(batchId: number, days: number) {
    return this.http.get<BatchProgressData>(`${this.admin}/batches/${batchId}/progress/`, { params: { days } });
  }

  batchProgressCsv(batchId: number, days: number) {
    return this.http.get(`${this.admin}/batches/${batchId}/progress/`, { params: { days, csv: 1 }, responseType: 'blob' });
  }
}
