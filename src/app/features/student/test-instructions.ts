import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
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
import { countdown } from '../../shared/countdown';
import { LANG_LABEL, Lang, LanguageService } from '../../shared/language';
import { StudentExam } from './student.models';
import { StudentService } from './student.service';

@Component({
  selector: 'app-test-instructions',
  imports: [DatePipe, RouterLink, MatCardModule, MatButtonModule, MatCheckboxModule, MatIconModule, MatProgressBarModule, MatFormFieldModule, MatSelectModule],
  styles: `
    :host { display: block; max-width: 880px; margin: 0 auto; padding-bottom: 96px; }
    .hero { position: relative; overflow: hidden; padding: 28px 28px 52px; border-radius: 28px; color: #fff; background: var(--tp-gradient); box-shadow: 0 16px 40px color-mix(in srgb, var(--mat-sys-primary) 35%, transparent); }
    .hero::after { content: ''; position: absolute; right: -60px; top: -60px; width: 220px; height: 220px; border-radius: 50%; background: rgba(255, 255, 255, 0.12); }
    .hero h1 { margin: 6px 0 4px; color: #fff; font-size: clamp(1.5rem, 4vw, 2.1rem); }
    .hero .chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px; background: rgba(255, 255, 255, 0.2); font-size: 0.8rem; font-weight: 600; }
    .hero p { margin: 0; opacity: 0.9; }
    .hero .view-result { position: relative; z-index: 1; margin-top: 14px; --mat-button-outlined-label-text-color: #fff; --mat-button-outlined-outline-color: rgba(255, 255, 255, 0.7); }
    .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin: -28px 12px 20px; position: relative; z-index: 1; }
    .fact { display: flex; gap: 12px; align-items: center; padding: 14px 16px; border-radius: 18px; background: var(--mat-sys-surface); box-shadow: var(--tp-shadow); font-weight: 600; }
    .fact mat-icon { flex: none; width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px; background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container); }
    .fact span { display: block; color: var(--mat-sys-on-surface-variant); font-size: 0.78rem; font-weight: 500; }
    section.block { padding: 20px 22px; margin-bottom: 14px; }
    h3 { margin: 0 0 8px; font-size: 1.05rem; }
    ul { margin: 0; padding-left: 20px; }
    .pre { white-space: pre-wrap; }
    .warn { display: flex; gap: 10px; align-items: flex-start; padding: 14px 16px; border-radius: 16px; background: var(--mat-sys-secondary-container); color: var(--mat-sys-on-secondary-container); margin: 12px 0; }
    .err { color: var(--mat-sys-error); margin: 4px 0 8px; font-size: 13px; }
    .lang { display: block; width: 180px; margin-top: 12px; --mat-form-field-container-height: 44px; --mat-form-field-container-vertical-padding: 10px; font-size: 14px; }
    .live-wait { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 14px 0 0; padding: 12px 16px; border-radius: 14px; background: rgba(255, 255, 255, 0.18); font-weight: 600; }
    .live-wait .clock { font-size: 1.4rem; font-variant-numeric: tabular-nums; }
    .bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 3; display: flex; justify-content: center; padding: 12px 16px; background: color-mix(in srgb, var(--mat-sys-surface) 88%, transparent); backdrop-filter: blur(12px); border-top: 1px solid var(--mat-sys-outline-variant); }
    .bar .in { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; justify-content: space-between; width: min(880px, 100%); }
    .actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    @media (min-width: 960px) { .bar { left: 240px; } }
  `,
  template: `
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    @if (e(); as t) {
      <header class="hero">
        <span class="chip"><mat-icon inline>verified</mat-icon> {{ t.category_name || 'Mock test' }}</span>
        <h1>{{ t.title }}</h1>
        <p>{{ t.is_live ? 'This is a live test: everyone starts together and finishes together.' : 'Read the instructions below, then start when you are ready.' }}</p>
        @if (liveLeft() !== null) {
          <div class="live-wait" role="timer" aria-live="off">
            <mat-icon>sensors</mat-icon> Starts in <span class="clock">{{ liveClock() }}</span>
            <span>Stay on this page. The Start button opens by itself at {{ t.start_at | date: 'h:mm a' }}.</span>
          </div>
        } @else if (t.is_live && t.status !== 'in_progress' && t.can_start) {
          <div class="live-wait">
            <mat-icon>sensors</mat-icon> The test is on.
            @if (t.join_closes_at) { <span>You can join until {{ t.join_closes_at | date: 'h:mm a' }}; you get the time that is left.</span> }
          </div>
        }
        @if (t.last_attempt_id && t.result_available) {
          <a mat-stroked-button class="view-result" [routerLink]="['/student/results', t.last_attempt_id]"><mat-icon>assessment</mat-icon> View your result</a>
        }
      </header>
      <div class="facts">
        <div class="fact"><mat-icon>schedule</mat-icon><div><span>Duration</span>{{ t.duration_minutes }} minutes</div></div>
        <div class="fact"><mat-icon>quiz</mat-icon><div><span>Questions</span>{{ t.question_count }}</div></div>
        <div class="fact"><mat-icon>stars</mat-icon><div><span>Total marks</span>{{ t.total_marks }}</div></div>
        <div class="fact"><mat-icon>remove_circle_outline</mat-icon><div><span>Negative marking</span>{{ t.negative_marking_enabled ? 'Yes, per question' : 'No' }}</div></div>
        <div class="fact"><mat-icon>replay</mat-icon><div><span>Attempts</span>{{ t.attempts_used }} used{{ t.max_attempts ? " of " + t.max_attempts : " (unlimited)" }}</div></div>
        <div class="fact"><mat-icon>event_available</mat-icon><div><span>Available</span>
          @if (t.start_at || t.end_at) { {{ t.start_at ? (t.start_at | date: 'MMM d, h:mm a') : 'Anytime' }} to {{ t.end_at ? (t.end_at | date: 'MMM d, h:mm a') : 'no end' }} } @else { Anytime }
        </div></div>
      </div>
      <mat-card appearance="outlined" class="block">
        <mat-card-content>
          @if (t.description) { <p class="pre">{{ t.description }}</p> }
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
          @if (t.allow_pause) {
            <div class="warn pause-rule">
              <mat-icon inline>pause_circle</mat-icon>
              You can pause this test{{ t.max_pauses ? ' up to ' + t.max_pauses + (t.max_pauses === 1 ? ' time' : ' times') : '' }}. The timer stops and the
              questions are hidden while you are paused, for at most {{ t.pause_minutes }} minutes each time. After that the test
              restarts by itself and the timer keeps running.
            </div>
          }
          <div class="warn">
            <mat-icon inline>timer</mat-icon>
            The timer is controlled by the server and starts the moment you begin. It keeps running if you
            refresh or lose connection, and your answers are submitted automatically when time is up.
          </div>

          @if (t.status !== 'in_progress' && t.can_start) {
            @if (t.languages && t.languages.length > 1) {
              <mat-form-field appearance="outline" class="lang" subscriptSizing="dynamic">
                <mat-label>Language</mat-label>
                <mat-select [value]="chosen()" (selectionChange)="choose($event.value)" [required]="true" [attr.aria-label]="'Language of the questions'">
                  @for (l of t.languages; track l) { <mat-option [value]="l">{{ label[l] }}</mat-option> }
                </mat-select>
              </mat-form-field>
              @if (langError()) { <p class="err" role="alert">Select a language.</p> }
            }
          }
        </mat-card-content>
      </mat-card>
      <div class="bar"><div class="in">
        @if (t.status === 'in_progress') {
          <span></span>
          <div class="actions">
            <a mat-button routerLink="/student/tests">Back</a>
            <button mat-flat-button (click)="go()" [disabled]="starting()"><mat-icon>play_arrow</mat-icon> Resume attempt</button>
          </div>
        } @else if (t.can_start) {
          <mat-checkbox [checked]="agreed()" (change)="agreed.set($event.checked)">
            I have read the instructions and I am ready to begin.
          </mat-checkbox>
          <div class="actions">
            <a mat-button routerLink="/student/tests">Cancel</a>
            <button mat-flat-button (click)="start()" [disabled]="!agreed() || starting()">Start test</button>
          </div>
        } @else {
          <strong>{{ t.reason }}</strong>
          <a mat-stroked-button routerLink="/student/tests">Back to tests</a>
        }
      </div></div>
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

  // A live test counts down to its start by the server's clock, and opens by itself when the time comes.
  private offsetMs = 0;
  private now = signal(Date.now());
  private lastLook = 0;
  /** Seconds until a live test starts, or null when it is not a live test or it has started. */
  liveLeft = computed(() => {
    const t = this.e();
    if (!t?.is_live || !t.start_at) return null;
    const left = (new Date(t.start_at).getTime() - (this.now() + this.offsetMs)) / 1000;
    return left > 0 ? left : null;
  });
  liveClock = computed(() => countdown(this.liveLeft() ?? 0));
  private langs = inject(LanguageService);
  label = LANG_LABEL;
  /** Nothing is pre-selected: the student has to pick a language before the test starts. */
  chosen = signal<Lang | null>(null);
  langError = signal(false);

  constructor() {
    const tick = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
    effect(() => {
      this.id();
      untracked(() => this.load());
    });
    // The start time has come: look again so the test opens without the student having to refresh.
    effect(() => {
      const t = this.e();
      if (t?.is_live && t.status === 'upcoming' && this.liveLeft() === null) untracked(() => this.lookAgain());
    });
  }

  private load() {
    this.api.exam(this.id()).subscribe({
      next: (e) => {
        if (e.server_now) this.offsetMs = new Date(e.server_now).getTime() - Date.now();
        this.now.set(Date.now());
        this.e.set(e);
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.error(err.status === 404 ? 'This test is not available to you.' : apiErrorMessage(err));
        this.router.navigateByUrl('/student/tests');
      },
    });
  }

  private lookAgain() {
    if (Date.now() < this.lastLook + 3000) return; // if the clocks disagree slightly, look again shortly
    this.lastLook = Date.now();
    this.load();
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
