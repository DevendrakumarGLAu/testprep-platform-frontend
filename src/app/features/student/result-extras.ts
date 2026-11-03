import { Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { ShareCardData, shareCard } from '../../shared/share-card';
import { LeaderboardData, formatSeconds } from './student.models';
import { StudentService } from './student.service';

/** Under a student's result: their rank, the top of the leaderboard, and a button to redo the questions they missed. */
@Component({
  selector: 'app-result-extras',
  templateUrl: './result-extras.html',
  styleUrl: './result-extras.scss',
  host: { class: 'bs' },
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
