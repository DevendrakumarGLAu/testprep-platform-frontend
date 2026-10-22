import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Page } from '../../../core/models';

export interface ImportMapping {
  question?: string;
  correct?: string;
  explanation?: string;
  subject?: string;
  topic?: string;
  difficulty?: string;
  marks?: string;
  negative_marks?: string;
  tags?: string;
  options: string[];
}

export interface ImportDefaults {
  subject?: number | null;
  topic?: number | null;
  difficulty?: string;
  marks?: number;
  negative_marks?: number;
}

export interface ImportJob {
  id: number;
  source_type: 'csv' | 'excel' | 'pdf';
  filename: string;
  status: 'uploaded' | 'processed' | 'imported';
  headers: string[];
  mapping: ImportMapping;
  defaults: ImportDefaults;
  create_missing: boolean;
  warnings: string[];
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  imported_count: number;
  failed_count: number;
  skipped_count: number;
  sample: Record<string, string>[];
  selected_count: number;
}

export interface ImportRowData {
  id: number;
  row_number: number;
  raw: Record<string, string>;
  normalized: {
    question: string;
    options: { label: string; text: string }[];
    correct_label: string | null;
    explanation: string;
    subject: string;
    topic: string;
    difficulty: string;
    marks: string;
    negative_marks: string;
    tags: string[];
    new_subject: boolean;
    new_topic: boolean;
  } | null;
  status: 'valid' | 'invalid' | 'duplicate' | 'pending';
  errors: string[];
  duplicate_of: number | null;
  duplicate_info: { in_file: boolean; row?: number; question?: number; similarity: number; exact: boolean } | null;
  selected: boolean;
  result: string;
  result_message: string;
}

export interface ImportSource {
  id: string;
  label: string;
  extensions: string[];
  available: boolean;
  note: string;
}

@Injectable({ providedIn: 'root' })
export class ImportService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/imports`;

  sources() {
    return this.http.get<ImportSource[]>(`${this.api}/sources/`);
  }
  template(file: 'csv' | 'xlsx') {
    return this.http.get(`${this.api}/template/`, { params: { file }, responseType: 'blob' });
  }
  upload(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ImportJob>(`${this.api}/`, fd);
  }
  process(id: number, mapping: ImportMapping, defaults: ImportDefaults, createMissing: boolean) {
    return this.http.post<ImportJob>(`${this.api}/${id}/process/`, { mapping, defaults, create_missing: createMissing });
  }
  rows(id: number, status: string, page: number) {
    let params = new HttpParams().set('page', page).set('page_size', 20);
    if (status) params = params.set('status', status);
    return this.http.get<Page<ImportRowData>>(`${this.api}/${id}/rows/`, { params });
  }
  patchRow(id: number, rowId: number, body: { selected?: boolean; fixes?: Record<string, string> }) {
    return this.http.patch<{ row: ImportRowData; job: ImportJob }>(`${this.api}/${id}/rows/${rowId}/`, body);
  }
  select(id: number, mode: 'valid' | 'none' | 'valid_and_duplicates') {
    return this.http.post<ImportJob>(`${this.api}/${id}/select/`, { mode });
  }
  commit(id: number) {
    return this.http.post<ImportJob>(`${this.api}/${id}/commit/`, {});
  }
  discard(id: number) {
    return this.http.delete(`${this.api}/${id}/`);
  }
  failedReport(id: number) {
    return this.http.get(`${this.api}/${id}/failed-report/`, { responseType: 'blob' });
  }
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
