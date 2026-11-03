import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { environment } from '../../../../environments/environment';
import { Role, User, apiErrorMessage } from '../../../core/models';

export interface UserDialogData {
  user: User | null;
  allowedRoles: Role[];
}

@Component({
  selector: 'app-user-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './user-dialog.html',
  styleUrl: './user-dialog.scss',
  host: { class: 'bs' },
})
export class UserDialog {
  data = inject<UserDialogData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<UserDialog, boolean>);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);

  saving = signal(false);
  error = signal('');

  form = this.fb.nonNullable.group({
    username: [this.data.user?.username ?? '', Validators.required],
    email: [this.data.user?.email ?? '', [Validators.required, Validators.email]],
    first_name: [this.data.user?.first_name ?? ''],
    last_name: [this.data.user?.last_name ?? ''],
    role: [this.data.user?.role ?? this.data.allowedRoles[this.data.allowedRoles.length - 1]],
    password: ['', this.data.user ? [Validators.minLength(8)] : [Validators.required, Validators.minLength(8)]],
  });

  /** Show a field's error once it has been touched or the person tried to save. */
  bad(c: AbstractControl) {
    return c.invalid && (c.touched || c.dirty);
  }

  cancel() {
    this.ref.close(false);
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const { password, ...rest } = this.form.getRawValue();
    const body = password ? { ...rest, password } : rest;
    const url = `${environment.apiUrl}/users/`;
    const req = this.data.user
      ? this.http.patch(`${url}${this.data.user.id}/`, body)
      : this.http.post(url, body);
    req.subscribe({
      next: () => this.ref.close(true),
      error: (err) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
  }
}
