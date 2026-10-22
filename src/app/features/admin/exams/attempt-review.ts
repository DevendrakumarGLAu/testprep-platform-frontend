import { Component, effect, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { ResultView } from '../../../shared/result-view';
import { ResultData } from '../../../shared/result.models';
import { ExamService } from './exam.service';

/** Admin view of one student's attempt, always with full solutions. */
@Component({
  selector: 'app-attempt-review',
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, ResultView],
  template: `
    <button mat-button (click)="back()"><mat-icon>arrow_back</mat-icon> Back</button>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    @if (data(); as d) { <app-result-view [data]="d" /> }
  `,
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
