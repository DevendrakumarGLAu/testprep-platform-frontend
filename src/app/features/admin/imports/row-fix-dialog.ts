import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
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
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  styles: `
    form { display: flex; flex-direction: column; min-width: min(520px, 82vw); padding-top: 8px; }
    .errs { color: var(--mat-sys-error); margin: 0 0 12px; padding-left: 18px; }
    .row { display: flex; gap: 12px; } .row mat-form-field { flex: 1; min-width: 0; }
    .err { color: var(--mat-sys-error); }
  `,
  template: `
    <h2 mat-dialog-title>Fix row {{ data.row.row_number }}</h2>
    <mat-dialog-content>
      @if (data.row.errors.length) {
        <ul class="errs">@for (e of data.row.errors; track e) { <li>{{ e }}</li> }</ul>
      }
      <form [formGroup]="form" id="fix-form" (ngSubmit)="save()">
        <mat-form-field appearance="outline">
          <mat-label>Question</mat-label>
          <textarea matInput rows="3" formControlName="question"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Correct answer</mat-label>
          <mat-select formControlName="correct">
            @for (o of options; track o.label) { <mat-option [value]="o.label">{{ o.label }}. {{ o.text }}</mat-option> }
          </mat-select>
          @if (!options.length) { <mat-hint>Needs at least two options in the source file</mat-hint> }
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Subject</mat-label>
            <mat-select formControlName="subject">
              @for (s of data.subjects; track s.id) { <mat-option [value]="s.name">{{ s.name }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Topic (optional)</mat-label>
            <input matInput formControlName="topic" />
          </mat-form-field>
        </div>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Difficulty</mat-label>
            <mat-select formControlName="difficulty">
              <mat-option value="easy">Easy</mat-option><mat-option value="medium">Medium</mat-option><mat-option value="hard">Hard</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Marks</mat-label><input matInput type="number" step="0.25" formControlName="marks" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Negative</mat-label><input matInput type="number" step="0.25" formControlName="negative_marks" /></mat-form-field>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>Explanation</mat-label>
          <textarea matInput rows="2" formControlName="explanation"></textarea>
        </mat-form-field>
        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button type="submit" form="fix-form" [disabled]="saving()">Save and re-check</button>
    </mat-dialog-actions>
  `,
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
