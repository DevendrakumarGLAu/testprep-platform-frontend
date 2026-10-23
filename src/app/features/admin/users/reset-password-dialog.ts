import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
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
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  styles: `
    .pw { display: flex; align-items: center; gap: 8px; margin: 12px 0; padding: 12px 16px; border-radius: 12px; background: var(--mat-sys-surface-container-high); font: 600 1.4rem/1 monospace; letter-spacing: 2px; user-select: all; }
    .note { color: var(--mat-sys-on-surface-variant); }
    .err { color: var(--mat-sys-error); }
  `,
  template: `
    <h2 mat-dialog-title>Reset password</h2>
    <mat-dialog-content>
      @if (!password()) {
        <p>Give <strong>{{ data.name }}</strong> ({{ data.username }}) a temporary password? They will be signed out everywhere and must choose a new password when they sign in again.</p>
        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      } @else {
        <p>Give this temporary password to <strong>{{ data.name }}</strong>. It is shown only once.</p>
        <div class="pw" aria-label="Temporary password">{{ password() }}
          <button mat-icon-button (click)="copy()" aria-label="Copy the password"><mat-icon>{{ copied() ? 'check' : 'content_copy' }}</mat-icon></button>
        </div>
        <p class="note">Username: {{ data.username }}. They will be asked to choose their own password straight after signing in.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (!password()) {
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-flat-button (click)="reset()" [disabled]="busy()">Reset password</button>
      } @else {
        <button mat-flat-button mat-dialog-close>Done</button>
      }
    </mat-dialog-actions>
  `,
})
export class ResetPasswordDialog {
  data = inject<ResetPasswordData>(MAT_DIALOG_DATA);
  private http = inject(HttpClient);

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

  copy() {
    navigator.clipboard?.writeText(this.password()).then(() => this.copied.set(true), () => undefined);
  }
}
