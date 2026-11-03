import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BsModal } from '../../coach/bs-modal/bs-modal';
import { REPORT_REASONS } from '../student.models';

export interface ReportDialogResult {
  reason: string;
  message: string;
  image: File | null;
}

export const REPORT_PICTURE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const REPORT_PICTURE_MAX_BYTES = 2 * 1024 * 1024;

/** "Report a problem": what is wrong with the question, and an optional note and picture for the admins. */
@Component({
  selector: 'app-report-modal',
  imports: [FormsModule, BsModal],
  templateUrl: './report-modal.html',
  styleUrl: './report-modal.scss',
  host: { class: 'bs' },
})
export class ReportModal {
  /** The number of the question being reported. */
  number = input.required<number>();
  submitted = output<ReportDialogResult>();
  closed = output<void>();

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
    this.submitted.emit({ reason: this.reason(), message: this.message().trim(), image: this.image() });
  }
}
