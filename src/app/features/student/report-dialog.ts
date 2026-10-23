import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { REPORT_REASONS } from './student.models';

export interface ReportDialogData {
  number: number;
}

export interface ReportDialogResult {
  reason: string;
  message: string;
}

/** "Report a problem": what is wrong with the question, and an optional note for the admins. */
@Component({
  selector: 'app-report-dialog',
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatRadioModule, MatFormFieldModule, MatInputModule],
  styles: `
    mat-radio-group { display: flex; flex-direction: column; margin-bottom: 8px; }
    mat-form-field { width: 100%; }
    .err { color: var(--mat-sys-error); margin: 0; }
  `,
  template: `
    <h2 mat-dialog-title>Report a problem with question {{ data.number }}</h2>
    <mat-dialog-content>
      <p>Tell us what is wrong. The admins will check it and fix the question if needed.</p>
      <mat-radio-group [ngModel]="reason()" (ngModelChange)="reason.set($event); error.set('')" aria-label="What is wrong?">
        @for (r of reasons; track r.value) { <mat-radio-button [value]="r.value">{{ r.label }}</mat-radio-button> }
      </mat-radio-group>
      <mat-form-field appearance="outline">
        <mat-label>{{ reason() === 'other' ? 'Describe the problem' : 'More details (optional)' }}</mat-label>
        <textarea matInput rows="3" maxlength="1000" [ngModel]="message()" (ngModelChange)="message.set($event)"></textarea>
      </mat-form-field>
      @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button (click)="send()">Send report</button>
    </mat-dialog-actions>
  `,
})
export class ReportDialog {
  data = inject<ReportDialogData>(MAT_DIALOG_DATA);
  private ref = inject<MatDialogRef<ReportDialog, ReportDialogResult>>(MatDialogRef);

  reasons = REPORT_REASONS;
  reason = signal('');
  message = signal('');
  error = signal('');

  send() {
    if (!this.reason()) return this.error.set('Choose what is wrong.');
    if (this.reason() === 'other' && this.message().trim().length < 5) return this.error.set('Please describe the problem in a few words.');
    this.ref.close({ reason: this.reason(), message: this.message().trim() });
  }
}
