import { DecimalPipe } from '@angular/common';
import { Component, HostListener, computed, effect, inject, input, signal } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { DuplicateMatch, Question, Subject, Topic } from './qb.models';
import { QuestionBankService } from './qb.service';
import { today } from '../../../shared/question-age';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

function optionsValid(control: AbstractControl): ValidationErrors | null {
  const rows = (control as FormArray).controls;
  for (const field of ['text', 'text_hi']) {
    const texts = rows.map((r) => (r.value[field] ?? '').trim().toLowerCase()).filter(Boolean);
    if (new Set(texts).size !== texts.length) return { duplicateOptions: true };
  }
  if (rows.filter((r) => r.value.is_correct).length !== 1) return { oneCorrect: true };
  return null;
}

@Component({
  selector: 'app-question-form',
  imports: [DecimalPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './question-form.html',
  styleUrl: './question-form.scss',
  host: { class: 'bs' },
})
export class QuestionForm {
  // Bound from the :id route param (withComponentInputBinding).
  id = input<string>();

  private api = inject(QuestionBankService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private notify = inject(NotifyService);

  readonly todayStr = today();
  readonly MIN = MIN_OPTIONS;
  readonly MAX = MAX_OPTIONS;

  loading = signal(false);
  saving = signal(false);
  error = signal('');
  subjects = signal<Subject[]>([]);
  topics = signal<Topic[]>([]);
  tags = signal<string[]>([]);
  duplicates = signal<DuplicateMatch[]>([]);
  imageUrl = signal<string | null>(null);
  pendingFile: File | null = null;
  pendingPreview = signal<string | null>(null);
  source = signal('');
  version = signal(1);
  openReports = signal(0);
  subjectId = signal<number | null>(null);
  correctIndex = signal<number | null>(null);
  lang = signal<'en' | 'hi'>('en');

  topicOptions = computed(() => this.topics().filter((t) => t.subject === this.subjectId()));

  form = this.fb.group({
    text: [''],
    text_hi: [''],
    subject: this.fb.control<number | null>(null, Validators.required),
    topic: this.fb.control<number | null>(null),
    difficulty: ['medium'],
    question_type: ['single_mcq'],
    question_date: [today(), [Validators.required, (c: AbstractControl) => (c.value && c.value > today() ? { future: true } : null)]],
    explanation: [''],
    explanation_hi: [''],
    video_url: [''],
    is_active: [true],
    review_status: ['approved'],
    allow_duplicate: [false],
    options: this.fb.array([this.newOption(), this.newOption(), this.newOption(), this.newOption()], optionsValid),
  });

  get options() {
    return this.form.controls.options;
  }

  constructor() {
    this.api.subjects().subscribe((p) => this.subjects.set(p.results.filter((s) => s.is_active)));
    this.api.topics().subscribe((p) => this.topics.set(p.results.filter((t) => t.is_active)));
    this.form.controls.subject.valueChanges.subscribe((v) => this.subjectId.set(v));

    effect(() => {
      const id = this.id();
      if (id) this.load(+id);
    });
  }

  private newOption(text = '', is_correct = false, id?: number, text_hi = '') {
    return this.fb.nonNullable.group({
      id: [id as number | undefined],
      text: [text],
      text_hi: [text_hi],
      is_correct: [is_correct],
    });
  }

  /** One language of the question: complete (stem and every option), empty, or started but unfinished. */
  status(code: 'en' | 'hi'): 'complete' | 'empty' | 'incomplete' {
    const f = code === 'en' ? 'text' : 'text_hi';
    const stem = !!(this.form.getRawValue()[f] ?? '').trim();
    const filled = this.options.controls.map((c) => !!(c.value[f] ?? '').trim());
    if (stem && filled.every(Boolean)) return 'complete';
    return stem || filled.some(Boolean) ? 'incomplete' : 'empty';
  }

  statusLabel(code: 'en' | 'hi') {
    return { complete: '✓', empty: '(empty)', incomplete: '(unfinished)' }[this.status(code)];
  }

  /** Why the question cannot be saved yet, or an empty string. */
  languageProblem(): string {
    const en = this.status('en');
    const hi = this.status('hi');
    if (en === 'incomplete') return 'The English version is unfinished: it needs the question and every option, or clear it.';
    if (hi === 'incomplete') return 'The Hindi version is unfinished: it needs the question and every option, or clear it.';
    if (en === 'empty' && hi === 'empty') return 'Enter the question and its options in English, Hindi, or both.';
    return '';
  }

  letter(i: number) {
    return String.fromCharCode(65 + i);
  }

  private load(id: number) {
    this.loading.set(true);
    this.api.question(id).subscribe({
      next: (q) => {
        this.patch(q);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
        this.router.navigateByUrl('/admin/questions');
      },
    });
  }

  private patch(q: Question) {
    // Make sure the question's own subject/topic stay selectable even if later archived.
    if (!this.subjects().some((s) => s.id === q.subject)) {
      this.subjects.update((l) => [...l, { id: q.subject, name: q.subject_name } as Subject]);
    }
    if (q.topic && !this.topics().some((t) => t.id === q.topic)) {
      this.topics.update((l) => [...l, { id: q.topic!, subject: q.subject, name: q.topic_name! } as Topic]);
    }
    this.options.clear();
    q.options.forEach((o) => this.options.push(this.newOption(o.text, o.is_correct, o.id, o.text_hi ?? '')));
    this.form.patchValue({
      text: q.text, text_hi: q.text_hi ?? '', explanation_hi: q.explanation_hi ?? '', video_url: q.video_url ?? '', question_date: q.question_date ?? '', review_status: q.review_status ?? 'approved', subject: q.subject, topic: q.topic, difficulty: q.difficulty, question_type: q.question_type,
      explanation: q.explanation, is_active: q.is_active,
    });
    this.lang.set(q.languages?.length === 1 ? q.languages[0] : 'en');
    this.subjectId.set(q.subject);
    this.correctIndex.set(q.options.findIndex((o) => o.is_correct));
    this.tags.set(q.tags);
    this.imageUrl.set(q.image_url);
    this.source.set(q.source_info ? `${q.source} (${q.source_info})` : q.source);
    this.version.set(q.version);
    this.openReports.set(q.open_reports ?? 0);
  }

  addOption() {
    if (this.options.length < MAX_OPTIONS) this.options.push(this.newOption());
  }

  removeOption(i: number) {
    if (this.options.length <= MIN_OPTIONS) return;
    this.options.removeAt(i);
    this.syncCorrect(this.correctIndex() === i ? null : (this.correctIndex()! > i ? this.correctIndex()! - 1 : this.correctIndex()));
  }

  setCorrect(i: number) {
    this.syncCorrect(i);
  }

  private syncCorrect(idx: number | null) {
    this.correctIndex.set(idx);
    this.options.controls.forEach((c, i) => c.patchValue({ is_correct: i === idx }));
    this.options.markAsTouched();
    this.options.updateValueAndValidity();
  }

  /** Enter or a comma ends a tag. */
  tagKey(event: KeyboardEvent, input: HTMLInputElement) {
    if (event.key !== 'Enter' && event.key !== ',') return;
    event.preventDefault();
    this.addTag(input);
  }

  /** Takes what is typed in the tag box as a tag (Enter, a comma or leaving the box) and empties the box. */
  addTag(input: HTMLInputElement) {
    const v = (input.value || '').trim().toLowerCase();
    if (v && !this.tags().includes(v)) this.tags.update((t) => [...t, v]);
    input.value = '';
  }

  /** Show a field's error once it has been touched or the person tried to save. */
  bad(c: AbstractControl) {
    return c.invalid && (c.touched || c.dirty);
  }

  removeTag(t: string) {
    this.tags.update((l) => l.filter((x) => x !== t));
  }

  /** A screenshot or copied picture pasted anywhere on the page becomes the question's image (text pastes are left alone). */
  @HostListener('document:paste', ['$event'])
  pasteImage(ev: ClipboardEvent) {
    const f = [...(ev.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'));
    if (!f) return;
    ev.preventDefault();
    this.takeImage(f);
  }

  pickImage(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = ''; // so choosing the same file again still counts
    if (f) this.takeImage(f);
  }

  private takeImage(f: File) {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) {
      this.notify.error('Use a JPG, PNG, WebP or GIF picture.');
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      this.notify.error('Image must be 2 MB or smaller.');
      return;
    }
    if (this.id()) {
      this.api.uploadImage(+this.id()!, f).subscribe({
        next: (q) => this.imageUrl.set(q.image_url),
        error: (e) => this.notify.error(apiErrorMessage(e)),
      });
    } else {
      this.pendingFile = f;
      this.pendingPreview.set(URL.createObjectURL(f));
    }
  }

  removeImage() {
    this.api.removeImage(+this.id()!).subscribe({
      next: () => this.imageUrl.set(null),
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  checkDuplicates() {
    const text = (this.form.value.text || this.form.value.text_hi || '').trim();
    if (text.length < 5) return this.duplicates.set([]);
    this.api.checkDuplicates(text, this.form.value.subject ?? null, this.id() ? +this.id()! : undefined).subscribe({
      next: (d) => {
        this.duplicates.set(d);
        if (!d.length) this.form.controls.allow_duplicate.setValue(false);
      },
    });
  }

  save() {
    this.form.markAllAsTouched();
    this.options.markAsTouched();
    const problem = this.languageProblem();
    if (problem) {
      this.error.set(problem);
      return;
    }
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    const v = this.form.getRawValue();
    const body = {
      ...v,
      tags: this.tags(),
      options: v.options.map((o) => ({ ...(o.id ? { id: o.id } : {}), text: o.text.trim(), text_hi: (o.text_hi ?? '').trim(), is_correct: o.is_correct })),
    };
    this.api.saveQuestion(body, this.id() ? +this.id()! : undefined).subscribe({
      next: (q) => {
        const done = () => {
          this.notify.success('Question saved');
          this.router.navigateByUrl('/admin/questions');
        };
        if (this.pendingFile) {
          this.api.uploadImage(q.id, this.pendingFile).subscribe({
            next: done,
            error: (e) => {
              this.notify.error('Saved, but the image upload failed: ' + apiErrorMessage(e));
              this.router.navigate(['/admin/questions', q.id]);
            },
          });
        } else {
          done();
        }
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(e));
        if (e.error?.text) this.checkDuplicates();
      },
    });
  }
}
