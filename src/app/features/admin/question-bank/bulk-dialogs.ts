import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { today } from '../../../shared/question-age';
import { DuplicateGroup, Subject } from './qb.models';
import { QuestionBankService } from './qb.service';

export interface BulkValueData {
  kind: 'date' | 'subject';
  count: number;
  subjects: Subject[];
}

/** Asks for the one value a bulk change needs: a question date, or the subject to move the questions to. */
@Component({
  selector: 'app-bulk-value-dialog',
  imports: [FormsModule],
  templateUrl: './bulk-value-dialog.html',
  styleUrl: './bulk-value-dialog.scss',
  host: { class: 'bs' },
})
export class BulkValueDialog {
  data = inject<BulkValueData>(MAT_DIALOG_DATA);
  todayStr = today();
  date = signal(today());
  subject = signal<number | null>(null);
  value = () => (this.data.kind === 'date' ? this.date() : this.subject());
  private ref = inject<MatDialogRef<BulkValueDialog, string | number | null>>(MatDialogRef);

  apply() {
    this.ref.close(this.value());
  }

  cancel() {
    this.ref.close(undefined);
  }
}

/** Finds questions with exactly the same text and lets the admin keep one and archive the rest. */
@Component({
  selector: 'app-duplicates-dialog',
  imports: [DatePipe],
  templateUrl: './duplicates-dialog.html',
  styleUrl: './duplicates-dialog.scss',
  host: { class: 'bs' },
})
export class DuplicatesDialog {
  private api = inject(QuestionBankService);
  private notify = inject(NotifyService);
  private ref = inject<MatDialogRef<DuplicatesDialog, boolean>>(MatDialogRef);

  loading = signal(true);
  busy = signal(false);
  changed = signal(false);
  groups = signal<DuplicateGroup[]>([]);
  /** Per group (keyed by its first question id): the question chosen to keep. Defaults to the oldest. */
  keep = signal<Record<number, number>>({});

  constructor() {
    this.api.duplicates().subscribe({
      next: (r) => {
        this.groups.set(r.groups);
        this.keep.set(Object.fromEntries(r.groups.map((g) => [g.questions[0].id, g.questions[0].id])));
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  close() {
    this.ref.close(this.changed());
  }

  choose(g: DuplicateGroup, id: number) {
    this.keep.update((k) => ({ ...k, [g.questions[0].id]: id }));
  }

  resolve(g: DuplicateGroup) {
    const keep = this.keep()[g.questions[0].id];
    const archive = g.questions.map((q) => q.id).filter((id) => id !== keep);
    this.busy.set(true);
    this.api.resolveDuplicates(keep, archive).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.changed.set(true);
        this.groups.update((all) => all.filter((x) => x !== g));
        this.notify.success(
          r.still_used_in.length ? `Archived ${r.archived}. Still used in: ${r.still_used_in.join(', ')}.` : `Archived ${r.archived} duplicate${r.archived === 1 ? '' : 's'}.`,
        );
      },
      error: (e) => {
        this.busy.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }
}
