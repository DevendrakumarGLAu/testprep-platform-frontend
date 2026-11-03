import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

export type FeedbackKind = 'bug' | 'idea' | 'other';
export type FeedbackStatus = 'new' | 'done';

export interface FeedbackRow {
  id: number;
  kind: FeedbackKind;
  kind_label: string;
  message: string;
  page: string;
  device: string;
  status: FeedbackStatus;
  created_at: string;
  from_name: string;
  from_email: string;
  from_role: string;
}

export interface FeedbackInboxData {
  results: FeedbackRow[];
  new_count: number;
}

/** The feedback button (anyone signed in) and the staff inbox. */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/feedback/`;

  send(body: { kind: FeedbackKind; message: string; page: string }) {
    return this.http.post<{ detail: string }>(this.url, body);
  }

  inbox(status: FeedbackStatus | '' = '') {
    return this.http.get<FeedbackInboxData>(this.url, { params: status ? { status } : {} });
  }

  setStatus(id: number, status: FeedbackStatus) {
    return this.http.post<FeedbackRow>(`${this.url}${id}/status/`, { status });
  }
}
