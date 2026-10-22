import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { LangSwitch, Lang, LanguageService, pick } from './language';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { formatDuration, formatSeconds } from '../features/student/student.models';
import { ResultData } from './result.models';

/** Result and question-by-question review. Shared by the student and admin screens. */
@Component({
  selector: 'app-result-view',
  imports: [DatePipe, MatCardModule, MatIconModule, MatButtonToggleModule, LangSwitch],
  styleUrl: './result-view.scss',
  template: `
    @let r = data();
    <div class="head">
      <h1>{{ r.exam.title }}</h1>
      <p class="muted">
        Attempt {{ r.attempt.attempt_number }} · submitted {{ r.attempt.submitted_at | date: 'medium' }}
        @if (r.attempt.auto_submitted) { · auto-submitted at the deadline }
        @if (r.attempt.student) { · <strong>{{ r.attempt.student.name }}</strong> ({{ r.attempt.student.email }}) }
      </p>
    </div>

    <mat-card appearance="outlined" class="score-card">
      <mat-card-content>
        <div class="score">{{ r.summary.score }} <span>/ {{ r.summary.total_marks }}</span></div>
        <div class="badge" [class.pass]="r.summary.passed" [class.fail]="!r.summary.passed">
          {{ r.summary.passed ? 'Passed' : 'Not passed' }} · passing marks {{ r.summary.passing_marks }}
        </div>
        <div class="grid">
          <div><strong>{{ r.summary.percentage ?? '—' }}{{ r.summary.percentage === null ? '' : '%' }}</strong><span>Score</span></div>
          <div><strong class="ok">{{ r.summary.correct }}</strong><span>Correct</span></div>
          <div><strong class="bad">{{ r.summary.incorrect }}</strong><span>Incorrect</span></div>
          <div><strong>{{ r.summary.unanswered }}</strong><span>Unanswered</span></div>
          <div><strong>{{ r.summary.accuracy }}%</strong><span>Accuracy</span></div>
          <div><strong>{{ duration(r.summary.time_taken_seconds) }}</strong><span>Time taken</span></div>
        </div>
        @if (r.comparison.average_percentage !== null && r.comparison.attempts_count > 1) {
          <p class="muted">
            Average across {{ r.comparison.attempts_count }} attempts: {{ r.comparison.average_percentage }}%
            @if (r.summary.percentage !== null) {
              ({{ r.summary.percentage >= r.comparison.average_percentage ? 'above' : 'below' }} average)
            }
          </p>
        }
      </mat-card-content>
    </mat-card>

    <div class="two">
      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>Section-wise marks</mat-card-title></mat-card-header>
        <mat-card-content>
          <div class="table-wrap">
            <table class="plain">
              <thead><tr><th>Section</th><th>Marks</th><th>Correct</th><th>Incorrect</th><th>Unanswered</th><th>Time</th></tr></thead>
              <tbody>
                @for (s of r.sections; track s.name) {
                  <tr><td>{{ s.name }}</td><td>{{ s.marks }} / {{ s.max_marks }}</td><td>{{ s.correct }}</td><td>{{ s.incorrect }}</td><td>{{ s.unanswered }}</td><td>{{ short(s.time_seconds) }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        </mat-card-content>
      </mat-card>
      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>Subject-wise accuracy</mat-card-title></mat-card-header>
        <mat-card-content>
          @for (s of r.subjects; track s.subject) {
            <div class="bar-row">
              <span>{{ s.subject }}</span>
              <div class="bar"><div class="fill" [style.width.%]="s.accuracy"></div></div>
              <span>{{ s.accuracy }}%</span>
            </div>
          }
        </mat-card-content>
      </mat-card>
    </div>

    @if (r.timing.total_seconds > 0) {
      <mat-card appearance="outlined" class="timing">
        <mat-card-header><mat-card-title>Time spent on each question</mat-card-title></mat-card-header>
        <mat-card-content>
          <p class="muted">
            {{ short(r.timing.total_seconds) }} on questions · average {{ short(r.timing.average_seconds) }} per question
            @if (r.timing.slowest) { · longest on Q{{ r.timing.slowest.number }} ({{ short(r.timing.slowest.seconds) }}) }
          </p>
          @for (q of r.questions; track q.number) {
            <div class="time-row">
              <span>Q{{ q.number }}</span>
              <div class="bar"><div class="fill" [style.width.%]="(q.time_spent_seconds * 100) / maxTime()"></div></div>
              <span class="val">{{ short(q.time_spent_seconds) }}</span>
            </div>
          }
        </mat-card-content>
      </mat-card>
    }

    <h2>Question review</h2>
    @if (languages().length > 1) { <app-lang-switch [languages]="languages()" /> }
    @if (!r.solutions_available) {
      <div class="notice"><mat-icon inline>lock</mat-icon> Correct answers, marks per question and explanations will appear when solutions are released. Your selected answers are shown below.</div>
    } @else {
      <mat-button-toggle-group [value]="filter()" (change)="filter.set($event.value)" aria-label="Filter questions">
        <mat-button-toggle value="all">All ({{ r.questions.length }})</mat-button-toggle>
        <mat-button-toggle value="correct">Correct ({{ r.summary.correct }})</mat-button-toggle>
        <mat-button-toggle value="incorrect">Incorrect ({{ r.summary.incorrect }})</mat-button-toggle>
        <mat-button-toggle value="unanswered">Unanswered ({{ r.summary.unanswered }})</mat-button-toggle>
      </mat-button-toggle-group>
    }

    @for (q of shown(); track q.number) {
      <mat-card appearance="outlined" class="q" [class]="'q ' + (q.status ?? '')">
        <mat-card-content>
          <div class="q-head">
            <span>Q{{ q.number }} · {{ q.section }}{{ q.subject ? ' · ' + q.subject : '' }} · <mat-icon inline>timer</mat-icon> {{ short(q.time_spent_seconds) }}</span>
            @if (q.status) {
              <span class="tag" [class]="'tag ' + q.status">{{ q.status }} · {{ q.marks_awarded }} / {{ q.marks }}</span>
            } @else {
              <span class="muted">{{ q.marks }} marks</span>
            }
          </div>
          @if (q.image_url) { <img [src]="q.image_url" alt="Question image" /> }
          <div class="q-text" [attr.lang]="lang()">{{ say(q.text, q.text_hi) }}</div>
          <ol class="opts">
            @for (o of q.options; track o.id) {
              <li [class.correct]="o.is_correct" [class.wrong]="q.selected_option === o.id && o.is_correct === false" [class.chosen]="q.selected_option === o.id">
                {{ say(o.text, o.text_hi) }}
                @if (q.selected_option === o.id) { <span class="mark">Your answer</span> }
                @if (o.is_correct) { <span class="mark good">Correct answer</span> }
              </li>
            }
          </ol>
          @if (q.selected_option === null) { <p class="muted">You did not answer this question.</p> }
          @if (q.explanation || q.explanation_hi) { <div class="expl"><strong>Explanation</strong><br />{{ say(q.explanation, q.explanation_hi) }}</div> }
        </mat-card-content>
      </mat-card>
    }
  `,
})
export class ResultView {
  data = input.required<ResultData>();
  private langs = inject(LanguageService);
  /** Languages that appear anywhere in this test. */
  languages = computed<Lang[]>(() => {
    const qs = this.data().questions;
    return [...(qs.some((q) => q.text) ? ['en' as const] : []), ...(qs.some((q) => q.text_hi) ? ['hi' as const] : [])];
  });
  lang = computed<Lang>(() => (this.languages().includes(this.langs.lang()) ? this.langs.lang() : (this.languages()[0] ?? 'en')));
  say = (en?: string, hi?: string) => pick(en, hi, this.lang());
  filter = signal<'all' | 'correct' | 'incorrect' | 'unanswered'>('all');
  duration = formatDuration;
  short = formatSeconds;
  maxTime = computed(() => Math.max(1, ...this.data().questions.map((q) => q.time_spent_seconds)));
  shown = computed(() => {
    const f = this.filter();
    const qs = this.data().questions;
    return f === 'all' || !this.data().solutions_available ? qs : qs.filter((q) => q.status === f);
  });
}
