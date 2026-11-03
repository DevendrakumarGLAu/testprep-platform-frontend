import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { BsPager, PageChange } from '../../../shared/bs-pager/bs-pager';
import { Subject, Topic } from '../question-bank/qb.models';
import { QuestionBankService } from '../question-bank/qb.service';
import {
  ImportDefaults, ImportJob, ImportMapping, ImportRowData, ImportService, ImportSource, saveBlob,
} from './import.service';
import { RowFixDialog } from './row-fix-dialog';

type Step = 'upload' | 'map' | 'review' | 'done';

const FIELD_LABELS: { key: keyof Omit<ImportMapping, 'options' | 'options_hi'>; label: string; required?: boolean }[] = [
  { key: 'question', label: 'Question text (English)' },
  { key: 'question_hi', label: 'Question text (Hindi)' },
  { key: 'correct', label: 'Correct answer (A, B, 1, 2 or the option text)', required: true },
  { key: 'explanation', label: 'Explanation (English)' },
  { key: 'explanation_hi', label: 'Explanation (Hindi)' },
  { key: 'subject', label: 'Subject' },
  { key: 'topic', label: 'Topic' },
  { key: 'difficulty', label: 'Difficulty' },
  { key: 'question_date', label: 'Question date (YYYY-MM-DD or DD/MM/YYYY)' },
  { key: 'marks', label: 'Marks' },
  { key: 'negative_marks', label: 'Negative marks' },
  { key: 'tags', label: 'Tags (comma separated)' },
];

@Component({
  selector: 'app-import-wizard',
  imports: [FormsModule, RouterLink, BsPager],
  templateUrl: './import-wizard.html',
  styleUrl: './import-wizard.scss',
  host: { class: 'bs' },
})
export class ImportWizard {
  private api = inject(ImportService);
  private qb = inject(QuestionBankService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);
  private router = inject(Router);

  readonly stepList: { id: Step; label: string }[] = [
    { id: 'upload', label: 'Upload' }, { id: 'map', label: 'Map columns' },
    { id: 'review', label: 'Review' }, { id: 'done', label: 'Done' },
  ];
  readonly fields = FIELD_LABELS;

  step = signal<Step>('upload');
  stepIndex = computed(() => this.stepList.findIndex((s) => s.id === this.step()));
  busy = signal(false);
  error = signal('');
  uploadError = signal('');

  sources = signal<ImportSource[]>([]);
  subjects = signal<Subject[]>([]);
  topics = signal<Topic[]>([]);

  job = signal<ImportJob | null>(null);
  mapping = signal<ImportMapping>({ options: [] });
  defaults: ImportDefaults & { subject: number | null; topic: number | null } = {
    subject: null, topic: null, difficulty: 'medium', marks: 1, negative_marks: 0,
  };
  createMissing = false;

  rows = signal<ImportRowData[]>([]);
  total = signal(0);
  page = signal(1);
  filter = signal('');
  selectedCount = computed(() => this.job()?.selected_count ?? 0);
  topicsFor = computed(() => this.topics().filter((t) => t.subject === this.defaults.subject));

  constructor() {
    this.api.sources().subscribe((s) => this.sources.set(s));
    this.qb.subjects().subscribe((p) => this.subjects.set(p.results.filter((s) => s.is_active)));
    this.qb.topics().subscribe((p) => this.topics.set(p.results.filter((t) => t.is_active)));
  }

