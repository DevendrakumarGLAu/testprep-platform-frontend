import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { Subject } from '../question-bank/qb.models';
import { QuestionBankService } from '../question-bank/qb.service';
import { ExamCategory } from './exam.models';
import { ExamService } from './exam.service';

interface CatalogueDialogData {
  exam: ExamCategory | null;
  subjects: Subject[];
}

@Component({
  selector: 'app-catalogue-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, MatButtonModule],
  styles: `form { display: flex; flex-direction: column; min-width: min(480px, 82vw); padding-top: 8px; } .err { color: var(--mat-sys-error); margin: 0; }`,
  template: `
    <h2 mat-dialog-title>{{ data.exam ? 'Edit exam' : 'New exam' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="cat-form" (ngSubmit)="save()" novalidate>
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" placeholder="SSC, Banking, Railways…" />
          <mat-error>Required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput rows="3" formControlName="description"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Sections (subjects)</mat-label>
          <mat-select multiple formControlName="subjects">
            @for (s of data.subjects; track s.id) { <mat-option [value]="s.id">{{ s.name }}</mat-option> }
          </mat-select>
          <mat-hint>For SSC: Maths, GK, Reasoning, English. Students see one subject-test group per section.</mat-hint>
        </mat-form-field>
        <mat-slide-toggle formControlName="is_active" style="margin-top: 16px">Visible to students</mat-slide-toggle>
        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button type="submit" form="cat-form" [disabled]="saving()">Save</button>
    </mat-dialog-actions>
  `,
})
export class CatalogueDialog {
  data = inject<CatalogueDialogData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<CatalogueDialog, boolean>);
  private api = inject(ExamService);
  private fb = inject(FormBuilder);
  saving = signal(false);
  error = signal('');

  form = this.fb.nonNullable.group({
    name: [this.data.exam?.name ?? '', Validators.required],
    description: [this.data.exam?.description ?? ''],
    subjects: [this.data.exam?.subjects ?? ([] as number[])],
    is_active: [this.data.exam?.is_active ?? true],
  });

  save() {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.saving.set(true);
    this.api.saveCategory(this.form.getRawValue(), this.data.exam?.id).subscribe({
      next: () => this.ref.close(true),
      error: (e) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(e));
      },
    });
  }
}

@Component({
  selector: 'app-exam-catalogue',
  imports: [MatTableModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  styles: `
    .head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .intro { color: var(--mat-sys-on-surface-variant); max-width: 720px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; }
    .chip { padding: 1px 8px; border-radius: 10px; background: var(--mat-sys-surface-container-high); font-size: 0.85em; margin-right: 4px; display: inline-block; }
    .off { color: var(--mat-sys-error); }
    .empty { padding: 24px; text-align: center; color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <div class="head">
      <h1>Exams</h1>
      <button mat-flat-button (click)="edit(null)"><mat-icon>add</mat-icon> New exam</button>
    </div>
    <p class="intro">
      An exam is what students prepare for, such as SSC. Add its sections (Maths, GK, Reasoning, English), then create tests
      under it as full tests, subject tests or previous year papers. Students pick an exam and attempt any of its tests.
    </p>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    <div class="table-wrap">
      <table mat-table [dataSource]="rows()">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Exam</th>
          <td mat-cell *matCellDef="let c"><strong>{{ c.name }}</strong>@if (c.description) { <div>{{ c.description }}</div> }</td>
        </ng-container>
        <ng-container matColumnDef="sections">
          <th mat-header-cell *matHeaderCellDef>Sections</th>
          <td mat-cell *matCellDef="let c">@for (n of c.subject_names; track n) { <span class="chip">{{ n }}</span> } @empty { — }</td>
        </ng-container>
        <ng-container matColumnDef="tests">
          <th mat-header-cell *matHeaderCellDef>Tests</th>
          <td mat-cell *matCellDef="let c">{{ c.exam_count }}</td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let c"><span [class.off]="!c.is_active">{{ c.is_active ? 'Visible' : 'Hidden' }}</span></td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let c">
            <button mat-icon-button (click)="edit(c)" aria-label="Edit exam"><mat-icon>edit</mat-icon></button>
            <button mat-icon-button (click)="remove(c)" aria-label="Delete exam"><mat-icon>delete</mat-icon></button>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
      @if (!loading() && rows().length === 0) { <div class="empty">No exams yet. Create one, for example SSC.</div> }
    </div>
  `,
})
export class ExamCatalogue {
  private api = inject(ExamService);
  private qb = inject(QuestionBankService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

  columns = ['name', 'sections', 'tests', 'status', 'actions'];
  loading = signal(true);
  rows = signal<ExamCategory[]>([]);
  subjects = signal<Subject[]>([]);

  constructor() {
    this.qb.subjects().subscribe((p) => this.subjects.set(p.results.filter((s) => s.is_active)));
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.categories().subscribe({
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

  edit(exam: ExamCategory | null) {
    this.dialog
      .open(CatalogueDialog, { data: { exam, subjects: this.subjects() } satisfies CatalogueDialogData })
      .afterClosed()
      .subscribe((ok) => {
        if (ok) {
          this.notify.success('Exam saved');
          this.load();
        }
      });
  }

  remove(c: ExamCategory) {
    this.dialog
      .open(ConfirmDialog, {
        data: { title: 'Delete exam?', message: `Delete "${c.name}"? Exams that have tests cannot be deleted; hide them instead.`, confirmLabel: 'Delete' },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.api.deleteCategory(c.id).subscribe({
          next: () => {
            this.notify.success('Exam deleted');
            this.load();
          },
          error: (e) => this.notify.error(apiErrorMessage(e)),
        });
      });
  }
}
