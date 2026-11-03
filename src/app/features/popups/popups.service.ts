import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Page } from '../../core/models';

export type PopupAudience = 'all' | 'exam' | 'batch';
export type PopupState = 'live' | 'scheduled' | 'ended' | 'off';

/** What a student sees. */
export interface StudentPopup {
  id: number;
  title: string;
  body: string;
  image_url: string | null;
  link: string;
  button_label: string;
}

/** A pop-up as the admin manages it. */
export interface Popup extends StudentPopup {
  audience: PopupAudience;
  category: number | null;
  category_name: string | null;
  batch: number | null;
  batch_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  seen_count: number;
  audience_size: number;
  state: PopupState;
  created_at: string;
}

export type PopupInput = Pick<Popup, 'title' | 'body' | 'link' | 'button_label' | 'audience' | 'category' | 'batch' | 'starts_at' | 'ends_at' | 'is_active'>;

@Injectable({ providedIn: 'root' })
export class PopupService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  // Students
  pending() {
    return this.http.get<{ popup: StudentPopup | null }>(`${this.api}/student/popups/pending/`);
  }
  markSeen(id: number) {
    return this.http.post<void>(`${this.api}/student/popups/${id}/seen/`, {});
  }

  // Admin
  list() {
    return this.http.get<Page<Popup>>(`${this.api}/popups/`, { params: { page_size: 100 } });
  }
  save(body: Partial<PopupInput>, id?: number) {
    return id ? this.http.patch<Popup>(`${this.api}/popups/${id}/`, body) : this.http.post<Popup>(`${this.api}/popups/`, body);
  }
  uploadImage(id: number, file: File) {
    const fd = new FormData();
    fd.append('image', file);
    return this.http.post<Popup>(`${this.api}/popups/${id}/image/`, fd);
  }
  removeImage(id: number) {
    return this.http.delete<Popup>(`${this.api}/popups/${id}/image/`);
  }
  remove(id: number) {
    return this.http.delete<void>(`${this.api}/popups/${id}/`);
  }
}
