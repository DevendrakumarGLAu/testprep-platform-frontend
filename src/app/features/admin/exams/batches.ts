import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { User, apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { ConfirmDialog } from '../../../shared/confirm-dialog';
import { Batch } from './exam.models';
import { ExamService } from './exam.service';
import { StudentPicker } from './student-picker';

@Component({
  selector: 'app-batch-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './batch-dialog.html',
  styleUrl: './batch-dialog.scss',
  host: { class: 'bs' },
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

  cancel() {
    this.ref.close(false);
  }

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
  imports: [StudentPicker],
  templateUrl: './members-dialog.html',
  styleUrl: './members-dialog.scss',
  host: { class: 'bs' },
})
export class MembersDialog {
  batch = inject<Batch>(MAT_DIALOG_DATA);
  private api = inject(ExamService);
  private notify = inject(NotifyService);
  loading = signal(true);
  members = signal<User[]>([]);
  toAdd = signal<number[]>([]);
  changed = signal(false);
  private ref = inject<MatDialogRef<MembersDialog, boolean>>(MatDialogRef);

  constructor() {
    this.load();
  }

  close() {
    this.ref.close(this.changed());
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
  imports: [],
  templateUrl: './batches.html',
  styleUrl: './batches.scss',
  host: { class: 'bs' },
})
export class Batches {
  private api = inject(ExamService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

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
