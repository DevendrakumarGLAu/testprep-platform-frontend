import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
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
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  styles: `mat-form-field { width: 100%; min-width: min(360px, 80vw); } .note { color: var(--mat-sys-on-surface-variant); }`,
  template: `
    <h2 mat-dialog-title>{{ data.kind === 'date' ? 'Set the question date' : 'Move to another subject' }}</h2>
    <mat-dialog-content>
      <p class="note">This changes {{ data.count }} selected question{{ data.count === 1 ? '' : 's' }}.</p>
      @if (data.kind === 'date') {
        <mat-form-field appearance="outline">
          <mat-label>Question date</mat-label>
          <input matInput type="date" [max]="todayStr" [ngModel]="date()" (ngModelChange)="date.set($event)" />
        </mat-form-field>
      } @else {
        <mat-form-field appearance="outline">
          <mat-label>Subject</mat-label>
          <mat-select [ngModel]="subject()" (ngModelChange)="subject.set($event)">
            @for (s of data.subjects; track s.id) { <mat-option [value]="s.id">{{ s.name }}</mat-option> }
          </mat-select>
          <mat-hint>Their topics are cleared, because topics belong to one subject.</mat-hint>
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button [disabled]="!value()" [mat-dialog-close]="value()">Apply</button>
    </mat-dialog-actions>
  `,
})
export class BulkValueDialog {
  data = inject<BulkValueData>(MAT_DIALOG_DATA);
  todayStr = today();
  date = signal(today());
  subject = signal<number | null>(null);
  value = () => (this.data.kind === 'date' ? this.date() : this.subject());
}

/** Finds questions with exactly the same text and lets the admin keep one and archive the rest. */
@Component({
  selector: 'app-duplicates-dialog',
  imports: [DatePipe, FormsModule, MatDialogModule, MatButtonModule, MatRadioModule, MatProgressBarModule],
  styles: `
    mat-dialog-content { min-width: min(760px, 88vw); }
    .group { border: 1px solid var(--mat-sys-outline-variant); border-radius: 12px; padding: 12px; margin-bottom: 12px; }
    .text { font-weight: 500; margin-bottom: 6px; }
    .copy { display: flex; align-items: center; gap: 8px; padding: 2px 0; flex-wrap: wrap; }
    .copy .meta { color: var(--mat-sys-on-surface-variant); font-size: 0.85em; }
    .used { color: var(--mat-sys-primary); font-size: 0.85em; }
    .empty { padding: 24px; text-align: center; color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <h2 mat-dialog-title>Duplicate questions</h2>
    <mat-dialog-content>
      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
      <p class="meta">Questions with exactly the same text. Choose the one to keep: the other copies are archived (hidden from new tests, never deleted).</p>
      @for (g of groups(); track g.questions[0].id) {
        <div class="group">
          <div class="text">{{ g.text }}</div>
          <mat-radio-group [ngModel]="keep()[g.questions[0].id]" (ngModelChange)="choose(g, $event)" [attr.aria-label]="'Which copy to keep'">
            @for (q of g.questions; track q.id) {
              <div class="copy">
                <mat-radio-button [value]="q.id">Keep #{{ q.id }}</mat-radio-button>
                <span class="meta">{{ q.subject }} · added {{ q.created_at | date: 'mediumDate' }}{{ q.question_date ? ' · dated ' + q.question_date : '' }}</span>
                @if (q.used_in.length) { <span class="used">in {{ q.used_in.join(', ') }}</span> }
              </div>
            }
          </mat-radio-group>
          <button mat-stroked-button (click)="resolve(g)" [disabled]="busy()">Archive the other {{ g.questions.length - 1 }}</button>
        </div>
      } @empty {
        @if (!loading()) { <div class="empty">No duplicates found. The question bank is clean.</div> }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button [mat-dialog-close]="changed()">Close</button></mat-dialog-actions>
  `,
})
export class DuplicatesDialog {
  private api = inject(QuestionBankService);
  private notify = inject(NotifyService);

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
