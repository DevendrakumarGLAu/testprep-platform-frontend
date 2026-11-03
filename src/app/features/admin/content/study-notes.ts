import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
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
  imports: [ReactiveFormsModule],
  templateUrl: './note-dialog.html',
  styleUrl: './note-dialog.scss',
  host: { class: 'bs' },
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

  cancel() {
    this.ref.close(false);
  }

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
  imports: [DatePipe],
  templateUrl: './study-notes.html',
  styleUrl: './study-notes.scss',
  host: { class: 'bs' },
})
export class StudyNotes {
  private api = inject(ContentService);
  private exams = inject(ExamService);
  private qb = inject(QuestionBankService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

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
