import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { BsModal } from '../coach/bs-modal/bs-modal';
import { FeedbackKind, FeedbackService } from './feedback.service';

/** A button in the top bar that opens a small form: tell us what is broken, or an idea. It sends the page the person was on. */
@Component({
  selector: 'app-feedback-button',
  imports: [FormsModule, BsModal],
  templateUrl: './feedback-button.html',
  styleUrl: './feedback-button.scss',
  host: { class: 'bs' },
})
export class FeedbackButton {
  private api = inject(FeedbackService);
  private notify = inject(NotifyService);
  private router = inject(Router);

  readonly kinds: { value: FeedbackKind; label: string; hint: string }[] = [
    { value: 'bug', label: 'Something is broken', hint: 'What did you do, and what happened?' },
    { value: 'idea', label: 'An idea', hint: 'What would make this better for you?' },
    { value: 'other', label: 'Something else', hint: 'Tell us anything.' },
  ];

  open = signal(false);
  busy = signal(false);
  error = signal('');
  kind: FeedbackKind = 'bug';
  message = '';

  get hint() {
    return this.kinds.find((k) => k.value === this.kind)!.hint;
  }

  show() {
    this.error.set('');
    this.open.set(true);
  }

  close() {
    if (!this.busy()) this.open.set(false);
  }

  send() {
    const message = this.message.trim();
    if (message.length < 5) {
      this.error.set('Please write at least a few words.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.api.send({ kind: this.kind, message, page: this.router.url }).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.open.set(false);
        this.message = '';
        this.notify.success(r.detail);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(e));
      },
    });
  }
}
