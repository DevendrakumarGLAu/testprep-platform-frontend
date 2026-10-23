import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { ConfirmDialog } from '../../../shared/confirm-dialog';
import { today } from '../../../shared/question-age';
import { ExamCategory } from '../exams/exam.models';
import { ExamService } from '../exams/exam.service';
import { Subject } from '../question-bank/qb.models';
import { QuestionBankService } from '../question-bank/qb.service';
import { ContentService, StudyNote } from './content.service';

interface NoteDialogData {
  note: StudyNote | null;
  categories: ExamCategory[];
  subjects: Subject[];
}

@Component({
  selector: 'app-note-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, MatButtonModule],
  styles: `
    form { display: flex; flex-direction: column; min-width: min(640px, 86vw); padding-top: 8px; }
    .row { display: flex; gap: 12px; }
    .row mat-form-field { flex: 1; min-width: 0; }
    .err { color: var(--mat-sys-error); margin: 0; }
  `,
  template: `
    <h2 mat-dialog-title>{{ data.note ? 'Edit study note' : 'New study note' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="note-form" (ngSubmit)="save()" novalidate>
        <mat-form-field appearance="outline">
          <mat-label>Title (English)</mat-label>
          <input matInput formControlName="title" maxlength="200" placeholder="October 2026 current affairs" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>शीर्षक (Hindi)</mat-label>
          <input matInput formControlName="title_hi" maxlength="200" lang="hi" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Note (English)</mat-label>
          <textarea matInput rows="8" formControlName="body" placeholder="One point per line. Start a line with - for a bullet."></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>नोट (Hindi)</mat-label>
          <textarea matInput rows="8" formControlName="body_hi" lang="hi"></textarea>
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Exam</mat-label>
            <mat-select formControlName="category">
              <mat-option [value]="null">Any exam</mat-option>
              @for (c of data.categories; track c.id) { <mat-option [value]="c.id">{{ c.name }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Subject</mat-label>
            <mat-select formControlName="subject">
              <mat-option [value]="null">Any subject</mat-option>
              @for (s of data.subjects; track s.id) { <mat-option [value]="s.id">{{ s.name }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Covers (date)</mat-label>
            <input matInput type="date" formControlName="note_date" />
          </mat-form-field>
        </div>
        <mat-slide-toggle formControlName="is_published">Visible to students</mat-slide-toggle>
        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button type="submit" form="note-form" [disabled]="saving()">Save</button>
    </mat-dialog-actions>
  `,
})
export class NoteDialog {
  data = inject<NoteDialogData>(MAT_DIALOG_DATA);
  private ref = inject<MatDialogRef<NoteDialog, boolean>>(MatDialogRef);
  private api = inject(ContentService);
  private fb = inject(FormBuilder);
  saving = signal(false);
  error = signal('');

  form = this.fb.nonNullable.group({
    title: [this.data.note?.title ?? ''],
    title_hi: [this.data.note?.title_hi ?? ''],
    body: [this.data.note?.body ?? ''],
    body_hi: [this.data.note?.body_hi ?? ''],
    category: this.fb.control<number | null>(this.data.note?.category ?? null),
    subject: this.fb.control<number | null>(this.data.note?.subject ?? null),
    note_date: [this.data.note?.note_date ?? today()],
    is_published: [this.data.note?.is_published ?? false],
  });

  save() {
    const v = this.form.getRawValue();
    if (!(v.title.trim() || v.title_hi.trim())) return this.error.set('Give the note a title in English, Hindi or both.');
    if (!(v.body.trim() || v.body_hi.trim())) return this.error.set('Write the note in English, Hindi or both.');
    this.saving.set(true);
    this.error.set('');
    this.api.saveNote({ ...v, note_date: v.note_date || null }, this.data.note?.id).subscribe({
      next: () => this.ref.close(true),
      error: (e) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(e));
      },
    });
  }
}

/** Study notes and "capsules" (for example a month of current affairs) that students read. */
@Component({
  selector: 'app-study-notes',
  imports: [DatePipe, MatTableModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  styles: `
    .head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    .muted { color: var(--mat-sys-on-surface-variant); }
    .on { color: #2e7d32; }
    table { width: 100%; }
  `,
  template: `
    <div class="head">
      <h1>Study notes</h1>
      <button mat-flat-button (click)="edit(null)"><mat-icon>add</mat-icon> New note</button>
    </div>
    <p class="muted">Short notes and monthly capsules that students read next to their practice. Only published notes are visible to students.</p>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    <table mat-table [dataSource]="rows()">
      <ng-container matColumnDef="title">
        <th mat-header-cell *matHeaderCellDef>Title</th>
        <td mat-cell *matCellDef="let n">{{ n.title || n.title_hi }}</td>
      </ng-container>
      <ng-container matColumnDef="meta">
        <th mat-header-cell *matHeaderCellDef>Exam / subject</th>
        <td mat-cell *matCellDef="let n">{{ n.category_name || 'Any exam' }}{{ n.subject_name ? ' / ' + n.subject_name : '' }}</td>
      </ng-container>
      <ng-container matColumnDef="date">
        <th mat-header-cell *matHeaderCellDef>Covers</th>
        <td mat-cell *matCellDef="let n">{{ n.note_date ? (n.note_date | date: 'mediumDate') : '' }}</td>
      </ng-container>
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>Status</th>
        <td mat-cell *matCellDef="let n"><span [class.on]="n.is_published">{{ n.is_published ? 'Published' : 'Draft' }}</span></td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef></th>
        <td mat-cell *matCellDef="let n">
          <button mat-icon-button (click)="edit(n)" aria-label="Edit note"><mat-icon>edit</mat-icon></button>
          <button mat-icon-button (click)="remove(n)" aria-label="Delete note"><mat-icon>delete</mat-icon></button>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let r; columns: columns"></tr>
    </table>
    @if (!loading() && rows().length === 0) { <p class="muted">No notes yet. Create the first one.</p> }
  `,
})
export class StudyNotes {
  private api = inject(ContentService);
  private exams = inject(ExamService);
  private qb = inject(QuestionBankService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

  columns = ['title', 'meta', 'date', 'status', 'actions'];
  loading = signal(true);
  rows = signal<StudyNote[]>([]);
  private categories: ExamCategory[] = [];
  private subjects: Subject[] = [];

  constructor() {
    this.exams.categories().subscribe((p) => (this.categories = p.results.filter((c) => c.is_active)));
    this.qb.subjects().subscribe((p) => (this.subjects = p.results.filter((s) => s.is_active)));
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.notes().subscribe({
      next: (p) => {
        this.rows.set(p.results);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  edit(note: StudyNote | null) {
    this.dialog
      .open<NoteDialog, NoteDialogData, boolean>(NoteDialog, { data: { note, categories: this.categories, subjects: this.subjects }, width: '720px', maxWidth: '96vw' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.notify.success('Note saved.');
          this.load();
        }
      });
  }

  remove(note: StudyNote) {
    this.dialog
      .open(ConfirmDialog, { data: { title: 'Delete this note?', message: `"${note.title || note.title_hi}" will be removed for everyone.`, confirmLabel: 'Delete' } })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.api.deleteNote(note.id).subscribe({
          next: () => {
            this.notify.success('Note deleted.');
            this.load();
          },
          error: (e) => this.notify.error(apiErrorMessage(e)),
        });
      });
  }
}