  // --- 1 upload ---
  template(kind: 'csv' | 'xlsx') {
    this.api.template(kind).subscribe({
      next: (b) => saveBlob(b, `question-import-template.${kind}`),
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  pick(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (f) this.upload(f);
    (ev.target as HTMLInputElement).value = '';
  }

  drop(ev: DragEvent) {
    ev.preventDefault();
    const f = ev.dataTransfer?.files?.[0];
    if (f) this.upload(f);
  }

  private upload(file: File) {
    this.uploadError.set('');
    this.busy.set(true);
    this.api.upload(file).subscribe({
      next: (j) => {
        this.busy.set(false);
        this.job.set(j);
        this.mapping.set({ ...j.mapping, options: [...(j.mapping.options ?? [])], options_hi: [...(j.mapping.options_hi ?? [])] });
        this.step.set('map');
      },
      error: (e) => {
        this.busy.set(false);
        this.uploadError.set(e.error?.file ? String(e.error.file) : apiErrorMessage(e));
      },
    });
  }

  // --- 2 map ---
  setField(key: keyof Omit<ImportMapping, 'options' | 'options_hi'>, value: string) {
    this.mapping.update((m) => ({ ...m, [key]: value || undefined }));
  }

  setOptions(selected: string[]) {
    const order = this.job()!.headers;
    this.mapping.update((m) => ({ ...m, options: [...selected].sort((a, b) => order.indexOf(a) - order.indexOf(b)) }));
  }

  /** Ticks or unticks one column as an option column; the chosen ones stay in file order (A, B, C…). */
  toggleOption(header: string, on: boolean) {
    const now = this.mapping().options.filter((h) => h !== header);
    this.setOptions(on ? [...now, header] : now);
  }

  toggleOptionHi(header: string, on: boolean) {
    const now = (this.mapping().options_hi ?? []).filter((h) => h !== header);
    this.setOptionsHi(on ? [...now, header] : now);
  }

  setOptionsHi(selected: string[]) {
    const order = this.job()!.headers;
    this.mapping.update((m) => ({ ...m, options_hi: [...selected].sort((a, b) => order.indexOf(a) - order.indexOf(b)) }));
  }

  validate() {
    const m = this.mapping();
    if (!m.question && !m.question_hi) return this.error.set('Choose the column that holds the question text (English or Hindi).');
    if (!m.correct) return this.error.set('Choose the column that holds the correct answer.');
    if (Math.max(m.options.length, m.options_hi?.length ?? 0) < 2) return this.error.set('Choose at least two option columns.');
    this.error.set('');
    this.busy.set(true);
    const clean = Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined && v !== '')) as unknown as ImportMapping;
    this.api.process(this.job()!.id, clean, { ...this.defaults }, this.createMissing).subscribe({
      next: (j) => {
        this.job.set(j);
        this.filter.set('');
        this.page.set(1);
        this.step.set('review');
        this.loadRows();
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(e.error?.mapping ? String(e.error.mapping) : apiErrorMessage(e));
      },
    });
  }

  // --- 3 review ---
  loadRows() {
    this.busy.set(true);
    this.api.rows(this.job()!.id, this.filter(), this.page()).subscribe({
      next: (p) => {
        this.rows.set(p.results);
        this.total.set(p.count);
        this.busy.set(false);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(e));
      },
    });
  }

  setFilter(v: string) {
    this.filter.set(v);
    this.page.set(1);
    this.loadRows();
  }

  onPage(e: PageChange) {
    this.page.set(e.pageIndex + 1);
    this.loadRows();
  }

  toggle(r: ImportRowData, selected: boolean) {
    this.api.patchRow(this.job()!.id, r.id, { selected }).subscribe({
      next: (res) => {
        this.rows.update((l) => l.map((x) => (x.id === r.id ? res.row : x)));
        this.job.set(res.job);
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  select(mode: 'valid' | 'none' | 'valid_and_duplicates') {
    this.api.select(this.job()!.id, mode).subscribe({
      next: (j) => {
        this.job.set(j);
        this.loadRows();
      },
    });
  }

  fix(r: ImportRowData) {
    this.dialog
      .open(RowFixDialog, { data: { jobId: this.job()!.id, row: r, subjects: this.subjects() }, width: '600px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((job) => {
        if (!job) return;
        this.job.set(job);
        this.loadRows();
      });
  }

  commit() {
    this.busy.set(true);
    this.error.set('');
    this.api.commit(this.job()!.id).subscribe({
      next: (j) => {
        this.busy.set(false);
        this.job.set(j);
        this.step.set('done');
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(e.error?.detail ? String(e.error.detail) : apiErrorMessage(e));
      },
    });
  }

  // --- 4 done ---
  downloadReport() {
    const id = this.job()!.id;
    this.api.failedReport(id).subscribe({
      next: (b) => saveBlob(b, `import-${id}-failed-rows.csv`),
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  cancel() {
    const j = this.job();
    if (!j) return this.reset();
    this.api.discard(j.id).subscribe({ next: () => this.reset(), error: () => this.router.navigateByUrl('/admin/questions') });
  }

  reset() {
    this.job.set(null);
    this.rows.set([]);
    this.step.set('upload');
    this.error.set('');
  }
}
