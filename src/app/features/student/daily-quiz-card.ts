import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { DailyQuizStatus } from './student.models';
import { StudentService } from './student.service';

/** "Today's quiz": a short set of recent questions that is the same all day and can be taken once. */
@Component({
  selector: 'app-daily-quiz-card',
  imports: [MatButtonModule, MatCardModule, MatIconModule],
  styles: `
    mat-card { height: 100%; }
    .head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .head mat-icon { color: var(--mat-sys-primary); }
    p { margin: 4px 0 12px; color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <mat-card appearance="outlined">
      <mat-card-content>
        <div class="head"><mat-icon>bolt</mat-icon><strong>Today's quiz</strong></div>
        @if (!status()) {
          <p>Loading…</p>
        } @else if (status()!.done) {
          <p>You finished today's quiz. A new one is ready tomorrow.</p>
          <button mat-stroked-button disabled>Done for today</button>
        } @else if (status()!.available || status()!.in_progress) {
          <p>{{ status()!.size }} recent questions, the same for the whole day.</p>
          <button mat-flat-button (click)="start()" [disabled]="busy()">
            {{ status()!.in_progress ? 'Continue quiz' : 'Start quiz' }}
          </button>
        } @else {
          <p>Today's quiz will be ready once enough recent questions are added.</p>
          <button mat-stroked-button disabled>Not ready yet</button>
        }
      </mat-card-content>
    </mat-card>
  `,
})
export class DailyQuizCard {
  private api = inject(StudentService);
  private router = inject(Router);
  private notify = inject(NotifyService);

  status = signal<DailyQuizStatus | null>(null);
  busy = signal(false);

  constructor() {
    this.api.dailyQuiz().subscribe({ next: (s) => this.status.set(s), error: () => this.status.set({ available: false, done: false, in_progress: false, size: 10 }) });
  }

  start() {
    this.busy.set(true);
    this.api.startDailyQuiz().subscribe({
      next: (r) => this.router.navigate(['/student/attempt', r.attempt_id]),
      error: (e) => {
        this.busy.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }
}
