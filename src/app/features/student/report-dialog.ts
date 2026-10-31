import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
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
  image: File | null;
}

export const REPORT_PICTURE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const REPORT_PICTURE_MAX_BYTES = 2 * 1024 * 1024;

/** "Report a problem": what is wrong with the question, and an optional note for the admins. */
@Component({
  selector: 'app-report-dialog',
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatRadioModule, MatFormFieldModule, MatInputModule, MatIconModule],
  styles: `
    mat-radio-group { display: flex; flex-direction: column; margin-bottom: 8px; }
    mat-form-field { width: 100%; }
    .picture { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
    .picture img { max-height: 90px; max-width: 160px; border-radius: 8px; border: 1px solid var(--mat-sys-outline-variant); }
    .hint { color: var(--mat-sys-on-surface-variant); font-size: 0.85rem; margin: 0 0 8px; }
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
      <div class="picture">
        <button mat-stroked-button type="button" (click)="file.click()"><mat-icon>add_photo_alternate</mat-icon> {{ preview() ? 'Change picture' : 'Add a picture' }}</button>
        <input #file type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" (change)="pick($event)" />
        @if (preview()) {
          <img [src]="preview()" alt="The picture you are sending" />
          <button mat-button type="button" (click)="remove()">Remove</button>
        }
      </div>
      <p class="hint">Optional. You can also paste a screenshot with Ctrl+V. JPG, PNG, WebP or GIF, up to 2 MB.</p>
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
  image = signal<File | null>(null);
  preview = signal('');

  constructor() {
    const onPaste = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith('image/'));
      if (!f) return;
      e.preventDefault();
      this.setImage(f);
    };
    document.addEventListener('paste', onPaste);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('paste', onPaste);
      this.release();
    });
  }

  pick(event: Event) {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = ''; // so the same file can be chosen again
    if (f) this.setImage(f);
  }

  remove() {
    this.release();
    this.image.set(null);
    this.preview.set('');
  }

  private setImage(f: File) {
    if (!REPORT_PICTURE_TYPES.includes(f.type)) return this.error.set('Use a JPG, PNG, WebP or GIF picture.');
    if (f.size > REPORT_PICTURE_MAX_BYTES) return this.error.set('The picture must be 2 MB or smaller.');
    this.release();
    this.error.set('');
    this.image.set(f);
    this.preview.set(URL.createObjectURL(f));
  }

  private release() {
    const url = this.preview();
    if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
  }

  send() {
    if (!this.reason()) return this.error.set('Choose what is wrong.');
    if (this.reason() === 'other' && this.message().trim().length < 5) return this.error.set('Please describe the problem in a few words.');
    this.ref.close({ reason: this.reason(), message: this.message().trim(), image: this.image() });
  }
}
