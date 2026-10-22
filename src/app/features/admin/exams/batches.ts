import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { User, apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { ConfirmDialog } from '../../../shared/confirm-dialog';
import { Batch } from './exam.models';
import { ExamService } from './exam.service';
import { StudentPicker } from './student-picker';

@Component({
  selector: 'app-batch-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSlideToggleModule, MatButtonModule],
  styles: `form { display: flex; flex-direction: column; min-width: min(420px, 80vw); padding-top: 8px; } .err { color: var(--mat-sys-error); margin: 0; }`,
  template: `
    <h2 mat-dialog-title>{{ batch ? 'Edit batch' : 'New batch' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="batch-form" (ngSubmit)="save()" novalidate>
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" />
          <mat-error>Required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput rows="3" formControlName="description"></textarea>
        </mat-form-field>
        <mat-slide-toggle formControlName="is_active">Active</mat-slide-toggle>
        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button type="submit" form="batch-form" [disabled]="saving()">Save</button>
    </mat-dialog-actions>
  `,
})
export class BatchDialog {
  batch = inject<Batch | null>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<BatchDialog, boolean>);
  private api = inject(ExamService);
  private fb = inject(FormBuilder);
  saving = signal(false);
  error = signal('');

  form = this.fb.nonNullable.group({
    name: [this.batch?.name ?? '', Validators.required],
    description: [this.batch?.description ?? ''],
    is_active: [this.batch?.is_active ?? true],
  });

  save() {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.saving.set(true);
    this.api.saveBatch(this.form.getRawValue(), this.batch?.id).subscribe({
      next: () => this.ref.close(true),
      error: (e) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(e));
      },
    });
  }
}

@Component({
  selector: 'app-members-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, StudentPicker, MatProgressBarModule],
  styles: `
    h3 { margin: 16px 0 4px; }
    .member { display: flex; align-items: center; justify-content: space-between; padding: 2px 0; }
    .muted { color: var(--mat-sys-on-surface-variant); }
    mat-dialog-content { min-width: min(520px, 85vw); }
  `,
  template: `
    <h2 mat-dialog-title>Members of {{ batch.name }}</h2>
    <mat-dialog-content>
      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
      <h3>Current members ({{ members().length }})</h3>
      @for (m of members(); track m.id) {
        <div class="member">
          <span>{{ (m.first_name + ' ' + m.last_name).trim() || m.username }} <span class="muted">{{ m.email }}</span></span>
          <button mat-icon-button (click)="remove(m)" aria-label="Remove from batch"><mat-icon>person_remove</mat-icon></button>
        </div>
      } @empty {
        <p class="muted">No students in this batch yet.</p>
      }
      <h3>Add students</h3>
      <app-student-picker [value]="toAdd()" (changed)="toAdd.set($event)" />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="changed()">Close</button>
      <button mat-flat-button (click)="add()" [disabled]="!toAdd().length">Add {{ toAdd().length || '' }} selected</button>
    </mat-dialog-actions>
  `,
})
export class MembersDialog {
  batch = inject<Batch>(MAT_DIALOG_DATA);
  private api = inject(ExamService);
  private notify = inject(NotifyService);
  loading = signal(true);
  members = signal<User[]>([]);
  toAdd = signal<number[]>([]);
  changed = signal(false);

  constructor() {
    this.load();
  }

  private load() {
    this.api.batchMembers(this.batch.id).subscribe((m) => {
      this.members.set(m);
      this.loading.set(false);
    });
  }

  add() {
    this.api.addMembers(this.batch.id, this.toAdd()).subscribe({
      next: () => {
        this.toAdd.set([]);
        this.changed.set(true);
        this.load();
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  remove(m: User) {
    this.api.removeMembers(this.batch.id, [m.id]).subscribe({
      next: () => {
        this.changed.set(true);
        this.load();
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }
}

@Component({
  selector: 'app-batches',
  imports: [MatTableModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  styles: `
    .head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; }
    .empty { padding: 24px; text-align: center; color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <div class="head">
      <h1>Batches</h1>
      <button mat-flat-button (click)="edit(null)"><mat-icon>add</mat-icon> New batch</button>
    </div>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    <div class="table-wrap">
      <table mat-table [dataSource]="rows()">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Batch</th>
          <td mat-cell *matCellDef="let b">{{ b.name }}</td>
        </ng-container>
        <ng-container matColumnDef="members">
          <th mat-header-cell *matHeaderCellDef>Students</th>
          <td mat-cell *matCellDef="let b">{{ b.member_count }}</td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let b">{{ b.is_active ? 'Active' : 'Inactive' }}</td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let b">
            <button mat-icon-button (click)="members(b)" aria-label="Manage members"><mat-icon>group_add</mat-icon></button>
            <button mat-icon-button (click)="edit(b)" aria-label="Edit batch"><mat-icon>edit</mat-icon></button>
            <button mat-icon-button (click)="remove(b)" aria-label="Delete batch"><mat-icon>delete</mat-icon></button>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
      @if (!loading() && rows().length === 0) { <div class="empty">No batches yet.</div> }
    </div>
  `,
})
export class Batches {
  private api = inject(ExamService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

  columns = ['name', 'members', 'status', 'actions'];
  loading = signal(true);
  rows = signal<Batch[]>([]);

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.batches().subscribe({
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

  edit(b: Batch | null) {
    this.dialog.open(BatchDialog, { data: b }).afterClosed().subscribe((ok) => {
      if (ok) {
        this.notify.success('Batch saved');
        this.load();
      }
    });
  }

  members(b: Batch) {
    this.dialog.open(MembersDialog, { data: b, width: '600px', maxWidth: '95vw' }).afterClosed().subscribe((changed) => changed && this.load());
  }

  remove(b: Batch) {
    this.dialog
      .open(ConfirmDialog, {
        data: { title: 'Delete batch?', message: `Delete "${b.name}"? Students are not deleted. Batches assigned to tests cannot be deleted.`, confirmLabel: 'Delete' },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.api.deleteBatch(b.id).subscribe({
          next: () => {
            this.notify.success('Batch deleted');
            this.load();
          },
          error: (e) => this.notify.error(apiErrorMessage(e)),
        });
      });
  }
}
