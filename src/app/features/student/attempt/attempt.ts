import { BreakpointObserver } from '@angular/cdk/layout';
import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatSidenavModule } from '@angular/material/sidenav';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { apiErrorMessage } from '../../../core/models';
import { environment } from '../../../../environments/environment';
import { protectExam } from '../../../shared/protect';
import { NotifyService } from '../../../core/notify.service';
import { LangSwitch, Lang, LanguageService, pick } from '../../../shared/language';
import { AnswerPatch, AttemptQuestion, AttemptSectionState, AttemptState, PauseInfo, ResultSummary, formatDuration } from '../student.models';
import { StudentService } from '../student.service';
import { ImageViewer } from '../../../shared/image-viewer';

interface SubmitDialogData {
  total: number;
  answered: number;
  unanswered: number;
  marked: number;
  /** Questions the student never opened. */
  notVisited: number;
  /** Set when submitting one section of a test with timed sections. */
  section?: string;
  last?: boolean;
}

@Component({
  selector: 'app-submit-dialog',
  imports: [MatDialogModule, MatButtonModule],
  styles: `
    .review { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0; padding: 0; list-style: none; }
    .review li { padding: 8px 12px; border-radius: 10px; background: var(--mat-sys-surface-container-high); }
    .review li.warn { background: var(--mat-sys-error-container); color: var(--mat-sys-on-error-container); }
  `,
  template: `
    <h2 mat-dialog-title>{{ data.section && !data.last ? 'Submit ' + data.section + '?' : 'Submit your test?' }}</h2>
    <mat-dialog-content>
      <p>You answered <strong>{{ data.answered }}</strong> of {{ data.total }} questions{{ data.section && !data.last ? ' in this section' : '' }}.</p>
      <ul class="review" aria-label="Summary of your test">
        <li><strong>{{ data.answered }}</strong> answered</li>
        <li [class.warn]="data.unanswered"><strong>{{ data.unanswered }}</strong> not answered</li>
        <li [class.warn]="data.marked"><strong>{{ data.marked }}</strong> marked for review</li>
        <li><strong>{{ data.notVisited }}</strong> not visited</li>
      </ul>
      @if (data.section && !data.last) {
        <p>You will move on to the next section. You cannot come back to {{ data.section }} or change its answers.</p>
      } @else {
        <p>You cannot change your answers after submitting.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">Keep working</button>
      <button mat-flat-button [mat-dialog-close]="true">{{ data.section && !data.last ? 'Submit section' : 'Submit' }}</button>
    </mat-dialog-actions>
  `,
})
export class SubmitDialog {
  data = inject<SubmitDialogData>(MAT_DIALOG_DATA);
}

type SaveState = 'saved' | 'saving' | 'offline';

