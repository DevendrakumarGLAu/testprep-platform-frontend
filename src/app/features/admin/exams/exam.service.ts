import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Page, User } from '../../../core/models';
import { ResultData } from '../../../shared/result.models';
import { AdminAttempt, Batch, Exam, ExamCategory, ExamGroup, ExamPreview, ResultsSummary } from './exam.models';

type Query = Record<string, string | number | boolean | null | undefined>;

function params(q: Query): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(q)) {
    if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class ExamService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  list(q: Query): Observable<Page<Exam>> {
    return this.http.get<Page<Exam>>(`${this.api}/exams/`, { params: params(q) });
  }
  get(id: number) {
    return this.http.get<Exam>(`${this.api}/exams/${id}/`);
  }
  save(body: unknown, id?: number) {
    return id ? this.http.patch<Exam>(`${this.api}/exams/${id}/`, body) : this.http.post<Exam>(`${this.api}/exams/`, body);
  }
  remove(id: number) {
    return this.http.delete(`${this.api}/exams/${id}/`);
  }
  action(id: number, name: 'publish' | 'unpublish' | 'archive' | 'restore' | 'duplicate') {
    return this.http.post<Exam>(`${this.api}/exams/${id}/${name}/`, {});
  }
  saveStructure(id: number, sections: { name: string; duration_minutes?: number | null; questions: { question: number; marks: string; negative_marks: string }[] }[]) {
    return this.http.put<Exam>(`${this.api}/exams/${id}/structure/`, { sections });
  }
  saveAssignment(id: number, students: number[], batches: number[]) {
    return this.http.put<Exam>(`${this.api}/exams/${id}/assignment/`, { students, batches });
  }
  savePremiumAccess(id: number, students: number[], batches: number[]) {
    return this.http.put<Exam>(`${this.api}/exams/${id}/premium-access/`, { students, batches });
  }
  preview(id: number) {
    return this.http.get<ExamPreview>(`${this.api}/exams/${id}/preview/`);
  }
  uploadThumbnail(id: number, file: File) {
    const fd = new FormData();
    fd.append('image', file);
    return this.http.post<Exam>(`${this.api}/exams/${id}/thumbnail/`, fd);
  }
  removeThumbnail(id: number) {
    return this.http.delete<Exam>(`${this.api}/exams/${id}/thumbnail/`);
  }

  attempts(examId: number, q: Query): Observable<Page<AdminAttempt>> {
    return this.http.get<Page<AdminAttempt>>(`${this.api}/exams/${examId}/attempts/`, { params: params(q) });
  }
  resultsSummary(examId: number) {
    return this.http.get<ResultsSummary>(`${this.api}/exams/${examId}/results-summary/`);
  }
  release(examId: number, action: 'release-results' | 'hide-results' | 'release-solutions' | 'hide-solutions') {
    return this.http.post<{ results_visible: boolean; solutions_visible: boolean }>(`${this.api}/exams/${examId}/${action}/`, {});
  }
  attemptResult(attemptId: number) {
    return this.http.get<ResultData>(`${this.api}/attempts/${attemptId}/`);
  }

  groups(): Observable<Page<ExamGroup>> {
    return this.http.get<Page<ExamGroup>>(`${this.api}/exam-groups/`, { params: { page_size: 100 } });
  }
  saveGroup(body: Partial<ExamGroup>, id?: number) {
    return id ? this.http.patch<ExamGroup>(`${this.api}/exam-groups/${id}/`, body) : this.http.post<ExamGroup>(`${this.api}/exam-groups/`, body);
  }
  deleteGroup(id: number) {
    return this.http.delete(`${this.api}/exam-groups/${id}/`);
  }
  categories(): Observable<Page<ExamCategory>> {
    return this.http.get<Page<ExamCategory>>(`${this.api}/exam-categories/`, { params: { page_size: 100 } });
  }
  createCategory(name: string) {
    return this.http.post<ExamCategory>(`${this.api}/exam-categories/`, { name });
  }
  saveCategory(body: Partial<ExamCategory>, id?: number) {
    return id
      ? this.http.patch<ExamCategory>(`${this.api}/exam-categories/${id}/`, body)
      : this.http.post<ExamCategory>(`${this.api}/exam-categories/`, body);
  }
  deleteCategory(id: number) {
    return this.http.delete(`${this.api}/exam-categories/${id}/`);
  }

  batches(q: Query = {}): Observable<Page<Batch>> {
    return this.http.get<Page<Batch>>(`${this.api}/batches/`, { params: params({ page_size: 100, ...q }) });
  }
  saveBatch(body: Partial<Batch>, id?: number) {
    return id ? this.http.patch<Batch>(`${this.api}/batches/${id}/`, body) : this.http.post<Batch>(`${this.api}/batches/`, body);
  }
  deleteBatch(id: number) {
    return this.http.delete(`${this.api}/batches/${id}/`);
  }
  batchMembers(id: number) {
    return this.http.get<User[]>(`${this.api}/batches/${id}/members/`);
  }
  addMembers(id: number, studentIds: number[]) {
    return this.http.post<{ member_count: number }>(`${this.api}/batches/${id}/add-members/`, { student_ids: studentIds });
  }
  removeMembers(id: number, studentIds: number[]) {
    return this.http.post<{ member_count: number }>(`${this.api}/batches/${id}/remove-members/`, { student_ids: studentIds });
  }

  students(search = ''): Observable<Page<User>> {
    return this.http.get<Page<User>>(`${this.api}/users/`, {
      params: params({ role: 'student', is_active: true, search, page_size: 50 }),
    });
  }
}
