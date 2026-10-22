import { DatePipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { environment } from '../../../environments/environment';
import { Page, apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';

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
  imports: [DatePipe, MatTableModule, MatPaginatorModule, MatProgressBarModule],
  styles: `.table-wrap { overflow-x: auto; } table { width: 100%; }`,
  template: `
    <h1>Activity log</h1>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    <div class="table-wrap">
      <table mat-table [dataSource]="rows()">
        <ng-container matColumnDef="created_at">
          <th mat-header-cell *matHeaderCellDef>When</th>
          <td mat-cell *matCellDef="let r">{{ r.created_at | date: 'medium' }}</td>
        </ng-container>
        <ng-container matColumnDef="actor_name">
          <th mat-header-cell *matHeaderCellDef>Admin</th>
          <td mat-cell *matCellDef="let r">{{ r.actor_name || '—' }}</td>
        </ng-container>
        <ng-container matColumnDef="action">
          <th mat-header-cell *matHeaderCellDef>Action</th>
          <td mat-cell *matCellDef="let r">{{ r.action }}</td>
        </ng-container>
        <ng-container matColumnDef="target">
          <th mat-header-cell *matHeaderCellDef>Target</th>
          <td mat-cell *matCellDef="let r">{{ r.target_type }} {{ r.target_id }}</td>
        </ng-container>
        <ng-container matColumnDef="detail">
          <th mat-header-cell *matHeaderCellDef>Detail</th>
          <td mat-cell *matCellDef="let r">{{ r.detail }}</td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
    </div>
    <mat-paginator [length]="total()" [pageIndex]="pageIndex()" [pageSize]="20" (page)="onPage($event)" hidePageSize />
  `,
})
export class ActivityLogPage {
  private http = inject(HttpClient);
  private notify = inject(NotifyService);

  columns = ['created_at', 'actor_name', 'action', 'target', 'detail'];
  rows = signal<LogRow[]>([]);
  total = signal(0);
  pageIndex = signal(0);
  loading = signal(true);

  constructor() {
    this.load();
  }

  onPage(e: PageEvent) {
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
