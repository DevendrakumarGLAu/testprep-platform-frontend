import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Page } from '../../../core/models';

export interface StudyNote {
  id: number;
  public_id: string;
  title: string;
  title_hi: string;
  body: string;
  body_hi: string;
  category: number | null;
  category_name: string | null;
  subject: number | null;
  subject_name: string | null;
  note_date: string | null;
  is_published: boolean;
  updated_at: string;
}

export interface TestSeries {
  id: number;
  public_id: string;
  title: string;
  description: string;
  category: number | null;
  category_name: string | null;
  is_published: boolean;
  exams: { id: number; title: string; status: string }[];
}

@Injectable({ providedIn: 'root' })
export class ContentService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  notes(q: Record<string, string | number> = {}) {
    let params = new HttpParams().set('page_size', 100);
    for (const [k, v] of Object.entries(q)) if (v !== '') params = params.set(k, String(v));
    return this.http.get<Page<StudyNote>>(`${this.api}/study-notes/`, { params });
  }
  saveNote(body: Partial<StudyNote>, id?: number) {
    return id ? this.http.patch<StudyNote>(`${this.api}/study-notes/${id}/`, body) : this.http.post<StudyNote>(`${this.api}/study-notes/`, body);
  }
  deleteNote(id: number) {
    return this.http.delete<void>(`${this.api}/study-notes/${id}/`);
  }

  series() {
    return this.http.get<Page<TestSeries>>(`${this.api}/test-series/`, { params: { page_size: 100 } });
  }
  saveSeries(body: Partial<TestSeries> & { exam_ids?: number[] }, id?: number) {
    return id ? this.http.patch<TestSeries>(`${this.api}/test-series/${id}/`, body) : this.http.post<TestSeries>(`${this.api}/test-series/`, body);
  }
  deleteSeries(id: number) {
    return this.http.delete<void>(`${this.api}/test-series/${id}/`);
  }
}
