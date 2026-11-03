import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/models';
import { BsModal } from '../bs-modal/bs-modal';
import { CoachService } from '../coach.service';

/** A dialog where a student asks a teacher about one question of a result review. */
@Component({
  selector: 'app-ask-doubt',
  imports: [FormsModule, RouterLink, BsModal],
  templateUrl: './ask-doubt.html',
  styleUrl: './ask-doubt.scss',
  host: { class: 'bs' },
})
export class AskDoubt {
  attemptId = input.required<string>();
  number = input.required<number>();
  closed = output<void>();

  private api = inject(CoachService);
  readonly max = 1500;
  readonly min = 5;
  message = '';
  busy = signal(false);
  error = signal('');
  doubtId = signal<number | null>(null);

  get length() {
    return this.message.trim().length;
  }

  send() {
    this.error.set('');
    if (this.length < this.min) {
      this.error.set(`Please write at least ${this.min} characters.`);
      return;
    }
    this.busy.set(true);
    this.api.askDoubt(this.attemptId(), this.number(), this.message.trim()).subscribe({
      next: (d) => {
        this.busy.set(false);
        this.doubtId.set(d.id);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(e));
      },
    });
  }
}
