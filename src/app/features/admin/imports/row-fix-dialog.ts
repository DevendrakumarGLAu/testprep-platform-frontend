import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/models';
import { Subject } from '../question-bank/qb.models';
import { ImportJob, ImportRowData, ImportService } from './import.service';

export interface RowFixData {
  jobId: number;
  row: ImportRowData;
  subjects: Subject[];
}

/** Quick fixes for one imported row. Options themselves are edited in the source file. */
@Component({
  selector: 'app-row-fix-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './row-fix-dialog.html',
  styleUrl: './row-fix-dialog.scss',
  host: { class: 'bs' },
})
export class RowFixDialog {
  data = inject<RowFixData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<RowFixDialog, ImportJob>);
  private api = inject(ImportService);
  private fb = inject(FormBuilder);
  saving = signal(false);
  error = signal('');

  options = this.data.row.normalized?.options ?? [];
  form = this.fb.nonNullable.group({
    question: [this.data.row.normalized?.question ?? ''],
    correct: [this.data.row.normalized?.correct_label ?? ''],
    subject: [this.data.row.normalized?.subject ?? ''],
    topic: [this.data.row.normalized?.topic ?? ''],
    difficulty: [this.data.row.normalized?.difficulty ?? 'medium'],
    marks: [this.data.row.normalized?.marks ?? '1'],
    negative_marks: [this.data.row.normalized?.negative_marks ?? '0'],
    explanation: [this.data.row.normalized?.explanation ?? ''],
  });

  cancel() {
    this.ref.close(undefined);
  }

  save() {
    this.saving.set(true);
    const fixes = Object.fromEntries(Object.entries(this.form.getRawValue()).map(([k, v]) => [k, String(v ?? '')]));
    this.api.patchRow(this.data.jobId, this.data.row.id, { fixes }).subscribe({
      next: (res) => this.ref.close(res.job),
      error: (e) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(e));
      },
    });
  }
}
