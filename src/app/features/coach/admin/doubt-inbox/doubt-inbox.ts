import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiErrorMessage } from '../../../../core/models';
import { NotifyService } from '../../../../core/notify.service';
import { DoubtConversation } from '../../doubt-conversation/doubt-conversation';
import { CoachService } from '../../coach.service';
import { DOUBT_LABEL, DoubtDetail, DoubtInbox as InboxData, DoubtRow, DoubtStatus } from '../../coach.models';

/** The teachers' inbox of student doubts: pick one, read it, reply (with an optional AI draft), and set its status. */
@Component({
  selector: 'app-doubt-inbox',
  imports: [FormsModule, DatePipe, DoubtConversation],
  templateUrl: './doubt-inbox.html',
  styleUrl: './doubt-inbox.scss',
  host: { class: 'bs' },
})
export class DoubtInbox {
  private api = inject(CoachService);
  private notify = inject(NotifyService);

  inbox = signal<InboxData>({ counts: { open: 0, answered: 0, resolved: 0 }, results: [] });
  filter = signal<DoubtStatus | ''>('open');
  search = '';
  loading = signal(true);
  error = signal('');
  selected = signal<DoubtDetail | null>(null);
  opening = signal(false);
  busy = signal(false);
  drafting = signal(false);
  usedAi = signal(false);
  reply = '';
  protected label = DOUBT_LABEL;

  readonly tabs: { value: DoubtStatus | ''; text: string }[] = [
    { value: 'open', text: 'Waiting' },
    { value: 'answered', text: 'Answered' },
    { value: 'resolved', text: 'Resolved' },
    { value: '', text: 'All' },
  ];

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.api.inbox(this.filter(), this.search.trim()).subscribe({
      next: (d) => {
        this.inbox.set(d);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(e));
      },
    });
  }

  pick(value: DoubtStatus | '') {
    this.filter.set(value);
    this.load();
  }

  count(value: DoubtStatus | '') {
    const c = this.inbox().counts;
    return value === '' ? c.open + c.answered + c.resolved : c[value];
  }

  open(row: DoubtRow) {
    this.opening.set(true);
    this.api.doubt(row.id).subscribe({
      next: (d) => {
        this.selected.set(d);
        this.opening.set(false);
        this.reply = '';
        this.usedAi.set(false);
      },
      error: (e) => {
        this.opening.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  back() {
    this.selected.set(null);
  }

  draft() {
    const d = this.selected();
    if (!d) return;
    this.drafting.set(true);
    this.api.aiSuggest(d.id).subscribe({
      next: (r) => {
        this.reply = r.suggestion;
        this.usedAi.set(true);
        this.drafting.set(false);
        this.notify.success('Draft ready. Please read and edit it before you send.');
      },
      error: (e) => {
        this.drafting.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  send() {
    const d = this.selected();
    const text = this.reply.trim();
    if (!d) return;
    if (text.length < 5) {
      this.notify.error('Please write at least 5 characters.');
      return;
    }
    this.busy.set(true);
    this.api.answer(d.id, text, this.usedAi()).subscribe({
      next: (u) => {
        this.selected.set(u);
        this.reply = '';
        this.usedAi.set(false);
        this.busy.set(false);
        this.notify.success('Reply sent. The student has been told.');
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  setStatus(status: DoubtStatus) {
    const d = this.selected();
    if (!d) return;
    this.api.setDoubtStatus(d.id, status).subscribe({
      next: (u) => {
        this.selected.set(u);
        this.load();
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  badge(status: DoubtStatus) {
    return status === 'resolved' ? 'text-bg-success' : status === 'answered' ? 'text-bg-primary' : 'text-bg-warning';
  }
}