/** 75 -> "01:15", 3725 -> "1:02:05" */
function clockOf(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

@Component({
  selector: 'app-attempt',
  imports: [RouterLink, NgTemplateOutlet, MatCardModule, MatButtonModule, MatIconModule, MatRadioModule, MatProgressBarModule, MatSidenavModule, LangSwitch],
  styleUrl: './attempt.scss',
  template: `
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

    @if (finished(); as f) {
      <main class="done">
        <mat-card appearance="outlined">
          <mat-card-content>
            <mat-icon class="big">task_alt</mat-icon>
            <h1>{{ f.autoSubmitted ? "Time's up. Your test was submitted." : 'Test submitted' }}</h1>
            <p>{{ title() }}</p>
            @if (f.result) {
              <div class="score">{{ f.result.score }} <span>/ {{ f.result.total_marks }}</span></div>
              <p [class]="f.result.passed ? 'pass' : 'fail'">{{ f.result.passed ? 'Passed' : 'Not passed' }} (passing marks {{ f.result.passing_marks }})</p>
              <div class="grid">
                <div><strong>{{ f.result.correct }}</strong><span>Correct</span></div>
                <div><strong>{{ f.result.incorrect }}</strong><span>Incorrect</span></div>
                <div><strong>{{ f.result.unanswered }}</strong><span>Unanswered</span></div>
                <div><strong>{{ f.result.accuracy }}%</strong><span>Accuracy</span></div>
                <div><strong>{{ duration(f.result.time_taken_seconds) }}</strong><span>Time taken</span></div>
              </div>
            } @else {
              <p>Your answers are saved. Your result will be available once your instructor releases it.</p>
            }
            <div class="actions">
              @if (f.result) { <a mat-flat-button [routerLink]="['/student/results', id()]">View detailed result</a> }
              <a mat-stroked-button routerLink="/student/dashboard">Back to dashboard</a>
              <a mat-button routerLink="/student/attempts">My attempts</a>
            </div>
          </mat-card-content>
        </mat-card>
      </main>
    } @else if (paused()) {
      <main class="done paused">
        <mat-card appearance="outlined">
          <mat-card-content>
            <mat-icon class="big">pause_circle</mat-icon>
            <h1>Test paused</h1>
            <p>{{ title() }}</p>
            <div class="score">{{ frozenClock() }} <span>left</span></div>
            <p>Your timer is stopped and your answers are saved. The questions stay hidden until you resume.</p>
            @if (autoResumeIn() !== null) {
              <p class="hint">The test restarts by itself in <strong>{{ autoResumeClock() }}</strong>, and the timer then keeps running.</p>
            }
            @if (pauseNote()) { <p class="hint">{{ pauseNote() }}</p> }
            <div class="actions">
              <button mat-flat-button (click)="resumeTest()" [disabled]="busy()"><mat-icon>play_arrow</mat-icon> Resume test</button>
            </div>
          </mat-card-content>
        </mat-card>
      </main>
    } @else if (q(); as cur) {
      <mat-sidenav-container class="shell">
        <!-- Small screens: the question palette lives in a drawer opened from the burger button on the right. -->
        <mat-sidenav #drawer mode="over" position="end" [fixedInViewport]="true" class="palette-drawer" aria-label="Question palette">
          @if (mobile()) {
            <div class="drawer-head">
              <strong>Questions</strong>
              <button mat-icon-button (click)="drawer.close()" aria-label="Close question palette"><mat-icon>close</mat-icon></button>
            </div>
            <div class="palette in-drawer"><ng-container *ngTemplateOutlet="paletteBody" /></div>
          }
        </mat-sidenav>

        <mat-sidenav-content>
          <header class="bar">
            <div class="title-wrap">
              <div class="title">{{ title() }}</div>
            </div>
            <div class="right">
              <span class="save" [class]="'save ' + saveState()">
                <mat-icon inline>{{ saveState() === 'saved' ? 'cloud_done' : saveState() === 'saving' ? 'sync' : 'cloud_off' }}</mat-icon>
                {{ saveState() === 'saved' ? 'Saved' : saveState() === 'saving' ? 'Saving…' : 'Offline, retrying…' }}
              </span>
              @if (sectional()) {
                <span class="timer" [class.low]="sectionRemaining() <= 60" role="timer" aria-live="off" title="Time left in this section">
                  <mat-icon inline>timer</mat-icon> {{ sectionClock() }}
                </span>
                <span class="total" title="Time left in the whole test">Test {{ clock() }}</span>
              } @else {
                <span class="timer" [class.low]="remaining() <= 300" role="timer" aria-live="off">
                  <mat-icon inline>timer</mat-icon> {{ clock() }}
                </span>
              }
              @if (pause()?.allowed) {
                <button mat-stroked-button class="pause-btn" (click)="pauseTest()" [disabled]="submitting() || busy() || pauseBlocked()" [attr.title]="pauseHint()">
                  <mat-icon>pause</mat-icon> Pause
                </button>
              }
              <button mat-flat-button (click)="confirmSubmit()" [disabled]="submitting()">{{ submitLabel() }}</button>
              @if (mobile()) {
                <button mat-icon-button (click)="drawer.toggle()" aria-label="Open question palette"><mat-icon>menu</mat-icon></button>
              }
            </div>
          </header>

          <div class="layout">
            <section class="main">
              @if (sections().length > 1) {
                <nav class="sections" role="tablist" aria-label="Subjects">
                  @for (g of sections(); track g.name) {
                    <button type="button" role="tab" class="sec" [class.active]="g.current" [class.closed]="g.status === 'done'"
                      [attr.aria-selected]="g.current" [disabled]="sectional() && !g.current" (click)="openSection(g.name)">
                      <span class="sec-name">
                        @if (g.status === 'done') { <mat-icon inline>check_circle</mat-icon> }
                        {{ g.name }}
                      </span>
                      <span class="sec-sub">{{ g.caption }}</span>
                    </button>
                  }
                </nav>
              }
              <mat-card appearance="outlined">
                <mat-card-content>
                  <div class="q-head">
                    <span>{{ cur.section }} · Question {{ index() + 1 }} of {{ questions().length }}</span>
                    <app-lang-switch [languages]="languages()" />
                    <span class="qtime" title="Time you have spent on this question" role="timer" aria-live="off">
                      <mat-icon inline>timer</mat-icon> {{ questionClock() }}
                    </span>
                    <span>+{{ cur.q.marks }} / -{{ cur.q.negative_marks }}</span>
                  </div>
                  @if (cur.q.image_url) {
                    <img class="zoomable" [src]="cur.q.image_url" alt="Question image" tabindex="0" role="button" title="Tap to enlarge"
                      (click)="zoom(cur.q.image_url)" (keydown.enter)="zoom(cur.q.image_url)" />
                  }
                  <div class="q-text" [attr.lang]="lang()">{{ say(cur.q.text, cur.q.text_hi) }}</div>
                  <mat-radio-group class="options" [value]="cur.q.selected_option" (change)="select($event.value)" [attr.aria-label]="'Options for question ' + (index() + 1)">
                    @for (o of cur.q.options; track o.id; let i = $index) {
                      <mat-radio-button [value]="o.id" class="opt" [class.chosen]="cur.q.selected_option === o.id">
                        <span class="letter">{{ letter(i) }}.</span> {{ say(o.text, o.text_hi) }}
                      </mat-radio-button>
                    }
                  </mat-radio-group>
                </mat-card-content>
              </mat-card>
              <div class="nav">
                <button mat-stroked-button (click)="go(index() - 1)" [disabled]="index() === 0"><mat-icon>chevron_left</mat-icon> Previous</button>
                <button mat-button (click)="clear()" [disabled]="cur.q.selected_option === null">Clear response</button>
                <button mat-button (click)="toggleMark()">
                  <mat-icon>{{ cur.q.marked_for_review ? 'bookmark_remove' : 'bookmark_add' }}</mat-icon>
                  {{ cur.q.marked_for_review ? 'Unmark review' : 'Mark for review' }}
                </button>
                <span class="spacer"></span>
                <button mat-flat-button (click)="go(index() + 1)" [disabled]="index() === questions().length - 1">Next <mat-icon iconPositionEnd>chevron_right</mat-icon></button>
              </div>
            </section>

            <!-- Wide screens: the palette sits beside the question. -->
            @if (!mobile()) {
              <aside class="palette"><ng-container *ngTemplateOutlet="paletteBody" /></aside>
            }
          </div>
        </mat-sidenav-content>
      </mat-sidenav-container>

      <ng-template #paletteBody>
        <div class="counts">
          <span><i class="sw answered"></i> {{ counts().answered }} answered</span>
          <span><i class="sw unanswered"></i> {{ counts().unanswered }} unanswered</span>
          <span><i class="sw marked"></i> {{ counts().marked }} marked</span>
        </div>
        @for (g of groups(); track g.name) {
          <div class="group-name">{{ g.name }}</div>
          <div class="grid-nums">
            @for (n of g.items; track n.i) {
              <button type="button" class="num" [class]="'num ' + n.state" [class.current]="n.i === index()"
                (click)="go(n.i); mobile() && drawer.close()" [attr.aria-label]="'Question ' + (n.i + 1) + ', ' + n.label">{{ n.i + 1 }}</button>
            }
          </div>
        }
        <div class="legend">
          <span><i class="sw answered"></i> Answered</span>
          <span><i class="sw unanswered"></i> Not answered</span>
          <span><i class="sw marked"></i> Marked</span>
          <span><i class="sw answered-marked"></i> Answered + marked</span>
          <span><i class="sw not-visited"></i> Not visited</span>
        </div>
      </ng-template>
    }
  `,
})
export class AttemptPage {
  id = input.required<string>();

  private api = inject(StudentService);
  private router = inject(Router);
  /** Below this width the question palette moves into a drawer opened by the burger button. */
  mobile = toSignal(inject(BreakpointObserver).observe('(max-width: 900px)').pipe(map((r) => r.matches)), { initialValue: false });
  private notify = inject(NotifyService);
  private dialog = inject(MatDialog);

  loading = signal(true);
  /** True for a test whose sections each have their own timer and open one after another. */
  sectional = signal(false);
  /** Languages this test is written in; the student's choice is remembered across questions, tests and visits. */
  languages = signal<Lang[]>(['en']);
  private langs = inject(LanguageService);
  lang = computed<Lang>(() => (this.languages().includes(this.langs.lang()) ? this.langs.lang() : (this.languages()[0] ?? 'en')));
  say = (en?: string, hi?: string) => pick(en, hi, this.lang());
  sectionMeta = signal<AttemptSectionState[]>([]);
  title = signal('');
  questions = signal<(AttemptQuestion & { section: string })[]>([]);
  index = signal(0);
  saveState = signal<SaveState>('saved');
  submitting = signal(false);
  finished = signal<{ result: ResultSummary | null; autoSubmitted: boolean } | null>(null);

  // Pausing: the server stops the clock and sends no questions while the test is paused.
  pause = signal<PauseInfo | null>(null);
  paused = signal(false);
  /** A pause or resume request is in flight. */
  busy = signal(false);
  private frozenSeconds = signal(0);
  private autoResumeMs = 0;
  private resumeRetryAt = 0;
  frozenClock = computed(() => clockOf(this.frozenSeconds()));
  /** Seconds until a pause ends by itself, or null when that is not known. */
  autoResumeIn = computed(() => (this.paused() && this.autoResumeMs ? Math.max(0, Math.floor((this.autoResumeMs - (this.now() + this.offsetMs)) / 1000)) : null));
  autoResumeClock = computed(() => clockOf(this.autoResumeIn() ?? 0));
  pauseBlocked = computed(() => this.pause()?.pauses_left === 0);
  pauseHint = computed(() => {
    const p = this.pause();
    if (!p) return '';
    if (p.pauses_left === 0) return 'You have used all your pauses.';
    const left = p.pauses_left === null ? 'Unlimited pauses' : `${p.pauses_left} pause${p.pauses_left === 1 ? '' : 's'} left`;
    return `Stop the clock for up to ${p.max_minutes} minutes. ${left}.`;
  });
  pauseNote = computed(() => {
    const p = this.pause();
    if (!p) return '';
    if (p.pauses_left === null) return '';
    return p.pauses_left === 0 ? 'You have no pauses left after this one.' : `You can pause ${p.pauses_left} more time${p.pauses_left === 1 ? '' : 's'}.`;
  });

  // Clock: the server's deadline and clock are the truth; the browser only counts seconds between syncs.
  private offsetMs = 0;
  private deadlineMs = 0;
  private sectionEndMs = 0;
  private activeOrder: number | null = null;
  private activeName = '';
  private movingOn = false;
  private sectionRetryAt = 0;
  private now = signal(Date.now());
  remaining = computed(() => Math.max(0, Math.floor((this.deadlineMs - (this.now() + this.offsetMs)) / 1000)));
  sectionRemaining = computed(() => Math.max(0, Math.floor((this.sectionEndMs - (this.now() + this.offsetMs)) / 1000)));
  clock = computed(() => clockOf(this.remaining()));
  sectionClock = computed(() => clockOf(this.sectionRemaining()));
  /** Whether another section is still to come after the one the student is in. */
  hasUpcoming = computed(() => this.sectionMeta().some((s) => s.status === 'upcoming'));
  submitLabel = computed(() => (this.sectional() ? (this.hasUpcoming() ? 'Submit section' : 'Submit test') : 'Submit'));

  q = computed(() => {
    const list = this.questions();
    const q = list[this.index()];
    return q ? { q, section: q.section } : null;
  });

  counts = computed(() => {
    const l = this.questions();
    const answered = l.filter((x) => x.selected_option !== null).length;
    return { answered, unanswered: l.length - answered, marked: l.filter((x) => x.marked_for_review).length };
  });

  /** Questions the student never opened (the one on screen counts as opened). */
  notVisited = computed(() => this.questions().filter((x, i) => !x.visited && i !== this.index() && x.selected_option === null && !x.marked_for_review).length);

  /** Time on the question on screen as m:ss: what was saved earlier plus the seconds running now. */
  questionClock = computed(() => {
    this.now(); // re-evaluated every second
    const cur = this.q();
    if (!cur) return '0:00';
    const running = this.counting && !this.finished() ? Math.max(0, (Date.now() - this.lastMark) / 1000) : 0;
    const total = Math.floor((this.spent.get(cur.q.id) ?? 0) + running);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });

  /** The subjects (sections) of the test with how far the student is in each one. */
  sections = computed(() => {
    if (this.sectional()) {
      // Timed sections: the server decides which one is open. Finished sections are locked, later ones are hidden.
      const live = this.counts();
      return this.sectionMeta().map((m) => ({
        name: m.name,
        total: m.question_count ?? 0,
        answered: m.status === 'active' ? live.answered : (m.answered_count ?? 0),
        started: m.status !== 'upcoming',
        current: m.status === 'active',
        status: m.status === 'done' ? 'done' : m.status === 'active' ? 'current' : 'upcoming',
        caption:
          m.status === 'done' ? (m.closed_by === 'expired' ? 'Time over' : 'Submitted')
          : m.status === 'active' ? `${live.answered}/${m.question_count} answered`
          : `Upcoming · ${Math.round((m.duration_seconds ?? 0) / 60)} min`,
      }));
    }
    const cur = this.q()?.section;
    const out: { name: string; total: number; answered: number; started: boolean }[] = [];
    this.questions().forEach((x, i) => {
      let g = out.find((o) => o.name === x.section);
      if (!g) out.push((g = { name: x.section, total: 0, answered: 0, started: false }));
      g.total++;
      if (x.selected_option !== null) g.answered++;
      if (x.visited || i === this.index()) g.started = true;
    });
    return out.map((g) => {
      const status = g.answered === g.total ? 'done' : g.name === cur ? 'current' : g.started ? 'started' : 'upcoming';
      return {
        ...g,
        current: g.name === cur,
        status,
        caption: status === 'upcoming' ? 'Upcoming' : `${g.answered}/${g.total} answered`,
      };
    });
  });

  groups = computed(() => {
    const out: { name: string; items: { i: number; state: string; label: string }[] }[] = [];
    this.questions().forEach((x, i) => {
      const answered = x.selected_option !== null;
      const state = x.marked_for_review ? (answered ? 'answered-marked' : 'marked') : answered ? 'answered' : x.visited || i === this.index() ? 'unanswered' : 'not-visited';
      const label = state.replace('-', ' and ').replace('unanswered', 'not answered').replace('not and visited', 'not visited');
      let g = out.find((o) => o.name === x.section);
      if (!g) out.push((g = { name: x.section, items: [] }));
      g.items.push({ i, state, label });
    });
    return out;
  });

  private pending = new Map<number, AnswerPatch>();
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private flushing = false;
  private autoSubmitting = false;
  private spent = new Map<number, number>();
  private lastMark = Date.now();
  private counting = true;
  private timeTimer: ReturnType<typeof setInterval>;
  private onVisibility = () => {
    if (document.hidden) {
      this.accrue();
      this.counting = false;
    } else {
      this.counting = true;
      this.lastMark = Date.now();
    }
  };
  private tickTimer: ReturnType<typeof setInterval>;
  private guard = (e: BeforeUnloadEvent) => {
    if (!this.finished() && !this.paused()) {
      e.preventDefault();
      e.returnValue = '';
    }
  };

  constructor() {
    inject(DestroyRef).onDestroy(protectExam(document, environment.production));
    this.tickTimer = setInterval(() => this.now.set(Date.now()), 1000);
    this.timeTimer = setInterval(() => this.accrue(), 10_000);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('beforeunload', this.guard);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(this.tickTimer);
      clearInterval(this.timeTimer);
      document.removeEventListener('visibilitychange', this.onVisibility);
      clearTimeout(this.flushTimer);
      window.removeEventListener('beforeunload', this.guard);
    });

    // Only the route id may re-trigger a load; everything load() touches must not become a dependency.
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
    // A section's time is up: save, then let the server open the next section.
    effect(() => {
      if (this.sectional() && !this.loading() && !this.finished() && this.hasUpcoming() && this.activeOrder !== null && this.sectionRemaining() === 0) {
        untracked(() => this.sectionExpired());
      }
    });
    // Tell the student when five minutes and one minute are left (of the section, in a test with timed sections).
    effect(() => {
      if (this.loading() || this.finished() || !this.questions().length) return;
      const sectionTimed = this.sectional() && this.hasUpcoming();
      const left = sectionTimed ? this.sectionRemaining() : this.remaining();
      untracked(() => this.timeWarning(left, sectionTimed ? `in ${this.activeName}` : 'for this test'));
    });
    // A pause that has used up its time ends on the server by itself: look again so the test comes back.
    effect(() => {
      if (this.paused() && this.autoResumeIn() === 0) untracked(() => this.checkAutoResume());
    });
    // Time is up: submit without waiting for a click.
    effect(() => {
      if (!this.loading() && !this.finished() && this.questions().length && this.remaining() === 0) {
        untracked(() => this.autoSubmit());
      }
    });
  }

  private warned = new Set<string>();
  private timeWarning(left: number, where: string) {
    for (const [limit, text] of [[60, '1 minute'], [300, '5 minutes']] as const) {
      const key = `${this.activeOrder}:${limit}`;
      if (left > 0 && left <= limit && !this.warned.has(key)) {
        // Crossing 5 minutes and 1 minute only gives the message for the smaller limit that now applies.
        this.warned.add(key);
        if (limit === 300 && left <= 60) this.warned.add(`${this.activeOrder}:60`);
        this.notify.warning(`Only ${left <= 60 ? '1 minute' : text} left ${where}.`);
        return;
      }
    }
  }

  letter(i: number) {
    return String.fromCharCode(65 + i);
  }
  duration = formatDuration;

  // --- loading / clock ---
  private load(id: string) {
    this.loading.set(true);
    this.api.attempt(id).subscribe({
      next: (a) => this.apply(a),
      error: (e) => {
        this.notify.error(e.status === 404 ? 'Attempt not found.' : apiErrorMessage(e));
        this.router.navigateByUrl('/student/dashboard');
      },
    });
  }

  private apply(a: AttemptState) {
    this.title.set(a.exam.title);
    this.syncClock(a.server_now, a.deadline);
    this.pause.set(a.pause ?? null);
    if (a.status === 'submitted') {
      this.paused.set(false);
      this.finished.set({ result: a.result ?? null, autoSubmitted: !!a.auto_submitted });
      this.loading.set(false);
      return;
    }
    if (a.paused) {
      this.frozenSeconds.set(a.remaining_seconds);
      this.autoResumeMs = a.pause?.auto_resume_at ? new Date(a.pause.auto_resume_at).getTime() : 0;
      this.questions.set([]);
      this.paused.set(true);
      this.loading.set(false);
      return;
    }
    this.paused.set(false);
    let source: AttemptSectionState[] = a.sections ?? [];
    this.sectional.set(!!a.sectional);
    if (a.languages?.length) this.languages.set(a.languages);
    if (a.sectional) {
      const meta = a.sections ?? [];
      const open = meta.find((s) => s.status === 'active');
      this.sectionMeta.set(meta);
      source = open ? [open] : [];
      if (open) this.sectionEndMs = new Date(a.server_now).getTime() + (open.remaining_seconds ?? 0) * 1000;
      if (open && this.activeOrder !== null && open.order !== this.activeOrder) {
        const left = meta.find((s) => s.order === this.activeOrder);
        this.notify.success(left?.closed_by === 'expired' ? `Time for ${this.activeName} is over. You are now in ${open.name}.` : `You are now in ${open.name}.`);
      }
      this.activeOrder = open?.order ?? null;
      this.activeName = open?.name ?? '';
    }
    const flat = source.flatMap((s) => s.questions.map((q) => ({ ...q, section: s.name })));
    this.questions.set(flat);
    flat.forEach((q) => this.spent.set(q.id, q.time_spent ?? 0));
    this.lastMark = Date.now();
    const firstOpen = flat.findIndex((q) => q.selected_option === null);
    this.index.set(Math.max(0, firstOpen));
    this.markVisited(this.index());
    this.loading.set(false);
  }

  private syncClock(serverNow: string, deadline: string) {
    this.offsetMs = new Date(serverNow).getTime() - Date.now();
    this.deadlineMs = new Date(deadline).getTime();
    this.now.set(Date.now());
  }

  // --- answering ---
  private patchLocal(qid: number, patch: Partial<AttemptQuestion>) {
    this.questions.update((l) => l.map((x) => (x.id === qid ? { ...x, ...patch } : x)));
  }

  /** quiet = background bookkeeping (time spent): no "Saving…" flicker and a relaxed flush. */
  private queue(p: AnswerPatch, quiet = false) {
    this.pending.set(p.question, { ...(this.pending.get(p.question) ?? {}), ...p });
    if (quiet) {
      if (this.flushTimer === undefined) this.scheduleFlush(1500);
      return;
    }
    this.saveState.set('saving');
    this.scheduleFlush(250);
  }

  private scheduleFlush(ms: number) {
    clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      this.flush();
    }, ms);
  }

  /** True when something the student did (not just the stopwatch) is waiting to be saved. */
  private hasUnsavedWork() {
    return [...this.pending.values()].some((p) => p.selected_option !== undefined || p.marked_for_review !== undefined || p.visited !== undefined);
  }

  /**
   * Adds the time since the last mark to the question on screen. The running total per question is what gets sent,
   * so a retry or a late duplicate can never double count. Time stops while the tab is hidden.
   */
  private accrue() {
    const now = Date.now();
    const cur = this.q();
    if (cur && this.counting && !this.finished()) {
      const total = (this.spent.get(cur.q.id) ?? 0) + Math.max(0, (now - this.lastMark) / 1000);
      this.spent.set(cur.q.id, total);
      this.queue({ question: cur.q.id, time_spent: Math.floor(total) }, true);
    }
    this.lastMark = now;
  }

  /** Opens the question picture at full size. */
  zoom(src: string) {
    ImageViewer.open(this.dialog, src);
  }

  select(optionId: number) {
    const cur = this.q();
    if (!cur || this.finished() || cur.q.selected_option === optionId) return;
    this.patchLocal(cur.q.id, { selected_option: optionId });
    this.queue({ question: cur.q.id, selected_option: optionId });
  }

  clear() {
    const cur = this.q();
    if (!cur || this.finished()) return;
    this.patchLocal(cur.q.id, { selected_option: null });
    this.queue({ question: cur.q.id, selected_option: null });
  }

  toggleMark() {
    const cur = this.q();
    if (!cur || this.finished()) return;
    const v = !cur.q.marked_for_review;
    this.patchLocal(cur.q.id, { marked_for_review: v });
    this.queue({ question: cur.q.id, marked_for_review: v });
  }

  /** Jump to a subject: its first unanswered question, or its first question when all are answered. */
  openSection(name: string) {
    if (this.sectional()) return; // sections open in order and cannot be revisited
    const list = this.questions();
    const inSection = list.map((x, i) => ({ x, i })).filter(({ x }) => x.section === name);
    const target = inSection.find(({ x }) => x.selected_option === null) ?? inSection[0];
    if (target) this.go(target.i);
  }

  go(i: number) {
    if (i < 0 || i >= this.questions().length) return;
    this.accrue(); // credit the time to the question being left
    this.index.set(i);
    this.markVisited(i);
  }

  private markVisited(i: number) {
    const x = this.questions()[i];
    if (x && !x.visited) {
      this.patchLocal(x.id, { visited: true });
      this.queue({ question: x.id, visited: true });
    }
  }

  /** Sends queued changes. Failures keep them queued and retry; the server stays the source of truth. */
  async flush(): Promise<boolean> {
    if (this.flushing) return false;
    if (!this.pending.size) {
      this.saveState.set('saved');
      return true;
    }
    this.flushing = true;
    const sent = new Map(this.pending);
    try {
      const res = await firstValueFrom(this.api.saveAnswers(this.id(), [...sent.values()]));
      for (const [qid, p] of sent) if (this.pending.get(qid) === p) this.pending.delete(qid);
      this.syncClock(res.server_now, res.deadline);
      this.saveState.set(this.hasUnsavedWork() ? 'saving' : 'saved');
      if (res.ignored) this.reload(); // some answers belonged to a section that has just closed
      return true;
    } catch (e: any) {
      if (e.status === 409) {
        // The attempt already ended on the server (deadline passed or submitted elsewhere).
        this.pending.clear();
        this.load(this.id());
        return false;
      }
      if (e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 408 && e.status !== 429) {
        this.pending.clear();
        this.notify.error(apiErrorMessage(e));
        this.load(this.id());
        return false;
      }
      this.saveState.set('offline');
      this.scheduleFlush(4000);
      return false;
    } finally {
      this.flushing = false;
      if (this.pending.size && this.saveState() !== 'offline') this.scheduleFlush(100);
    }
  }

  private async flushAll(): Promise<boolean> {
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    for (let i = 0; i < 5; i++) {
      while (this.flushing) await new Promise((r) => setTimeout(r, 100));
      if (!this.pending.size) return true;
      if (!(await this.flush()) && this.saveState() === 'offline') return false;
    }
    return !this.pending.size;
  }

  // --- submitting ---
  confirmSubmit() {
    const c = this.counts();
    const last = !this.hasUpcoming();
    const data: SubmitDialogData = { total: this.questions().length, ...c, notVisited: this.notVisited(), ...(this.sectional() ? { section: this.activeName, last } : {}) };
    this.dialog
      .open(SubmitDialog, { data })
      .afterClosed()
      .subscribe((ok) => ok && (this.sectional() && !last ? this.submitSection() : this.submit(false)));
  }

  /** Stops the clock. Saves first so nothing the student just did is lost while the questions are hidden. */
  async pauseTest() {
    if (this.busy() || this.submitting() || this.paused()) return;
    this.busy.set(true);
    this.accrue();
    if (!(await this.flushAll())) {
      this.busy.set(false);
      this.notify.error('Cannot reach the server to save your latest answers. Check your connection and try again.');
      return;
    }
    try {
      this.apply(await firstValueFrom(this.api.pause(this.id())));
    } catch (e: any) {
      this.notify.error(apiErrorMessage(e));
      if (e.status === 409) this.reload(); // the attempt ended, or the pause limit was reached: show the server's view
    } finally {
      this.busy.set(false);
    }
  }

  /** Restarts the clock with the same time left. */
  async resumeTest() {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      this.apply(await firstValueFrom(this.api.resume(this.id())));
    } catch (e: any) {
      this.notify.error(apiErrorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  private checkAutoResume() {
    if (Date.now() < this.resumeRetryAt) return;
    this.resumeRetryAt = Date.now() + 3000; // if the clocks disagree slightly, look again shortly
    this.reload();
  }

  /** Re-reads the attempt from the server (it decides which section is open). */
  private reload() {
    this.api.attempt(this.id()).subscribe({ next: (a) => this.apply(a), error: () => undefined });
  }

  /** The open section's timer reached zero: save what we have and let the server open the next section. */
  private async sectionExpired() {
    if (this.movingOn || Date.now() < this.sectionRetryAt) return;
    this.movingOn = true;
    this.accrue();
    await this.flushAll();
    this.sectionRetryAt = Date.now() + 2000; // if the clocks disagree slightly, look again shortly
    this.api.attempt(this.id()).subscribe({
      next: (a) => {
        this.apply(a);
        this.movingOn = false;
      },
      error: () => (this.movingOn = false),
    });
  }

  /** The student submits the section they are in and moves on. */
  private async submitSection() {
    if (this.submitting() || this.movingOn || this.activeOrder === null) return;
    this.submitting.set(true);
    this.accrue();
    if (!(await this.flushAll())) {
      this.submitting.set(false);
      this.notify.error('Cannot reach the server to save your latest answers. Check your connection and try again.');
      return;
    }
    try {
      this.apply(await firstValueFrom(this.api.submitSection(this.id(), this.activeOrder)));
    } catch (e: any) {
      this.notify.error(apiErrorMessage(e));
    } finally {
      this.submitting.set(false);
    }
  }

  private async autoSubmit() {
    if (this.autoSubmitting) return;
    this.autoSubmitting = true;
    await this.submit(true);
    this.autoSubmitting = false;
  }

  private async submit(auto: boolean) {
    if (this.submitting() && !auto) return;
    this.submitting.set(true);
    this.accrue(); // include the time on the last question
    const flushed = await this.flushAll();
    if (!flushed && !auto) {
      this.submitting.set(false);
      this.notify.error('Cannot reach the server to save your latest answers. Check your connection and try again.');
      return;
    }
    // At the deadline we submit even if the last save failed; the server scores what it already has.
    for (let attempt = 0; attempt < (auto ? 20 : 1); attempt++) {
      try {
        const r = await firstValueFrom(this.api.submit(this.id()));
        this.finished.set({ result: r.result, autoSubmitted: r.auto_submitted });
        this.submitting.set(false);
        return;
      } catch (e: any) {
        if (!auto || (e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429)) {
          this.submitting.set(false);
          this.notify.error(apiErrorMessage(e));
          return;
        }
        await new Promise((res) => setTimeout(res, 3000));
      }
    }
    this.submitting.set(false);
  }
}
