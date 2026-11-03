import { isOld } from '../../../shared/question-age';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { BsTab, BsTabs } from '../../../shared/bs-tabs/bs-tabs';
import { openPicker } from '../../../shared/pickers';
import { Question, Subject } from '../question-bank/qb.models';
import { QuestionBankService } from '../question-bank/qb.service';
import { AccessType, Batch, Exam, ExamCategory, ExamSection, TEST_TYPE_LABELS, TestType, fromLocalInput, toLocalInput, ExamPattern } from './exam.models';
import { ExamService } from './exam.service';
import { QuestionPicker } from './question-picker';
import { StudentPicker } from './student-picker';

@Component({
  selector: 'app-exam-form',
  imports: [ReactiveFormsModule, RouterLink, StudentPicker, BsTabs],
  templateUrl: './exam-form.html',
  styleUrl: './exam-form.scss',
  host: { class: 'bs' },
})
export class ExamForm {
  id = input<string>();

  private api = inject(ExamService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private notify = inject(NotifyService);
  private dialog = inject(MatDialog);
  private qb = inject(QuestionBankService);

  /** The open tab: 0 details, 1 questions, 2 access. The last two open once the test has been saved. */
  tab = signal(0);
  tabs = computed<BsTab[]>(() => [
    { key: 'details', label: 'Details & rules' },
    { key: 'questions', label: 'Questions', disabled: !this.exam() },
    { key: 'access', label: 'Access & assignment', disabled: !this.exam() },
  ]);
  pickDate = openPicker;
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  problems = signal<string[]>([]);
  exam = signal<Exam | null>(null);
  categories = signal<ExamCategory[]>([]);
  subjects = signal<Subject[]>([]);
  readonly testTypes = (Object.keys(TEST_TYPE_LABELS) as TestType[]).map((value) => ({ value, label: TEST_TYPE_LABELS[value] }));
  batches = signal<Batch[]>([]);
  sections = signal<ExamSection[]>([{ name: 'Section 1', questions: [] }]);
  access = signal<AccessType>('public');
  premium = signal(false);
  price = signal('');
  premiumStudentIds = signal<number[]>([]);
  premiumBatchIds = signal<number[]>([]);
  studentIds = signal<number[]>([]);
  batchIds = signal<number[]>([]);

  locked = computed(() => !!this.exam()?.locked);
  totalQuestions = computed(() => this.sections().reduce((n, s) => n + s.questions.length, 0));
  totalMarks = computed(() =>
    this.sections().reduce((t, s) => t + s.questions.reduce((m, q) => m + (parseFloat(q.marks) || 0), 0), 0).toFixed(2),
  );

  form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
    instructions: [''],
    category: this.fb.control<number | null>(null),
    also_in: this.fb.nonNullable.control<number[]>([]),
    test_type: this.fb.nonNullable.control<TestType>('full_test'),
    tab_key: this.fb.nonNullable.control(''),
    subject: this.fb.control<number | null>(null),
    year: this.fb.control<number | null>(null),
    duration_minutes: [60, [Validators.required, Validators.min(1), Validators.max(600)]],
    marks_per_question: [1, [Validators.required, Validators.min(0.01)]],
    passing_marks: [0, [Validators.required, Validators.min(0)]],
    max_attempts: [1, [Validators.required, Validators.min(0), Validators.max(50)]],
    unanswered_penalty: [0, [Validators.required, Validators.min(0)]],
    negative_option: ['fraction' as 'off' | 'question' | 'fraction' | 'fixed'],
    negative_value: [0.25],
    sectional_timing: [false],
    shuffle_questions: [false],
    shuffle_options: [false],
    allow_pause: [true],
    is_live: [false],
    late_join_minutes: [10, [Validators.required, Validators.min(0), Validators.max(180)]],
    max_pauses: [0, [Validators.required, Validators.min(0), Validators.max(20)]],
    pause_minutes: [0, [Validators.required, Validators.min(0), Validators.max(120)]],
    start_at: [''],
    end_at: [''],
    result_release: ['immediate'],
    result_release_at: [''],
    solution_release: ['with_result'],
  });

  readonly presets = [
    { label: '1/5', value: 0.2 }, { label: '1/4', value: 0.25 }, { label: '1/3', value: 0.3333 }, { label: '1/2', value: 0.5 },
  ];

  private raw = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue()), startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });
  /** The test's current negative marking choice, as a signal so the questions tab follows the details tab. */
  /** What every question in this test is worth, as typed on the Details tab. */
  marksPer = computed(() => Number(this.raw().marks_per_question) || 0);
  rule = computed(() => ({ option: this.raw().negative_option, value: Number(this.raw().negative_value) || 0 }));
  sectional = computed(() => !!this.raw().sectional_timing);
  live = computed(() => !!this.raw().is_live);
  /** The page students open for this live test; empty until the test is saved. */
  liveLink = computed(() => {
    const e = this.exam();
    return this.live() && e?.public_id ? `${window.location.origin}/student/live/${e.public_id}` : '';
  });
  /** The exam's own tabs (added by the admin), which this test may be shown in. */
  customTabs = computed(() => (this.selectedCategory()?.tabs ?? []).filter((t) => t.custom));
  selectedCategory = computed(() => this.categories().find((c) => c.id === this.raw().category) ?? null);
  /** Exams this test can also be shown in: every exam except its own. */
  otherCategories = computed(() => this.categories().filter((c) => c.id !== this.raw().category));
  /** The saved pattern of the chosen exam, or null when it has none. */
  pattern = computed(() => {
    const p = this.selectedCategory()?.pattern;
    return p && Object.keys(p).length ? p : null;
  });
  patternSummary = computed(() => {
    const p = this.pattern();
    if (!p) return '';
    const parts: string[] = [];
    if (p.duration_minutes) parts.push(`${p.duration_minutes} min`);
    if (p.marks_per_question) parts.push(`${p.marks_per_question} mark${p.marks_per_question === 1 ? '' : 's'} each`);
    if (p.negative_option === 'off') parts.push('no negative marking');
    else if (p.negative_option === 'fraction' || p.negative_option === 'fixed') parts.push(`negative ${p.negative_value ?? 0}${p.negative_option === 'fraction' ? ' of the marks' : ''}`);
    if (p.sectional_timing) parts.push('timed sections');
    if (p.sections?.length) parts.push(`${p.sections.length} section${p.sections.length === 1 ? '' : 's'}: ${p.sections.map((s) => s.name).join(', ')}`);
    return parts.join(' · ');
  });
  /** Minutes of all section time limits together. */
  sectionTotal = computed(() => this.sections().reduce((t, s) => t + (s.duration_minutes || 0), 0));
  ruleSetsNegative = computed(() => this.rule().option === 'fraction' || this.rule().option === 'fixed');

  /** Show a field's error once it has been touched or the person tried to save. */
  bad(c: AbstractControl) {
    return c.invalid && (c.touched || c.dirty);
  }

  toggleAlsoIn(id: number, on: boolean) {
    const now = this.form.controls.also_in.value.filter((x) => x !== id);
    this.form.controls.also_in.setValue(on ? [...now, id] : now);
    this.form.controls.also_in.markAsDirty();
  }

  /** Adds or removes an id in a list kept in a signal (batches of the access and premium settings). */
  toggleId(list: { update(fn: (l: number[]) => number[]): void }, id: number, on: boolean) {
    list.update((l) => (on ? [...l.filter((x) => x !== id), id] : l.filter((x) => x !== id)));
  }

  sameValue(v: number) {
    return Math.abs(this.rule().value - v) < 0.00005;
  }

  /** 0.5 -> "0.5", 0.6666 -> "0.6666": no trailing zeros, at most four decimals. */
  shown(v: string | number) {
    return String(+(+v).toFixed(4));
  }

  negativeExample = computed(() => {
    const { option, value } = this.rule();
    const f = (n: number) => String(+n.toFixed(2));
    if (option === 'off') return 'A wrong answer loses nothing.';
    if (option === 'question') return 'Each question uses the deduction set on the question itself (editable per question in the Questions tab).';
    if (option === 'fixed') return `Every wrong answer loses ${f(value)} marks, whatever the question is worth.`;
    const preset = this.presets.find((p) => Math.abs(p.value - value) < 0.00005);
    return `A wrong answer loses ${preset ? preset.label : f(value * 100) + '%'} of the question's marks (a 2-mark question loses ${f(2 * value)}, a 4-mark question loses ${f(4 * value)}).`;
  });

  /** What a wrong answer costs on a question worth `marks` under the current rule (null = the question's own value). */
  private deduction(marks: number, own: string, rule = this.rule()): string {
    const { option, value } = rule;
    if (option === 'fraction') return String(+(marks * value).toFixed(4));
    if (option === 'fixed') return String(+value.toFixed(4));
    return own;
  }

  private static LOCKED_FIELDS = [
    'duration_minutes', 'marks_per_question', 'passing_marks', 'max_attempts', 'unanswered_penalty',
    'negative_option', 'negative_value', 'sectional_timing', 'shuffle_questions', 'shuffle_options', 'is_live', 'late_join_minutes',
  ] as const;

  constructor() {
    this.api.categories().subscribe((p) => this.categories.set(p.results.filter((c) => c.is_active)));
    this.qb.subjects().subscribe((p) => this.subjects.set(p.results.filter((s) => s.is_active)));
    this.api.batches({ is_active: true }).subscribe((p) => this.batches.set(p.results));
    this.form.controls.is_live.valueChanges.subscribe((on) => {
      if (on) this.form.controls.allow_pause.setValue(false); // a pause would give some students more time than others
    });
    this.form.controls.category.valueChanges.subscribe((id) => {
      this.form.controls.tab_key.setValue(''); // a tab belongs to one exam
      // A new test starts with its exam's usual settings. The id comes straight from the change, because the form's own
      // value (this.raw) is only updated after this runs.
      const p = this.categories().find((c) => c.id === id)?.pattern;
      if (!this.id() && p && Object.keys(p).length) this.fill(p, true);
    });
    effect(() => {
      const id = this.id();
      if (id) this.load(+id);
    });
    effect(() => {
      const marks = this.marksPer();
      const rule = this.rule();
      untracked(() => {
        if (this.locked() || !marks) return;
        this.sections.update((all) =>
          all.map((s) => ({
            ...s,
            questions: s.questions.map((q) => ({ ...q, marks: String(marks), negative_marks: this.deduction(marks, q.negative_marks, rule) })),
          })),
        );
      });
    });
    effect(() => {
      const off = this.sectional() || this.locked();
      untracked(() => {
        const c = this.form.controls.duration_minutes;
        if (off) c.disable({ emitEvent: false });
        else c.enable({ emitEvent: false });
      });
    });
  }

  private load(id: number) {
    this.loading.set(true);
    this.api.get(id).subscribe({
      next: (e) => {
        this.apply(e);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(err));
        this.router.navigateByUrl('/admin/tests');
      },
    });
  }

  private apply(e: Exam) {
    this.exam.set(e);
    this.form.patchValue({
      title: e.title, description: e.description, instructions: e.instructions, category: e.category, also_in: e.also_in ?? [],
      test_type: e.test_type, tab_key: e.tab_key ?? '', subject: e.subject, year: e.year,
      duration_minutes: e.duration_minutes, passing_marks: +e.passing_marks, max_attempts: e.max_attempts,
      marks_per_question: +(e.marks_per_question ?? e.sections?.[0]?.questions?.[0]?.marks ?? 1),
      unanswered_penalty: +e.unanswered_penalty,
      negative_option: e.negative_marking_enabled ? e.negative_mode : 'off', negative_value: +e.negative_value,
      sectional_timing: e.sectional_timing,
      shuffle_questions: e.shuffle_questions, shuffle_options: e.shuffle_options,
      allow_pause: e.allow_pause ?? true, max_pauses: e.max_pauses ?? 0, pause_minutes: e.pause_minutes ?? 0,
      is_live: e.is_live ?? false, late_join_minutes: e.late_join_minutes ?? 10,
      start_at: toLocalInput(e.start_at), end_at: toLocalInput(e.end_at),
      result_release: e.result_release, result_release_at: toLocalInput(e.result_release_at),
      solution_release: e.solution_release,
    });
    for (const f of ExamForm.LOCKED_FIELDS) {
      e.locked ? this.form.controls[f].disable() : this.form.controls[f].enable();
    }
    if (e.sections) {
      this.sections.set(
        e.sections.length ? e.sections.map((s) => ({ name: s.name, duration_minutes: s.duration_minutes ?? null, questions: s.questions.map((q) => ({ ...q })) })) : [{ name: 'Section 1', questions: [] }],
      );
    }
    this.access.set(e.access_type);
    this.premium.set(!!e.is_premium);
    this.price.set(e.price ?? '');
    this.premiumStudentIds.set(e.premium_student_ids ?? []);
    this.premiumBatchIds.set(e.premium_batch_ids ?? []);
    this.studentIds.set(e.assigned_student_ids);
    this.batchIds.set(e.assigned_batch_ids);
  }

  // --- details ---
  saveDetails() {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.error.set('');
    if (this.form.getRawValue().is_live && !this.form.getRawValue().start_at) {
      this.error.set('A live test needs a start time.');
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    const { negative_option: option, negative_value: nv, ...rest } = v;
    const body: Record<string, unknown> = {
      ...rest,
      negative_marking_enabled: option !== 'off',
      negative_mode: option === 'off' ? 'question' : option,
      negative_value: option === 'fraction' || option === 'fixed' ? String(nv) : '0',
      passing_marks: String(v.passing_marks),
      marks_per_question: String(v.marks_per_question),
      unanswered_penalty: String(v.unanswered_penalty),
      start_at: fromLocalInput(v.start_at),
      end_at: fromLocalInput(v.end_at),
      result_release_at: v.result_release === 'scheduled' ? fromLocalInput(v.result_release_at) : null,
    };
    this.api.save(body, this.id() ? +this.id()! : undefined).subscribe({
      next: (e) => {
        this.saving.set(false);
        this.notify.success('Saved');
        if (!this.id()) {
          this.router.navigate(['/admin/tests', e.id]);
        } else {
          this.load(e.id);
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  /** Fills the settings from the chosen exam's saved pattern. Title, description and questions are never touched. */
  applyPattern() {
    const p = this.pattern();
    if (p) this.fill(p, false);
  }

  private fill(p: ExamPattern, quiet: boolean) {
    if (this.locked()) return;
    const v: Record<string, unknown> = {};
    for (const k of ['duration_minutes', 'marks_per_question', 'passing_marks', 'max_attempts', 'sectional_timing'] as const) {
      if (p[k] !== undefined) v[k] = p[k];
    }
    if (p.negative_option) v['negative_option'] = p.negative_option;
    if (p.negative_value !== undefined) v['negative_value'] = p.negative_value;
    this.form.patchValue(v);
    // Sections of the pattern are only used while the test has no questions yet, so nothing already built is lost.
    if (p.sections?.length && this.sections().every((s) => !s.questions.length)) {
      this.sections.set(p.sections.map((s) => ({ name: s.name, duration_minutes: s.duration_minutes ?? null, questions: [] })));
    }
    if (!quiet) this.notify.success('Pattern applied. Check the settings, then save.');
  }

  copyLink(link: string) {
    const done = () => this.notify.success('Link copied');
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(done, () => this.notify.error('Could not copy. Select the link and copy it.'));
    else this.notify.error('Could not copy. Select the link and copy it.');
  }

  addCategory(ev: Event) {
    ev.stopPropagation();
    const name = window.prompt('Name of the new exam, for example SSC')?.trim();
    if (!name) return;
    this.api.createCategory(name).subscribe({
      next: (c) => {
        this.categories.update((l) => [...l, c]);
        this.form.controls.category.setValue(c.id);
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  pickThumb(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    this.api.uploadThumbnail(this.exam()!.id, f).subscribe({
      next: (e) => this.exam.update((x) => ({ ...x!, thumbnail_url: e.thumbnail_url })),
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  removeThumb() {
    this.api.removeThumbnail(this.exam()!.id).subscribe({
      next: () => this.exam.update((x) => ({ ...x!, thumbnail_url: null })),
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  // --- structure ---
  private update(fn: (s: ExamSection[]) => ExamSection[]) {
    this.sections.update((s) => fn(structuredClone(s)));
  }

  addSection() {
    this.update((s) => [...s, { name: `Section ${s.length + 1}`, questions: [] }]);
  }
  old = (d: string | null | undefined) => isOld(d);

  setSectionMinutes(i: number, value: string) {
    const n = Math.floor(Number(value));
    this.update((s) => ((s[i].duration_minutes = n >= 1 ? Math.min(n, 600) : null), s));
  }
  clearSection(i: number) {
    this.update((s) => ((s[i].questions = []), s));
  }
  removeSection(i: number) {
    this.update((s) => s.filter((_, x) => x !== i));
  }
  renameSection(i: number, name: string) {
    this.update((s) => ((s[i].name = name), s));
  }
  moveSection(i: number, d: number) {
    this.update((s) => {
      [s[i], s[i + d]] = [s[i + d], s[i]];
      return s;
    });
  }
  removeQuestion(si: number, qi: number) {
    this.update((s) => (s[si].questions.splice(qi, 1), s));
  }
  moveQuestion(si: number, qi: number, d: number) {
    this.update((s) => {
      const q = s[si].questions;
      [q[qi], q[qi + d]] = [q[qi + d], q[qi]];
      return s;
    });
  }

  addQuestions(si: number) {
    const used = this.sections().flatMap((s) => s.questions.map((q) => q.question));
    this.dialog
      .open(QuestionPicker, { data: { excludeIds: used, examId: this.exam()?.id ?? null }, width: '820px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((picked: Question[] | undefined) => {
        if (!picked?.length) return;
        this.update((s) => {
          s[si].questions.push(
            ...picked.map((q) => ({
              question: q.id, text: q.text || q.text_hi || '', question_date: q.question_date ?? null, subject_name: q.subject_name, difficulty: q.difficulty,
              marks: String(this.marksPer()), negative_marks: this.deduction(this.marksPer(), q.negative_marks), question_version: q.version, current_version: q.version,
            })),
          );
          return s;
        });
      });
  }

  saveStructure() {
    const sections = this.sections().map((s) => ({
      name: s.name.trim() || 'Section',
      duration_minutes: s.duration_minutes ?? null,
      questions: s.questions.map((q) => ({ question: q.question, marks: q.marks, negative_marks: q.negative_marks })),
    }));
    this.saving.set(true);
    this.api.saveStructure(this.exam()!.id, sections).subscribe({
      next: (e) => {
        this.saving.set(false);
        this.notify.success('Questions saved');
        this.apply(e);
        this.problems.set([]);
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.error(apiErrorMessage(err));
      },
    });
  }

  // --- access ---
  setAccess(v: AccessType) {
    this.access.set(v);
  }

  saveAccess() {
    const id = this.exam()!.id;
    this.saving.set(true);
    const afterAccess = () =>
      this.api
        .saveAssignment(id, this.access() === 'assigned' ? this.studentIds() : [], this.access() === 'batch' ? this.batchIds() : [])
        .subscribe({
          next: (e) => {
            this.saving.set(false);
            this.notify.success('Access saved');
            this.load(e.id);
          },
          error: (err) => {
            this.saving.set(false);
            this.notify.error(apiErrorMessage(err));
          },
        });
    if (this.access() !== this.exam()!.access_type) {
      this.api.save({ access_type: this.access() }, id).subscribe({
        next: afterAccess,
        error: (err) => {
          this.saving.set(false);
          this.notify.error(apiErrorMessage(err));
        },
      });
    } else {
      afterAccess();
    }
  }

  savePremium() {
    const id = this.exam()!.id;
    this.saving.set(true);
    const price = this.premium() && this.price() !== '' ? String(this.price()) : null;
    this.api.save({ is_premium: this.premium(), price }, id).subscribe({
      next: () =>
        this.api.savePremiumAccess(id, this.premium() ? this.premiumStudentIds() : [], this.premium() ? this.premiumBatchIds() : []).subscribe({
          next: (e) => {
            this.saving.set(false);
            this.notify.success('Premium settings saved');
            this.load(e.id);
          },
          error: (err) => {
            this.saving.set(false);
            this.notify.error(apiErrorMessage(err));
          },
        }),
      error: (err) => {
        this.saving.set(false);
        this.notify.error(apiErrorMessage(err));
      },
    });
  }

  // --- lifecycle ---
  lifecycle(name: 'publish' | 'unpublish') {
    this.api.action(this.exam()!.id, name).subscribe({
      next: (e) => {
        this.problems.set([]);
        this.notify.success(name === 'publish' ? 'Test published' : 'Test unpublished');
        this.load(e.id);
      },
      error: (err) => {
        this.problems.set(err.error?.errors ?? []);
        this.notify.error(err.error?.errors ? 'Fix the listed problems, then publish again.' : apiErrorMessage(err));
      },
    });
  }
}
