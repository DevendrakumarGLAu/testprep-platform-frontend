import { BreakpointObserver } from '@angular/cdk/layout';
import { Location, NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, HostListener, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { apiErrorMessage } from '../../../core/models';
import { isProtected, protectExam } from '../../../shared/protect';
import { NotifyService } from '../../../core/notify.service';
import { LangSwitch, Lang, LanguageService, pick } from '../../../shared/language';
import { AnswerPatch, AttemptQuestion, AttemptSectionState, AttemptState, PauseInfo, ResultSummary, formatDuration } from '../student.models';
import { StudentService } from '../student.service';
import { ImageViewer } from '../../../shared/image-viewer';
import { ConfirmDialog } from '../../../shared/confirm-dialog';
import { BsModal } from '../../coach/bs-modal/bs-modal';

export interface SubmitDialogData {
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
  imports: [RouterLink, NgTemplateOutlet, LangSwitch, BsModal],
  templateUrl: './attempt.html',
  styleUrl: './attempt.scss',
  host: { class: 'bs' },
})
export class AttemptPage {
  id = input.required<string>();

  private api = inject(StudentService);
  private router = inject(Router);
  /** Below this width the question palette moves into a drawer opened by the burger button. */
  mobile = toSignal(inject(BreakpointObserver).observe('(max-width: 900px)').pipe(map((r) => r.matches)), { initialValue: false });
  private notify = inject(NotifyService);
  private dialog = inject(MatDialog);
  private location = inject(Location);

  loading = signal(true);
  /** The question palette drawer on small screens. */
  drawerOpen = signal(false);
  /** What the submit pop-up shows; null while it is closed. */
  submitData = signal<SubmitDialogData | null>(null);
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
    const how = p.max_minutes ? `Stop the clock for up to ${p.max_minutes} minutes` : 'Stop the clock and come back whenever you like';
    return `${how}. ${left}.`;
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
    inject(DestroyRef).onDestroy(protectExam(document, isProtected()));
    this.tickTimer = setInterval(() => this.now.set(Date.now()), 1000);
    this.timeTimer = setInterval(() => this.accrue(), 10_000);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('beforeunload', this.guard);
    inject(DestroyRef).onDestroy(() => {
      this.pauseOnExit();
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

  /** True when going back can pause the test: it allows pausing and no pause limit has been reached. */
  canAutoPause = computed(() => !!this.pause()?.allowed && !this.pauseBlocked());
  private leaving = false;

  /**
   * The back arrow. When the test allows pausing it pauses the test (answers saved, clock stopped) and goes back, so nothing is lost
   * and the student resumes any time. When it does not (a live test, or no pauses left) the student is asked first, because the
   * clock keeps running while they are away.
   */
  async leave() {
    if (this.canAutoPause()) {
      this.leaving = true;
      await this.pauseTest();
      if (this.paused() || this.finished()) return this.goBack();
      this.leaving = false; // the pause did not happen (offline, or the server said no): stay and say why
      return;
    }
    const sure = await firstValueFrom(
      this.dialog.open(ConfirmDialog, {
        data: {
          title: 'Leave the test for now?',
          message: this.pause()?.allowed
            ? 'Your answers are saved and the test is not submitted. The timer keeps running while you are away. To stop the clock, use Pause instead.'
            : 'Your answers are saved and the test is not submitted. The timer keeps running while you are away, so come back soon.',
          confirmLabel: 'Leave',
        },
      }).afterClosed(),
    );
    if (!sure) return;
    await this.flush();
    this.goBack();
  }

  private goBack() {
    if (window.history.length > 1) this.location.back();
    else this.router.navigateByUrl('/student/tests');
  }

  /**
   * Leaving the page any other way (the browser or phone back button, a menu link) pauses the test too, when it can, so the clock
   * does not run while the student is somewhere else. Best effort: closing the tab cannot do this, and then the clock keeps running.
   */
  private pauseOnExit() {
    if (this.leaving || this.paused() || this.finished() || !this.q() || !this.canAutoPause()) return;
    const id = this.id();
    void this.flushAll().then((saved) => (saved ? firstValueFrom(this.api.pause(id)).catch(() => undefined) : undefined));
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
    this.submitData.set(data);
  }

  /** The student's answer to the submit pop-up. */
  answerSubmit(ok: boolean) {
    const data = this.submitData();
    this.submitData.set(null);
    if (!ok || !data) return;
    if (data.section && !data.last) void this.submitSection();
    else void this.submit(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape() {
    this.drawerOpen.set(false);
  }

  protected onDrawerBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) this.drawerOpen.set(false);
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
