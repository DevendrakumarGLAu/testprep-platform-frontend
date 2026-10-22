import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { environment } from '../../../../environments/environment';
import { Role, User, apiErrorMessage } from '../../../core/models';

export interface UserDialogData {
  user: User | null;
  allowedRoles: Role[];
}

@Component({
  selector: 'app-user-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  styles: `
    form { display: flex; flex-direction: column; min-width: min(420px, 80vw); padding-top: 8px; }
    .err { color: var(--mat-sys-error); margin: 0; }
  `,
  template: `
    <h2 mat-dialog-title>{{ data.user ? 'Edit user' : 'New user' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="user-form" (ngSubmit)="save()" novalidate>
        <mat-form-field appearance="outline">
          <mat-label>Username</mat-label>
          <input matInput formControlName="username" />
          <mat-error>Required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" />
          <mat-error>A valid email is required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>First name</mat-label>
          <input matInput formControlName="first_name" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Last name</mat-label>
          <input matInput formControlName="last_name" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role">
            @for (r of data.allowedRoles; track r) {
              <mat-option [value]="r">{{ r === 'super_admin' ? 'Super Admin' : r === 'admin' ? 'Admin' : 'Student' }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ data.user ? 'New password (optional)' : 'Password' }}</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="new-password" />
          <mat-error>At least 8 characters</mat-error>
        </mat-form-field>
        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button type="submit" form="user-form" [disabled]="saving()">Save</button>
    </mat-dialog-actions>
  `,
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
