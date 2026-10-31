import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { DecimalPipe } from '@angular/common';
import { Component, HostListener, computed, effect, inject, input, signal } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
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
  imports: [
    DecimalPipe, ReactiveFormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatRadioModule, MatButtonToggleModule, MatChipsModule, MatCheckboxModule, MatSlideToggleModule,
    MatProgressBarModule,
  ],
  styleUrl: './question-form.scss',
  template: `
    <div class="head">
      <h1>{{ id() ? 'Edit question #' + id() : 'New question' }}</h1>
      <a mat-button routerLink="/admin/questions"><mat-icon>arrow_back</mat-icon> Back to list</a>
    </div>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-card appearance="outlined">
        <mat-card-content>
          <div class="langbar">
            <mat-button-toggle-group [value]="lang()" (change)="lang.set($event.value)" aria-label="Language you are editing" hideSingleSelectionIndicator>
              <mat-button-toggle value="en">English <span class="ls" [class.ok]="status('en') === 'complete'" [class.bad]="status('en') === 'incomplete'">{{ statusLabel('en') }}</span></mat-button-toggle>
              <mat-button-toggle value="hi">हिन्दी (Hindi) <span class="ls" [class.ok]="status('hi') === 'complete'" [class.bad]="status('hi') === 'incomplete'">{{ statusLabel('hi') }}</span></mat-button-toggle>
            </mat-button-toggle-group>
            <small>Write the question in English, Hindi or both. At least one language is required, and students can switch between the ones you provide.</small>
          </div>
          @if (lang() === 'en') {
            <mat-form-field appearance="outline">
              <mat-label>Question text (English)</mat-label>
              <textarea matInput rows="4" formControlName="text" (blur)="checkDuplicates()"></textarea>
            </mat-form-field>
          } @else {
            <mat-form-field appearance="outline">
              <mat-label>प्रश्न (Hindi)</mat-label>
              <textarea matInput rows="4" formControlName="text_hi" lang="hi" (blur)="checkDuplicates()"></textarea>
            </mat-form-field>
          }

          @if (duplicates().length) {
            <div class="dup" role="alert">
              <strong><mat-icon inline>warning</mat-icon> Similar questions already exist</strong>
              <ul>
                @for (d of duplicates(); track d.id) {
                  <li>#{{ d.id }} ({{ d.exact ? 'exact match' : (d.similarity * 100 | number: '1.0-0') + '% similar' }}): {{ d.text }}</li>
                }
              </ul>
              <mat-checkbox formControlName="allow_duplicate">Save anyway</mat-checkbox>
            </div>
          }

          <div class="grid">
            <mat-form-field appearance="outline">
              <mat-label>Subject</mat-label>
              <mat-select formControlName="subject" (selectionChange)="form.controls.topic.setValue(null)">
                @for (s of subjects(); track s.id) { <mat-option [value]="s.id">{{ s.name }}</mat-option> }
              </mat-select>
              <mat-error>Subject is required</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Topic</mat-label>
              <mat-select formControlName="topic">
                <mat-option [value]="null">None</mat-option>
                @for (t of topicOptions(); track t.id) { <mat-option [value]="t.id">{{ t.name }}</mat-option> }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Difficulty</mat-label>
              <mat-select formControlName="difficulty">
                <mat-option value="easy">Easy</mat-option>
                <mat-option value="medium">Medium</mat-option>
                <mat-option value="hard">Hard</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Question date</mat-label>
              <input matInput type="date" formControlName="question_date" [max]="todayStr" />
              <mat-hint>When the event happened or the question is current as of. Tests can then use only recent questions.</mat-hint>
              <mat-error>Choose today or an earlier date</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Question type</mat-label>
              <mat-select formControlName="question_type">
                <mat-option value="single_mcq">Single-correct MCQ</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>Options</mat-card-title></mat-card-header>
        <mat-card-content>
          <mat-radio-group [value]="correctIndex()" (change)="setCorrect($event.value)" aria-label="Correct option">
            <div formArrayName="options">
              @for (opt of options.controls; track opt; let i = $index) {
                <div class="option" [formGroupName]="i">
                  <mat-radio-button [value]="i" [attr.aria-label]="'Mark option ' + (i + 1) + ' correct'" />
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>{{ lang() === 'en' ? 'Option ' + letter(i) + ' (English)' : 'विकल्प ' + letter(i) + ' (Hindi)' }}</mat-label>
                    <input matInput [formControlName]="lang() === 'en' ? 'text' : 'text_hi'" [attr.lang]="lang()" />
                  </mat-form-field>
                  <button mat-icon-button type="button" (click)="removeOption(i)" [disabled]="options.length <= MIN"
                    aria-label="Remove option"><mat-icon>close</mat-icon></button>
                </div>
              }
            </div>
          </mat-radio-group>
          @if (options.errors?.['oneCorrect'] && options.touched) { <p class="err">Select exactly one correct option.</p> }
          @if (options.errors?.['duplicateOptions']) { <p class="err">Option texts must be unique.</p> }
          <button mat-stroked-button type="button" (click)="addOption()" [disabled]="options.length >= MAX">
            <mat-icon>add</mat-icon> Add option
          </button>
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-content>
          <mat-form-field appearance="outline">
            <mat-label>Solution video link (optional)</mat-label>
            <input matInput type="url" formControlName="video_url" placeholder="https://youtu.be/..." />
            <mat-hint>Shown to students as "Watch solution" in their review.</mat-hint>
          </mat-form-field>
          @if (lang() === 'en') {
            <mat-form-field appearance="outline">
              <mat-label>Explanation / solution (English)</mat-label>
              <textarea matInput rows="3" formControlName="explanation"></textarea>
            </mat-form-field>
          } @else {
            <mat-form-field appearance="outline">
              <mat-label>व्याख्या / हल (Hindi)</mat-label>
              <textarea matInput rows="3" formControlName="explanation_hi" lang="hi"></textarea>
            </mat-form-field>
          }

          <mat-form-field appearance="outline">
            <mat-label>Tags</mat-label>
            <mat-chip-grid #grid aria-label="Tags">
              @for (t of tags(); track t) {
                <mat-chip-row (removed)="removeTag(t)">{{ t }}<button matChipRemove aria-label="Remove tag"><mat-icon>cancel</mat-icon></button></mat-chip-row>
              }
            </mat-chip-grid>
            <input placeholder="Type a tag and press Enter" [matChipInputFor]="grid"
              [matChipInputSeparatorKeyCodes]="separators" (matChipInputTokenEnd)="addTag($event)" />
          </mat-form-field>

          <div class="image">
            <strong>Image (optional, max 2 MB)</strong>
            <span class="meta">JPG, PNG, WebP or GIF. A very large picture is made smaller for you. You can also paste a screenshot with Ctrl+V.</span>
            @if (imageUrl()) {
              <img [src]="imageUrl()" alt="Question image" />
              <button mat-button type="button" (click)="removeImage()"><mat-icon>delete</mat-icon> Remove image</button>
            } @else if (pendingPreview()) {
              <img [src]="pendingPreview()" alt="Selected image preview" />
            }
            <input #file type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden (change)="pickImage($event)" />
            <button mat-stroked-button type="button" (click)="file.click()"><mat-icon>image</mat-icon> Choose image</button>
          </div>

          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="review">
            <mat-label>Review status</mat-label>
            <mat-select formControlName="review_status">
              <mat-option value="approved">Approved</mat-option>
              <mat-option value="needs_review">Needs review</mat-option>
            </mat-select>
            <mat-hint>A test cannot be published while it holds a question that needs review.</mat-hint>
          </mat-form-field>
          @if (openReports() > 0) {
            <p class="err"><mat-icon inline>flag</mat-icon> {{ openReports() }} open student report{{ openReports() === 1 ? '' : 's' }} on this question.
              <a routerLink="/admin/question-reports">Open the reports</a></p>
          }
          <mat-slide-toggle formControlName="is_active">Active (available for tests)</mat-slide-toggle>
          @if (source()) { <p class="meta">Source: {{ source() }} · Version {{ version() }}</p> }
        </mat-card-content>
      </mat-card>

      @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      <div class="actions">
        <a mat-button routerLink="/admin/questions">Cancel</a>
        <button mat-flat-button type="submit" [disabled]="saving()">{{ id() ? 'Save changes' : 'Create question' }}</button>
      </div>
    </form>
  `,
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
  readonly separators = [ENTER, COMMA];

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

  addTag(e: MatChipInputEvent) {
    const v = (e.value || '').trim().toLowerCase();
    if (v && !this.tags().includes(v)) this.tags.update((t) => [...t, v]);
    e.chipInput.clear();
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
