import { Component, effect, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { ResultView } from '../../../shared/result-view';
import { ResultData } from '../../../shared/result.models';
import { ExamService } from './exam.service';

/** Admin view of one student's attempt, always with full solutions. */
@Component({
  selector: 'app-attempt-review',
  imports: [ResultView],
  templateUrl: './attempt-review.html',
  styleUrl: './attempt-review.scss',
  host: { class: 'bs' },
})
export class AttemptReview {
  id = input.required<string>();
  private api = inject(ExamService);
  private notify = inject(NotifyService);
  private location = inject(Location);
  loading = signal(true);
  data = signal<ResultData | null>(null);

  constructor() {
    effect(() => {
      this.api.attemptResult(+this.id()).subscribe({
        next: (d) => {
          this.data.set(d);
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          this.notify.error(apiErrorMessage(e));
        },
      });
    });
  }

  back() {
    this.location.back();
  }
}
