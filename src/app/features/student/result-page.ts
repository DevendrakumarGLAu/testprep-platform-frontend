import { Component, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { ResultView } from '../../shared/result-view';
import { ResultData } from '../../shared/result.models';
import { PlatformService } from '../../core/platform.service';
import { ShareCardData } from '../../shared/share-card';
import { ReportDialog, ReportDialogResult } from './report-dialog';
import { ResultExtras } from './result-extras';
import { StudentService } from './student.service';

@Component({
  selector: 'app-student-result',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule, ResultView, ResultExtras],
  template: `
    <a mat-button routerLink="/student/attempts"><mat-icon>arrow_back</mat-icon> My attempts</a>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    @if (data(); as d) {
      @if (d.solutions_available) {
        <app-result-extras [attemptId]="id()" [examId]="'' + d.exam.id" [wrong]="d.summary.incorrect + d.summary.unanswered" [card]="card(d)" />
      }
      <app-result-view [data]="d" [canAct]="true" (saveToggle)="toggleSave($event)" (report)="reportQuestion($event)" />
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
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);
  private platform = inject(PlatformService);
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

  card(d: ResultData): ShareCardData {
    return {
      platform: this.platform.info().platform_name, title: d.exam.title, score: d.summary.score, totalMarks: d.summary.total_marks,
      percent: d.summary.percentage, correct: d.summary.correct, incorrect: d.summary.incorrect, unanswered: d.summary.unanswered,
    };
  }

  /** Replaces one question's flags in the shown result without reloading the whole page. */
  private patchQuestion(number: number, change: { saved_id?: number | null; report_status?: 'open' | 'resolved' | 'rejected' | null }) {
    this.data.update((d) => (d ? { ...d, questions: d.questions.map((q) => (q.number === number ? { ...q, ...change } : q)) } : d));
  }

  async toggleSave(number: number) {
    const q = this.data()?.questions.find((x) => x.number === number);
    if (!q) return;
    try {
      if (q.saved_id) {
        await firstValueFrom(this.api.unsaveQuestion(this.id(), number));
        this.patchQuestion(number, { saved_id: null });
        this.notify.success('Removed from your saved questions.');
      } else {
        const saved = await firstValueFrom(this.api.saveQuestion(this.id(), number));
        this.patchQuestion(number, { saved_id: saved.id });
        this.notify.success('Saved. Find it under Saved questions.');
      }
    } catch (e) {
      this.notify.error(apiErrorMessage(e));
    }
  }

  async reportQuestion(number: number) {
    const result = await firstValueFrom(
      this.dialog.open<ReportDialog, { number: number }, ReportDialogResult>(ReportDialog, { data: { number }, width: '480px', maxWidth: '95vw' }).afterClosed(),
    );
    if (!result) return;
    try {
      await firstValueFrom(this.api.reportQuestion(this.id(), number, result.reason, result.message));
      this.patchQuestion(number, { report_status: 'open' });
      this.notify.success('Thanks. The admins will look at this question.');
    } catch (e) {
      this.notify.error(apiErrorMessage(e));
    }
  }
}
