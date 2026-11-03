import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { BsModal } from '../../coach/bs-modal/bs-modal';
import { Popup, PopupService, PopupState } from '../../popups/popups.service';
import { Batch, ExamCategory } from '../exams/exam.models';
import { ExamService } from '../exams/exam.service';

const STATE_LABEL: Record<PopupState, string> = { live: 'Showing', scheduled: 'Scheduled', ended: 'Ended', off: 'Off' };

/** datetime-local wants "YYYY-MM-DDTHH:mm" in the browser's time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

/** Announcements and new launches that open in a pop-up for students, once each. */
@Component({
  selector: 'app-popups-admin',
  imports: [DatePipe, ReactiveFormsModule, BsModal],
  templateUrl: './popups.html',
  styleUrl: './popups.scss',
  host: { class: 'bs' },
})
export class PopupsAdmin {
  private api = inject(PopupService);
  private exams = inject(ExamService);
  private notify = inject(NotifyService);
  private fb = inject(FormBuilder);

  loading = signal(true);
  rows = signal<Popup[]>([]);
  categories = signal<ExamCategory[]>([]);
  batches = signal<Batch[]>([]);
  editing = signal<Popup | 'new' | null>(null);
  deleting = signal<Popup | null>(null);
  saving = signal(false);
  error = signal('');
  /** A picture chosen in the form: uploaded after the pop-up is saved. */
  file = signal<File | null>(null);
  filePreview = signal<string | null>(null);
  /** The picture the pop-up already has; cleared when the admin removes it. */
  currentImage = signal<string | null>(null);
  removeImage = signal(false);

  form = this.fb.nonNullable.group({
    title: [''],
    body: [''],
    link: [''],
    button_label: ['Open'],
    audience: ['all' as 'all' | 'exam' | 'batch'],
    category: this.fb.control<number | null>(null),
    batch: this.fb.control<number | null>(null),
    starts_at: [''],
    ends_at: [''],
    is_active: [true],
  });

  constructor() {
    this.exams.categories().subscribe((p) => this.categories.set(p.results.filter((c) => c.is_active)));
    this.exams.batches().subscribe((p) => this.batches.set(p.results.filter((b) => b.is_active)));
    this.load();
  }

  label(state: PopupState) {
    return STATE_LABEL[state];
  }

  audienceText(p: Popup) {
    if (p.audience === 'exam') return `Preparing for ${p.category_name}`;
    if (p.audience === 'batch') return `Batch: ${p.batch_name}`;
    return 'All students';
  }

  load() {
    this.loading.set(true);
    this.api.list().subscribe({
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

  open(p: Popup | null) {
    const week = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    this.error.set('');
    this.clearFile();
    this.currentImage.set(p?.image_url ?? null);
    this.removeImage.set(false);
    this.form.reset({
      title: p?.title ?? '',
      body: p?.body ?? '',
      link: p?.link ?? '',
      button_label: p?.button_label ?? 'Open',
      audience: p?.audience ?? 'all',
      category: p?.category ?? null,
      batch: p?.batch ?? null,
      starts_at: toLocalInput(p?.starts_at ?? null),
      ends_at: toLocalInput(p ? p.ends_at : week),
      is_active: p?.is_active ?? true,
    });
    this.editing.set(p ?? 'new');
  }

  private static readonly MAX_BYTES = 2 * 1024 * 1024;

  pick(event: Event) {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) return this.error.set('Choose a JPG, PNG, WebP or GIF picture.');
    if (f.size > PopupsAdmin.MAX_BYTES) return this.error.set('The picture must be 2 MB or smaller.');
    this.error.set('');
    this.clearFile();
    this.file.set(f);
    this.filePreview.set(URL.createObjectURL(f));
  }

  clearFile() {
    const url = this.filePreview();
    if (url) URL.revokeObjectURL(url);
    this.file.set(null);
    this.filePreview.set(null);
  }

  dropCurrentImage() {
    this.currentImage.set(null);
    this.removeImage.set(true);
  }

  save() {
    const v = this.form.getRawValue();
    if (!v.title.trim()) return this.error.set('Give the pop-up a title.');
    if (v.audience === 'exam' && !v.category) return this.error.set('Choose the exam.');
    if (v.audience === 'batch' && !v.batch) return this.error.set('Choose the batch.');
    const current = this.editing();
    const id = current && current !== 'new' ? current.id : undefined;
    this.saving.set(true);
    this.error.set('');
    this.api.save({ ...v, starts_at: fromLocalInput(v.starts_at), ends_at: fromLocalInput(v.ends_at) }, id).subscribe({
      next: (saved) => this.savePicture(saved.id),
      error: (e) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(e));
      },
    });
  }

  /** The text is saved; now add, replace or remove the picture, if the admin asked for that. */
  private savePicture(id: number) {
    const file = this.file();
    const step = file ? this.api.uploadImage(id, file) : this.removeImage() ? this.api.removeImage(id) : null;
    const done = (message: string) => {
      this.saving.set(false);
      this.editing.set(null);
      this.clearFile();
      this.notify.success(message);
      this.load();
    };
    if (!step) return done('Pop-up saved.');
    step.subscribe({
      next: () => done('Pop-up saved.'),
      error: (e) => {
        // The pop-up itself is saved; keep the form open so the picture can be tried again.
        this.saving.set(false);
        this.error.set(`The pop-up was saved, but its picture was not: ${apiErrorMessage(e)}`);
        this.load();
      },
    });
  }

  toggle(p: Popup) {
    this.api.save({ is_active: !p.is_active }, p.id).subscribe({
      next: () => this.load(),
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  confirmDelete() {
    const p = this.deleting();
    if (!p) return;
    this.api.remove(p.id).subscribe({
      next: () => {
        this.deleting.set(null);
        this.notify.success('Pop-up deleted.');
        this.load();
      },
      error: (e) => {
        this.deleting.set(null);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }
}
