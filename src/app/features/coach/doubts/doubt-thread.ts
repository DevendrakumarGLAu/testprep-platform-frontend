import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { DoubtConversation } from '../doubt-conversation/doubt-conversation';
import { CoachService } from '../coach.service';
import { DoubtDetail } from '../coach.models';

/** One of the student's doubts: the teacher's answers, a box to write back, and a button to say it is cleared. */
@Component({
  selector: 'app-doubt-thread',
  imports: [FormsModule, RouterLink, DoubtConversation],
  templateUrl: './doubt-thread.html',
  styleUrl: './doubt-thread.scss',
  host: { class: 'bs' },
})
export class DoubtThread {
  id = input.required<string>();
  private api = inject(CoachService);
  private notify = inject(NotifyService);

  doubt = signal<DoubtDetail | null>(null);
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  reply = '';

  constructor() {
    effect(() => {
      this.loading.set(true);
      this.api.myDoubt(this.id()).subscribe({
        next: (d) => {
          this.doubt.set(d);
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          this.error.set(e.status === 404 ? 'This doubt was not found.' : apiErrorMessage(e));
        },
      });
    });
  }

  send() {
    const d = this.doubt();
    const text = this.reply.trim();
    if (!d || text.length < 5) {
      this.notify.error('Please write at least 5 characters.');
      return;
    }
    this.busy.set(true);
    this.api.replyToDoubt(d.id, text).subscribe({
      next: (u) => {
        this.doubt.set(u);
        this.reply = '';
        this.busy.set(false);
      },
      error: (e) => {
        this.busy.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  resolve() {
    const d = this.doubt();
    if (!d) return;
    this.busy.set(true);
    this.api.resolveDoubt(d.id).subscribe({
      next: (u) => {
        this.doubt.set(u);
        this.busy.set(false);
        this.notify.success('Marked as resolved.');
      },
      error: (e) => {
        this.busy.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }
}
