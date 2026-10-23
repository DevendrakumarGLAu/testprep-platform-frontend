import { Component, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { ShareCardData, shareCard } from '../../shared/share-card';
import { LeaderboardData, formatSeconds } from './student.models';
import { StudentService } from './student.service';

/** Under a student's result: their rank, the top of the leaderboard, and a button to redo the questions they missed. */
@Component({
  selector: 'app-result-extras',
  imports: [MatButtonModule, MatCardModule, MatIconModule],
  styles: `
    :host { display: block; margin: 16px 0; }
    mat-card { margin-bottom: 12px; }
    .rank { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
    .big { font: var(--mat-sys-display-small); color: var(--mat-sys-primary); line-height: 1; }
    .muted { color: var(--mat-sys-on-surface-variant); }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    tr.me { background: var(--mat-sys-primary-container); font-weight: 500; }
    .tools { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .redo { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  `,
  template: `
    <div class="tools no-print">
      <button mat-stroked-button (click)="share()" [disabled]="!card()"><mat-icon>share</mat-icon> Share my score</button>
      <button mat-stroked-button (click)="print()"><mat-icon>print</mat-icon> Print or save as PDF</button>
    </div>
    @if (wrong() > 0) {
      <mat-card appearance="outlined"><mat-card-content class="redo">
        <mat-icon>replay</mat-icon>
        <span>You missed <strong>{{ wrong() }}</strong> question{{ wrong() === 1 ? '' : 's' }}. Try them again as a short practice set.</span>
        <button mat-flat-button (click)="redo()" [disabled]="busy()">Redo my mistakes</button>
      </mat-card-content></mat-card>
    }
    @if (board(); as b) {
      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>Leaderboard</mat-card-title><mat-card-subtitle>{{ b.participants }} student{{ b.participants === 1 ? '' : 's' }} attempted this test</mat-card-subtitle></mat-card-header>
        <mat-card-content>
          @if (b.me; as me) {
            <div class="rank">
              <div><div class="big">#{{ me.rank }}</div><div class="muted">your rank</div></div>
              <div>
                <strong>{{ me.score }} / {{ me.total_marks }}</strong>
                <div class="muted">
                  @if (b.participants > 1) { Better than {{ me.better_than_percent }}% of students } @else { You are the first to attempt it }
                  · your best attempt
                </div>
              </div>
            </div>
          }
          <table>
            <thead><tr><th>Rank</th><th>Student</th><th>Score</th><th>Time</th></tr></thead>
            <tbody>
              @for (r of b.top; track r.rank + r.name) {
                <tr [class.me]="r.is_me"><td>{{ r.rank }}</td><td>{{ r.name }}{{ r.is_me ? ' (you)' : '' }}</td><td>{{ r.score }} / {{ r.total_marks }}</td><td>{{ r.time_taken_seconds === null ? '' : seconds(r.time_taken_seconds) }}</td></tr>
              }
            </tbody>
          </table>
        </mat-card-content>
      </mat-card>
    }
  `,
})
export class ResultExtras {
  attemptId = input.required<string>();
  examId = input.required<string>();
  /** Number of questions answered wrongly or left blank. */
  wrong = input(0);
  /** What goes on the score card; the rank is added from the leaderboard when there is one. */
  card = input<ShareCardData | null>(null);

  private api = inject(StudentService);
  private router = inject(Router);
  private notify = inject(NotifyService);

  board = signal<LeaderboardData | null>(null);
  busy = signal(false);
  seconds = formatSeconds;

  constructor() {
    queueMicrotask(() => {
      // The board is a bonus: if it is not available (results not released, practice set), just leave it out.
      this.api.leaderboard(this.examId()).subscribe({ next: (b) => this.board.set(b), error: () => this.board.set(null) });
    });
  }

  async share() {
    const base = this.card();
    if (!base) return;
    const me = this.board()?.me;
    const result = await shareCard({ ...base, rank: me?.rank ?? null, participants: this.board()?.participants ?? null });
    if (result === 'downloaded') this.notify.success('Your score card was saved as a picture.');
    else if (result === 'failed') this.notify.error('Could not make the score card.');
  }

  print() {
    window.print();
  }

  redo() {
    this.busy.set(true);
    this.api.practiceMistakes(this.attemptId()).subscribe({
      next: (r) => this.router.navigate(['/student/attempt', r.attempt_id]),
      error: (e) => {
        this.busy.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }
}
