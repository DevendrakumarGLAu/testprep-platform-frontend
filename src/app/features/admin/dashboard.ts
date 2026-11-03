import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { ChartComponent } from '../../shared/chart';
import { AdminDashboardData, ReportsService } from './students/reports.service';

@Component({
  selector: 'app-admin-dashboard',
  imports: [DatePipe, RouterLink, ChartComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  host: { class: 'bs' },
})
export class AdminDashboard {
  auth = inject(AuthService);
  private api = inject(ReportsService);
  private notify = inject(NotifyService);

  loading = signal(true);
  d = signal<AdminDashboardData | null>(null);

  participationLabels = computed(() => (this.d()?.participation ?? []).map((p) => p.date.slice(5)));
  participationSeries = computed(() => [{ label: 'Attempts', data: (this.d()?.participation ?? []).map((p) => p.attempts) }]);
  distLabels = computed(() => (this.d()?.score_distribution ?? []).map((b) => b.range));
  distSeries = computed(() => [{ label: 'Attempts', data: (this.d()?.score_distribution ?? []).map((b) => b.count) }]);
  subjectLabels = computed(() => (this.d()?.subjects ?? []).map((s) => s.subject));
  subjectSeries = computed(() => [{ label: 'Accuracy %', data: (this.d()?.subjects ?? []).map((s) => s.accuracy) }]);

  constructor() {
    this.api.dashboard().subscribe({
      next: (d) => {
        this.d.set(d);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }
}
