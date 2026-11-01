import { isOld } from '../../../shared/question-age';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { openPicker } from '../../../shared/pickers';
import { Question, Subject } from '../question-bank/qb.models';
import { QuestionBankService } from '../question-bank/qb.service';
import { AccessType, Batch, Exam, ExamCategory, ExamSection, TEST_TYPE_LABELS, TestType, fromLocalInput, toLocalInput, ExamPattern } from './exam.models';
import { ExamService } from './exam.service';
import { QuestionPicker } from './question-picker';
import { StudentPicker } from './student-picker';

@Component({
  selector: 'app-exam-form',
  imports: [
    ReactiveFormsModule, RouterLink, MatTabsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatSlideToggleModule, MatRadioModule, MatProgressBarModule, StudentPicker,
  ],
  styleUrl: './exam-form.scss',
  template: `
    <div class="head">
      <div>
        <h1>{{ id() ? exam()?.title || 'Test' : 'New test' }}</h1>
        @if (exam(); as e) { <span class="chip" [class]="'chip ' + e.status">{{ e.status }}</span> }
      </div>
      <div class="head-actions">
        <a mat-button routerLink="/admin/tests"><mat-icon>arrow_back</mat-icon> Back</a>
        @if (exam(); as e) {
          <a mat-stroked-button [routerLink]="['/admin/tests', e.id, 'preview']"><mat-icon>visibility</mat-icon> Preview</a>
          @if (e.status !== 'draft') {
            <a mat-stroked-button [routerLink]="['/admin/tests', e.id, 'results']"><mat-icon>bar_chart</mat-icon> Results</a>
          }
          @if (e.status === 'draft') {
            <button mat-flat-button (click)="lifecycle('publish')"><mat-icon>publish</mat-icon> Publish</button>
          } @else if (e.status === 'published') {
            <button mat-stroked-button (click)="lifecycle('unpublish')"><mat-icon>unpublished</mat-icon> Unpublish</button>
          }
        }
      </div>
    </div>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

    @if (problems().length) {
      <div class="problems" role="alert">
        <strong>This test is not ready to publish:</strong>
        <ul>@for (p of problems(); track p) { <li>{{ p }}</li> }</ul>
      </div>
    }
    @if (exam()?.locked) {
      <div class="info">
        <mat-icon inline>lock</mat-icon>
        Scoring rules and questions are locked while the test is {{ exam()!.status }}. Unpublish it to change them.
        Title, descriptions, dates, release settings and assignments can still be edited.
      </div>
    }

    <mat-tab-group animationDuration="0" [(selectedIndex)]="tab">
      <!-- DETAILS -->
      <mat-tab label="Details & rules">
        <form [formGroup]="form" (ngSubmit)="saveDetails()" novalidate class="tab">
          <mat-card appearance="outlined"><mat-card-content>
            <mat-form-field appearance="outline">
              <mat-label>Title</mat-label>
              <input matInput formControlName="title" maxlength="200" />
              <mat-error>Title is required</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Description</mat-label>
              <textarea matInput rows="2" formControlName="description"></textarea>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Instructions shown before the test</mat-label>
              <textarea matInput rows="4" formControlName="instructions"></textarea>
            </mat-form-field>
            @if (pattern(); as p) {
              <div class="pattern-bar">
                <mat-icon>auto_fix_high</mat-icon>
                <span><strong>{{ selectedCategory()?.name }}</strong> has a saved pattern: {{ patternSummary() }}</span>
                <button mat-stroked-button type="button" (click)="applyPattern()" [disabled]="locked()">Use this pattern</button>
              </div>
            }
            <div class="grid">
              <mat-form-field appearance="outline">
                <mat-label>Exam (for example SSC)</mat-label>
                <mat-select formControlName="category">
                  <mat-option [value]="null">None</mat-option>
                  @for (c of categories(); track c.id) { <mat-option [value]="c.id">{{ c.name }}</mat-option> }
                </mat-select>
                <button mat-icon-button matSuffix type="button" (click)="addCategory($event)" aria-label="New exam">
                  <mat-icon>add</mat-icon>
                </button>
                <mat-hint>Students find the test under this exam</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Also show in these exams</mat-label>
                <mat-select multiple formControlName="also_in">
                  @for (c of otherCategories(); track c.id) { <mat-option [value]="c.id">{{ c.name }}</mat-option> }
                </mat-select>
                <mat-hint>One test, many exams: students of each exam see it, and the results stay together</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Type of test</mat-label>
                <mat-select formControlName="test_type">
                  @for (t of testTypes; track t.value) { <mat-option [value]="t.value">{{ t.label }}</mat-option> }
                </mat-select>
              </mat-form-field>
              @if (customTabs().length) {
                <mat-form-field appearance="outline">
                  <mat-label>Show in tab</mat-label>
                  <mat-select formControlName="tab_key">
                    <mat-option value="">By type of test</mat-option>
                    @for (t of customTabs(); track t.key) { <mat-option [value]="t.key">{{ t.label }}</mat-option> }
                  </mat-select>
                  <mat-hint>Put this test in one of the exam's own tabs instead of the tab of its type</mat-hint>
                </mat-form-field>
              }
              @if (form.value.test_type === 'sectional') {
                <mat-form-field appearance="outline">
                  <mat-label>Subject</mat-label>
                  <mat-select formControlName="subject">
                    @for (s of subjects(); track s.id) { <mat-option [value]="s.id">{{ s.name }}</mat-option> }
                  </mat-select>
                  <mat-hint>For example Maths only</mat-hint>
                  <mat-error>Choose the subject</mat-error>
                </mat-form-field>
              }
              @if (form.value.test_type === 'previous_year') {
                <mat-form-field appearance="outline">
                  <mat-label>Year of the paper</mat-label>
                  <input matInput type="number" min="1950" formControlName="year" />
                  <mat-error>Enter the year, for example 2023</mat-error>
                </mat-form-field>
              }
            </div>
            @if (exam()) {
              <div class="thumb">
                <strong>Thumbnail (optional, max 2 MB)</strong>
                @if (exam()!.thumbnail_url) {
                  <img [src]="exam()!.thumbnail_url" alt="Test thumbnail" />
                  <button mat-button type="button" (click)="removeThumb()"><mat-icon>delete</mat-icon> Remove</button>
                }
                <input #file type="file" accept="image/*" hidden (change)="pickThumb($event)" />
                <button mat-stroked-button type="button" (click)="file.click()"><mat-icon>image</mat-icon> Choose image</button>
              </div>
            }
          </mat-card-content></mat-card>

          <mat-card appearance="outlined">
            <mat-card-header><mat-card-title>Rules</mat-card-title></mat-card-header>
            <mat-card-content>
              <div class="grid">
                <mat-form-field appearance="outline">
                  <mat-label>Duration (minutes)</mat-label>
                  <input matInput type="number" min="1" max="600" formControlName="duration_minutes" />
                  @if (sectional()) { <mat-hint>Total of the section time limits</mat-hint> }
                  <mat-error>1 to 600 minutes</mat-error>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Marks per question</mat-label>
                  <input matInput type="number" min="0.01" step="0.25" formControlName="marks_per_question" />
                  <mat-hint>Every question in this test is worth this</mat-hint>
                  <mat-error>Must be greater than 0</mat-error>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Passing marks</mat-label>
                  <input matInput type="number" min="0" step="0.25" formControlName="passing_marks" />
                  <mat-hint>Total marks: {{ exam()?.total_marks ?? '0.00' }}</mat-hint>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Maximum attempts</mat-label>
                  <input matInput type="number" min="0" max="50" formControlName="max_attempts" />
                  <mat-hint>0 = unlimited retakes</mat-hint>
                  <mat-error>0 to 50</mat-error>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Unanswered penalty</mat-label>
                  <input matInput type="number" min="0" step="0.25" formControlName="unanswered_penalty" />
                  <mat-hint>Marks deducted per unanswered question (normally 0)</mat-hint>
                </mat-form-field>
              </div>
              <div class="neg">
                <mat-form-field appearance="outline">
                  <mat-label>Negative marking</mat-label>
                  <mat-select formControlName="negative_option">
                    <mat-option value="off">No negative marking</mat-option>
                    @if (rule().option === 'question') { <mat-option value="question">Each question's own value (older tests)</mat-option> }
                    <mat-option value="fraction">Fraction of the question's marks</mat-option>
                    <mat-option value="fixed">Fixed marks per wrong answer</mat-option>
                  </mat-select>
                </mat-form-field>
                @if (rule().option === 'fraction') {
                  <div class="presets" role="group" aria-label="Common fractions">
                    @for (p of presets; track p.label) {
                      <button mat-stroked-button type="button" [class.on]="sameValue(p.value)" [disabled]="locked()" (click)="form.controls.negative_value.setValue(p.value)">{{ p.label }}</button>
                    }
                  </div>
                  <mat-form-field appearance="outline">
                    <mat-label>Fraction deducted</mat-label>
                    <input matInput type="number" min="0.01" max="1" step="0.0001" formControlName="negative_value" />
                    <mat-hint>0.25 = 1/4, 0.3333 = 1/3</mat-hint>
                    <mat-error>Between 0 and 1</mat-error>
                  </mat-form-field>
                }
                @if (rule().option === 'fixed') {
                  <mat-form-field appearance="outline">
                    <mat-label>Marks deducted per wrong answer</mat-label>
                    <input matInput type="number" min="0" max="100" step="0.05" formControlName="negative_value" />
                    <mat-error>0 or more</mat-error>
                  </mat-form-field>
                }
              </div>
              <p class="neg-example"><mat-icon inline>info</mat-icon> {{ negativeExample() }}</p>
              <div class="toggles">
                <mat-slide-toggle formControlName="sectional_timing">Time each section separately (SSC style)</mat-slide-toggle>
                @if (sectional()) {
                  <p class="neg-example">
                    <mat-icon inline>info</mat-icon>
                    Sections open one after another, each with its own timer. A student cannot move on until the section's time
                    is up or they submit that section, and cannot go back. Set each section's time limit in the Questions tab.
                  </p>
                }
                <mat-slide-toggle formControlName="shuffle_questions">Shuffle questions within sections</mat-slide-toggle>
                <mat-slide-toggle formControlName="shuffle_options">Shuffle answer options</mat-slide-toggle>
                @if (!live()) { <mat-slide-toggle formControlName="allow_pause">Let students pause the test</mat-slide-toggle> }
              </div>
              @if (form.controls.allow_pause.value && !live()) {
                <div class="grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Pauses allowed</mat-label>
                    <input matInput type="number" min="0" max="20" formControlName="max_pauses" />
                    <mat-hint>0 = unlimited</mat-hint>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Longest pause (minutes)</mat-label>
                    <input matInput type="number" min="0" max="120" formControlName="pause_minutes" />
                    <mat-hint>0 = no limit: the student can resume any time</mat-hint>
                  </mat-form-field>
                </div>
                <p class="neg-example">
                  <mat-icon inline>info</mat-icon>
                  While paused the timer stops and the questions are hidden. With a limit, a pause that runs longer restarts the test by
                  itself and the timer keeps running. With 0 the student stays paused until they resume.
                </p>
              }
            </mat-card-content>
          </mat-card>

          <mat-card appearance="outlined">
            <mat-card-header><mat-card-title>Schedule &amp; release</mat-card-title></mat-card-header>
            <mat-card-content>
              <div class="live-box">
                <mat-slide-toggle formControlName="is_live">Live test (everyone starts together)</mat-slide-toggle>
                @if (live()) {
                  <p class="neg-example">
                    <mat-icon inline>sensors</mat-icon>
                    Students join from the start time and everyone finishes at the same moment (start time + duration), so someone who joins
                    late gets the time that is left. Pausing is off. Set the start time below; the end is worked out for you.
                  </p>
                  <mat-form-field appearance="outline" class="late">
                    <mat-label>Students can still join for (minutes)</mat-label>
                    <input matInput type="number" min="0" max="180" formControlName="late_join_minutes" />
                    <mat-hint>After this many minutes from the start nobody new can join</mat-hint>
                  </mat-form-field>
                  @if (liveLink(); as link) {
                    <div class="live-link">
                      <strong>Link to share</strong>
                      <div class="row">
                        <input readonly [value]="link" aria-label="Link to share this live test" (focus)="$any($event.target).select()" />
                        <button mat-stroked-button type="button" (click)="copyLink(link)"><mat-icon>content_copy</mat-icon> Copy link</button>
                      </div>
                      <span class="meta">Only registered students can open it: anyone not signed in is asked to log in first, and a test given to chosen students or batches stays closed to everyone else.</span>
                    </div>
                  } @else {
                    <p class="meta">Save the test to get the link to share with students.</p>
                  }
                }
              </div>
              <div class="grid">
                <mat-form-field appearance="outline">
                  <mat-label>{{ live() ? 'Live test starts at' : 'Available from' }}</mat-label>
                  <input #startIn matInput type="datetime-local" formControlName="start_at" />
                  <button mat-icon-button matSuffix type="button" (click)="pickDate(startIn)" aria-label="Choose date and time"><mat-icon>calendar_month</mat-icon></button>
                  <mat-hint>{{ live() ? 'Required for a live test' : 'Empty = available as soon as published' }}</mat-hint>
                </mat-form-field>
                @if (!live()) {
                  <mat-form-field appearance="outline">
                    <mat-label>Available until</mat-label>
                    <input #endIn matInput type="datetime-local" formControlName="end_at" />
                    <button mat-icon-button matSuffix type="button" (click)="pickDate(endIn)" aria-label="Choose date and time"><mat-icon>calendar_month</mat-icon></button>
                    <mat-hint>Empty = no end</mat-hint>
                  </mat-form-field>
                }
                <mat-form-field appearance="outline">
                  <mat-label>Result release</mat-label>
                  <mat-select formControlName="result_release">
                    <mat-option value="immediate">Immediately after submission</mat-option>
                    <mat-option value="scheduled">At a scheduled time</mat-option>
                    <mat-option value="manual">Manually by an admin</mat-option>
                  </mat-select>
                </mat-form-field>
                @if (form.value.result_release === 'scheduled') {
                  <mat-form-field appearance="outline">
                    <mat-label>Results released at</mat-label>
                    <input #releaseIn matInput type="datetime-local" formControlName="result_release_at" />
                  <button mat-icon-button matSuffix type="button" (click)="pickDate(releaseIn)" aria-label="Choose date and time"><mat-icon>calendar_month</mat-icon></button>
                  </mat-form-field>
                }
                <mat-form-field appearance="outline">
                  <mat-label>Solution release</mat-label>
                  <mat-select formControlName="solution_release">
                    <mat-option value="with_result">Together with the result</mat-option>
                    <mat-option value="after_end">After the test window closes</mat-option>
                    <mat-option value="manual">Manually by an admin</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
            </mat-card-content>
          </mat-card>

          @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
          <div class="actions">
            <button mat-flat-button type="submit" [disabled]="saving()">{{ id() ? 'Save changes' : 'Create test' }}</button>
          </div>
        </form>
      </mat-tab>

      <!-- QUESTIONS -->
      <mat-tab label="Questions" [disabled]="!exam()">
        <div class="tab">
          <div class="summary">
            <strong>{{ totalQuestions() }}</strong> {{ totalQuestions() === 1 ? "question" : "questions" }} · <strong>{{ totalMarks() }}</strong> marks
            @if (sectional()) { · <strong>{{ sectionTotal() }}</strong> minutes in total }
          </div>
          @for (s of sections(); track $index; let si = $index) {
            <mat-card appearance="outlined" class="section">
              <mat-card-content>
                <div class="section-head">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Section name</mat-label>
                    <input matInput [value]="s.name" [disabled]="locked()" (input)="renameSection(si, $any($event.target).value)" />
                  </mat-form-field>
                  <button mat-icon-button (click)="moveSection(si, -1)" [disabled]="locked() || si === 0" aria-label="Move section up"><mat-icon>arrow_upward</mat-icon></button>
                  <button mat-icon-button (click)="moveSection(si, 1)" [disabled]="locked() || si === sections().length - 1" aria-label="Move section down"><mat-icon>arrow_downward</mat-icon></button>
                  @if (sectional()) {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mins">
                      <mat-label>Minutes</mat-label>
                      <input matInput type="number" min="1" max="600" [value]="s.duration_minutes ?? ''" [disabled]="locked()"
                        (change)="setSectionMinutes(si, $any($event.target).value)" aria-label="Time limit of this section in minutes" />
                    </mat-form-field>
                  }
                  <button mat-button (click)="clearSection(si)" [disabled]="locked() || s.questions.length === 0">Remove all questions</button>
                  <button mat-icon-button (click)="removeSection(si)" [disabled]="locked() || sections().length === 1" aria-label="Remove section"><mat-icon>delete</mat-icon></button>
                </div>
                @for (q of s.questions; track q.question; let qi = $index) {
                  <div class="q-row">
                    <span class="num">{{ qi + 1 }}</span>
                    <div class="q-text">
                      {{ q.text }}
                      <div class="meta"><strong>#{{ q.question }}</strong> · {{ q.subject_name }} · {{ q.difficulty }}
                        · {{ q.question_date || 'no date' }}
                        @if (old(q.question_date)) { <span class="warn">older than 2 years</span> }
                        @if (q.also_in?.length) { · <span class="also" [attr.title]="q.also_in!.join(', ')">also in {{ q.also_in!.length === 1 ? q.also_in![0] : q.also_in!.length + ' other tests' }}</span> }
                        @if (q.current_version && q.question_version && q.current_version !== q.question_version) {
                          · <span class="warn">bank question changed since added (v{{ q.question_version }} → v{{ q.current_version }})</span>
                        }
                      </div>
                    </div>
                    <span class="score" title="Set by this test's marks per question and negative marking rule">
                      +{{ shown(q.marks) }} / {{ +q.negative_marks ? '-' + shown(q.negative_marks) : '0' }}
                    </span>
                    <button mat-icon-button (click)="moveQuestion(si, qi, -1)" [disabled]="locked() || qi === 0" aria-label="Move question up"><mat-icon>arrow_upward</mat-icon></button>
                    <button mat-icon-button (click)="moveQuestion(si, qi, 1)" [disabled]="locked() || qi === s.questions.length - 1" aria-label="Move question down"><mat-icon>arrow_downward</mat-icon></button>
                    <button mat-icon-button (click)="removeQuestion(si, qi)" [disabled]="locked()" aria-label="Remove question"><mat-icon>close</mat-icon></button>
                  </div>
                } @empty {
                  <p class="meta">No questions in this section yet.</p>
                }
                <button mat-stroked-button (click)="addQuestions(si)" [disabled]="locked()"><mat-icon>add</mat-icon> Add questions</button>
              </mat-card-content>
            </mat-card>
          }
          <div class="actions">
            <button mat-button (click)="addSection()" [disabled]="locked()"><mat-icon>playlist_add</mat-icon> Add section</button>
            <button mat-flat-button (click)="saveStructure()" [disabled]="locked() || saving()">Save questions</button>
          </div>
        </div>
      </mat-tab>

      <!-- ACCESS -->
      <mat-tab label="Access & assignment" [disabled]="!exam()">
        <div class="tab">
          <mat-card appearance="outlined"><mat-card-content>
            <mat-radio-group [value]="access()" (change)="setAccess($event.value)" [disabled]="locked()" class="radios">
              <mat-radio-button value="public">Public: any signed-in student</mat-radio-button>
              <mat-radio-button value="assigned">Assigned students only</mat-radio-button>
              <mat-radio-button value="batch">Selected batches only</mat-radio-button>
            </mat-radio-group>
            @if (access() === 'assigned') {
              <app-student-picker [value]="studentIds()" (changed)="studentIds.set($event)" />
            }
            @if (access() === 'batch') {
              <mat-form-field appearance="outline">
                <mat-label>Batches</mat-label>
                <mat-select multiple [value]="batchIds()" (selectionChange)="batchIds.set($event.value)">
                  @for (b of batches(); track b.id) { <mat-option [value]="b.id">{{ b.name }} ({{ b.member_count }})</mat-option> }
                </mat-select>
              </mat-form-field>
            }
          </mat-card-content></mat-card>
          <div class="actions">
            <button mat-flat-button (click)="saveAccess()" [disabled]="saving()">Save access</button>
          </div>

          <mat-card appearance="outlined"><mat-card-content>
            <mat-slide-toggle [checked]="premium()" (change)="premium.set($event.checked)">Premium test</mat-slide-toggle>
            <p class="meta">Premium tests are listed for everyone but locked until you give a student access. Payments are not connected: you grant access here by hand.</p>
            @if (premium()) {
              <mat-form-field appearance="outline">
                <mat-label>Price shown to students (₹, optional)</mat-label>
                <input matInput type="number" min="0" step="1" [value]="price()" (input)="price.set($any($event.target).value)" />
              </mat-form-field>
              <strong>Students with access</strong>
              <app-student-picker [value]="premiumStudentIds()" (changed)="premiumStudentIds.set($event)" />
              <mat-form-field appearance="outline">
                <mat-label>Batches with access</mat-label>
                <mat-select multiple [value]="premiumBatchIds()" (selectionChange)="premiumBatchIds.set($event.value)">
                  @for (b of batches(); track b.id) { <mat-option [value]="b.id">{{ b.name }} ({{ b.member_count }})</mat-option> }
                </mat-select>
              </mat-form-field>
            }
          </mat-card-content></mat-card>
          <div class="actions">
            <button mat-flat-button (click)="savePremium()" [disabled]="saving()">Save premium settings</button>
          </div>
        </div>
      </mat-tab>
    </mat-tab-group>
  `,
})
export class ExamForm {
  id = input<string>();

  private api = inject(ExamService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private notify = inject(NotifyService);
  private dialog = inject(MatDialog);
  private qb = inject(QuestionBankService);

  tab = 0;
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
