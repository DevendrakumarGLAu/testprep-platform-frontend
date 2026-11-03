import { DatePipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Page, apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { BsPager, PageChange } from '../../shared/bs-pager/bs-pager';

interface LogRow {
  id: number;
  actor_name: string | null;
  action: string;
  target_type: string;
  target_id: string;
  detail: string;
  created_at: string;
}

@Component({
  selector: 'app-activity-log',
  imports: [DatePipe, BsPager],
  templateUrl: './activity-log.html',
  styleUrl: './activity-log.scss',
  host: { class: 'bs' },
})
export class ActivityLogPage {
  private http = inject(HttpClient);
  private notify = inject(NotifyService);

  rows = signal<LogRow[]>([]);
  total = signal(0);
  pageIndex = signal(0);
  loading = signal(true);

  constructor() {
    this.load();
  }

  onPage(e: PageChange) {
    this.pageIndex.set(e.pageIndex);
    this.load();
  }

  private load() {
    this.loading.set(true);
    const params = new HttpParams().set('page', this.pageIndex() + 1).set('page_size', 20);
    this.http.get<Page<LogRow>>(`${environment.apiUrl}/activity-logs/`, { params }).subscribe({
      next: (p) => {
        this.rows.set(p.results);
        this.total.set(p.count);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(err));
      },
    });
  }
}
