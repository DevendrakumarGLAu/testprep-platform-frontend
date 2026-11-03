import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { DailyQuizStatus } from './student.models';
import { StudentService } from './student.service';

/** "Today's quiz": a short set of recent questions that is the same all day and can be taken once. */
@Component({
  selector: 'app-daily-quiz-card',
  templateUrl: './daily-quiz-card.html',
  styleUrl: './daily-quiz-card.scss',
  host: { class: 'bs' },
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
