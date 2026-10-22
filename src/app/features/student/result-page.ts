import { Component, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { ResultView } from '../../shared/result-view';
import { ResultData } from '../../shared/result.models';
import { StudentService } from './student.service';

@Component({
  selector: 'app-student-result',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule, ResultView],
  template: `
    <a mat-button routerLink="/student/attempts"><mat-icon>arrow_back</mat-icon> My attempts</a>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    @if (data(); as d) {
      <app-result-view [data]="d" />
    } @else if (message()) {
      <mat-card appearance="outlined"><mat-card-content>
        <h2>{{ message() }}</h2>
        <a mat-flat-button routerLink="/student/attempts">Back to my attempts</a>
      </mat-card-content></mat-card>
    }
  `,
})
export class StudentResultPage {
  id = input.required<string>();
  private api = inject(StudentService);
  loading = signal(true);
  data = signal<ResultData | null>(null);
  message = signal('');

  constructor() {
    effect(() => {
      this.loading.set(true);
      this.api.result(this.id()).subscribe({
        next: (d) => {
          this.data.set(d);
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          this.message.set(
            e.status === 403 ? 'Your result has not been released yet. Check back later.'
              : e.status === 404 ? 'Result not found.' : apiErrorMessage(e),
          );
        },
      });
    });
  }
}
