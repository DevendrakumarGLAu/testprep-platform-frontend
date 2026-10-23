import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Page } from '../../../core/models';
import { BulkAction, DuplicateGroup, DuplicateMatch, PickedQuestion, Question, QuestionReportRow, Subject, Topic } from './qb.models';

type Query = Record<string, string | number | boolean | null | undefined>;

function params(q: Query): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(q)) {
    if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class QuestionBankService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  // Subjects
  subjects(q: Query = {}): Observable<Page<Subject>> {
    return this.http.get<Page<Subject>>(`${this.api}/subjects/`, { params: params({ page_size: 100, ...q }) });
  }
  saveSubject(body: Partial<Subject>, id?: number) {
    return id
      ? this.http.patch<Subject>(`${this.api}/subjects/${id}/`, body)
      : this.http.post<Subject>(`${this.api}/subjects/`, body);
  }
  subjectAction(id: number, action: 'archive' | 'restore') {
    return this.http.post<Subject>(`${this.api}/subjects/${id}/${action}/`, {});
  }
  deleteSubject(id: number) {
    return this.http.delete(`${this.api}/subjects/${id}/`);
  }

  // Topics
  topics(q: Query = {}): Observable<Page<Topic>> {
    return this.http.get<Page<Topic>>(`${this.api}/topics/`, { params: params({ page_size: 100, ...q }) });
  }
  saveTopic(body: Partial<Topic>, id?: number) {
    return id
      ? this.http.patch<Topic>(`${this.api}/topics/${id}/`, body)
      : this.http.post<Topic>(`${this.api}/topics/`, body);
  }
  topicAction(id: number, action: 'archive' | 'restore') {
    return this.http.post<Topic>(`${this.api}/topics/${id}/${action}/`, {});
  }
  deleteTopic(id: number) {
    return this.http.delete(`${this.api}/topics/${id}/`);
  }

  // Tags
  tags(search = ''): Observable<string[]> {
    return this.http.get<string[]>(`${this.api}/tags/`, { params: params({ search }) });
  }

  // Questions
  questions(q: Query): Observable<Page<Question>> {
    return this.http.get<Page<Question>>(`${this.api}/questions/`, { params: params(q) });
  }
  question(id: number) {
    return this.http.get<Question>(`${this.api}/questions/${id}/`);
  }
  saveQuestion(body: unknown, id?: number) {
    return id
      ? this.http.put<Question>(`${this.api}/questions/${id}/`, body)
      : this.http.post<Question>(`${this.api}/questions/`, body);
  }
  archiveQuestion(id: number) {
    return this.http.delete(`${this.api}/questions/${id}/`);
  }
  duplicateQuestion(id: number) {
    return this.http.post<Question>(`${this.api}/questions/${id}/duplicate/`, {});
  }
  uploadImage(id: number, file: File) {
    const fd = new FormData();
    fd.append('image', file);
    return this.http.post<Question>(`${this.api}/questions/${id}/image/`, fd);
  }
  removeImage(id: number) {
    return this.http.delete<Question>(`${this.api}/questions/${id}/image/`);
  }
  checkDuplicates(text: string, subject: number | null, excludeId?: number) {
    return this.http.post<DuplicateMatch[]>(`${this.api}/questions/check-duplicates/`, {
      text,
      subject,
      exclude_id: excludeId,
    });
  }
  /** Pick many active questions at once, newest first or at random, by the same filters as the list. */
  pick(body: { count: number; mode: 'random' | 'newest'; subject?: number | null; difficulty?: string; search?: string; date_from?: string; date_to?: string; used?: boolean; exclude_ids?: number[] }) {
    return this.http.post<{ available: number; questions: PickedQuestion[] }>(`${this.api}/questions/pick/`, body);
  }
  reports(q: Query) {
    return this.http.get<Page<QuestionReportRow>>(`${this.api}/question-reports/`, { params: params(q) });
  }
  updateReport(id: number, body: { status: string; admin_note: string }) {
    return this.http.patch<QuestionReportRow>(`${this.api}/question-reports/${id}/`, body);
  }
  /** Every question id matching the list's filters (at most 500), for "select all matching". */
  ids(q: Query) {
    return this.http.get<{ count: number; ids: number[]; truncated: boolean }>(`${this.api}/questions/ids/`, { params: params(q) });
  }
  duplicates() {
    return this.http.get<{ groups: DuplicateGroup[] }>(`${this.api}/questions/duplicates/`);
  }
  resolveDuplicates(keep: number, archive: number[]) {
    return this.http.post<{ archived: number; still_used_in: string[] }>(`${this.api}/questions/duplicates/resolve/`, { keep, archive });
  }
  bulk(ids: number[], action: BulkAction, extra: { difficulty?: string; tags?: string[]; review_status?: string; question_date?: string; subject?: number } = {}) {
    return this.http.post<{ updated: number }>(`${this.api}/questions/bulk/`, { ids, action, ...extra });
  }
}
