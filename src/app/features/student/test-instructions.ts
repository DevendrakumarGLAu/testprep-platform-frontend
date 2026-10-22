import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { LANG_LABEL, Lang, LanguageService } from '../../shared/language';
import { StudentExam } from './student.models';
import { StudentService } from './student.service';

@Component({
  selector: 'app-test-instructions',
  imports: [DatePipe, RouterLink, MatCardModule, MatButtonModule, MatCheckboxModule, MatIconModule, MatProgressBarModule, MatFormFieldModule, MatSelectModule],
  styles: `
    :host { display: block; max-width: 820px; }
    .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 16px 0; }
    .fact span { display: block; color: var(--mat-sys-on-surface-variant); font-size: 0.85em; }
    .pre { white-space: pre-wrap; }
    .warn { padding: 12px; border-radius: 8px; background: var(--mat-sys-secondary-container); margin: 12px 0; }
    .err { color: var(--mat-sys-error); margin: 4px 0 8px; font-size: 13px; }
    .lang { display: block; width: 150px; margin-top: 12px; --mat-form-field-container-height: 38px; --mat-form-field-container-vertical-padding: 7px; font-size: 14px; }
    .actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 16px; }
  `,
  template: `
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    @if (e(); as t) {
      <h1>{{ t.title }}</h1>
      @if (t.category_name) { <p>{{ t.category_name }}</p> }
      <mat-card appearance="outlined">
        <mat-card-content>
          @if (t.description) { <p class="pre">{{ t.description }}</p> }
          <div class="facts">
            <div class="fact"><span>Duration</span>{{ t.duration_minutes }} minutes</div>
            <div class="fact"><span>Questions</span>{{ t.question_count }}</div>
            <div class="fact"><span>Total marks</span>{{ t.total_marks }}</div>
            <div class="fact"><span>Negative marking</span>{{ t.negative_marking_enabled ? 'Yes, per question' : 'No' }}</div>
            <div class="fact"><span>Attempts</span>{{ t.attempts_used }} used{{ t.max_attempts ? " of " + t.max_attempts : " (unlimited retakes)" }}</div>
            <div class="fact"><span>Available</span>
              @if (t.start_at || t.end_at) { {{ t.start_at ? (t.start_at | date: 'medium') : 'Anytime' }} to {{ t.end_at ? (t.end_at | date: 'medium') : 'no end' }} } @else { Anytime }
            </div>
          </div>
          @if (t.sections?.length) {
            <h3>Sections</h3>
            <ul>@for (s of t.sections; track s.name) {
              <li>{{ s.name }}: {{ s.question_count }} questions{{ s.duration_minutes ? ' · ' + s.duration_minutes + ' minutes' : '' }}</li>
            }</ul>
            @if (t.sectional_timing) {
              <div class="warn">
                <mat-icon inline>lock_clock</mat-icon>
                This test has timed sections. Each section has its own timer and opens only after the one before it. You can move on
                by submitting a section, or when its time is up. You cannot go back to a section once you have left it.
              </div>
            }
          }
          @if (t.instructions) { <h3>Instructions</h3><p class="pre">{{ t.instructions }}</p> }
          <div class="warn">
            <mat-icon inline>timer</mat-icon>
            The timer is controlled by the server and starts the moment you begin. It keeps running if you
            refresh or lose connection, and your answers are submitted automatically when time is up.
          </div>

          @if (t.status === 'in_progress') {
            <div class="actions">
              <button mat-flat-button (click)="go()" [disabled]="starting()"><mat-icon>play_arrow</mat-icon> Resume attempt</button>
              <a mat-button routerLink="/student/tests">Back</a>
            </div>
          } @else if (t.can_start) {
            @if (t.languages && t.languages.length > 1) {
              <mat-form-field appearance="outline" class="lang" subscriptSizing="dynamic">
                <mat-label>Language</mat-label>
                <mat-select [value]="chosen()" (selectionChange)="choose($event.value)" [required]="true" [attr.aria-label]="'Language of the questions'">
                  @for (l of t.languages; track l) { <mat-option [value]="l">{{ label[l] }}</mat-option> }
                </mat-select>
              </mat-form-field>
              @if (langError()) { <p class="err" role="alert">Select a language.</p> }
            }
            <mat-checkbox [checked]="agreed()" (change)="agreed.set($event.checked)">
              I have read the instructions and I am ready to begin.
            </mat-checkbox>
            <div class="actions">
              <button mat-flat-button (click)="start()" [disabled]="!agreed() || starting()">Start test</button>
              <a mat-button routerLink="/student/tests">Cancel</a>
            </div>
          } @else {
            <p><strong>{{ t.reason }}</strong></p>
            <div class="actions"><a mat-stroked-button routerLink="/student/tests">Back to tests</a></div>
          }
        </mat-card-content>
      </mat-card>
    }
  `,
})
export class TestInstructions {
  id = input.required<string>();
  private api = inject(StudentService);
  private router = inject(Router);
  private notify = inject(NotifyService);

  loading = signal(true);
  starting = signal(false);
  agreed = signal(false);
  e = signal<StudentExam | null>(null);
  private langs = inject(LanguageService);
  label = LANG_LABEL;
  /** Nothing is pre-selected: the student has to pick a language before the test starts. */
  chosen = signal<Lang | null>(null);
  langError = signal(false);

  constructor() {
    effect(() => {
      this.api.exam(this.id()).subscribe({
        next: (e) => {
          this.e.set(e);
          this.loading.set(false);
        },
        error: (err) => {
          this.notify.error(err.status === 404 ? 'This test is not available to you.' : apiErrorMessage(err));
          this.router.navigateByUrl('/student/tests');
        },
      });
    });
  }

  choose(l: Lang) {
    this.chosen.set(l);
    this.langError.set(false);
  }

  start() {
    const offered = this.e()?.languages ?? [];
    if (offered.length > 1) {
      const l = this.chosen();
      if (!l) {
        this.langError.set(true);
        return;
      }
      this.langs.set(l);
    } else if (offered.length === 1) {
      this.langs.set(offered[0]);
    }
    this.go();
  }

  go() {
    this.starting.set(true);
    this.api.start(this.id()).subscribe({
      next: (r) => this.router.navigate(['/student/attempt', r.attempt_id]),
      error: (err) => {
        this.starting.set(false);
        this.notify.error(apiErrorMessage(err));
      },
    });
  }
}
