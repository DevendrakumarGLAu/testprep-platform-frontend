import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { environment } from '../../../../environments/environment';
import { apiErrorMessage } from '../../../core/models';

export interface ResetPasswordData {
  id: number;
  username: string;
  name: string;
}

/**
 * Gives someone a temporary password when they cannot get an email. The password is shown once; the person has to choose their
 * own at their next sign-in, and any device they were signed in on is signed out.
 */
@Component({
  selector: 'app-reset-password-dialog',
  imports: [],
  templateUrl: './reset-password-dialog.html',
  styleUrl: './reset-password-dialog.scss',
  host: { class: 'bs' },
})
export class ResetPasswordDialog {
  data = inject<ResetPasswordData>(MAT_DIALOG_DATA);
  private http = inject(HttpClient);
  private ref = inject<MatDialogRef<ResetPasswordDialog>>(MatDialogRef);

  password = signal('');
  busy = signal(false);
  copied = signal(false);
  error = signal('');

  reset() {
    this.busy.set(true);
    this.error.set('');
    this.http.post<{ temporary_password: string }>(`${environment.apiUrl}/users/${this.data.id}/reset-password/`, {}).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.password.set(r.temporary_password);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(e));
      },
    });
  }

  close() {
    this.ref.close();
  }

  copy() {
    navigator.clipboard?.writeText(this.password()).then(() => this.copied.set(true), () => undefined);
  }
}
