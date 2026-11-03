import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { countdown } from '../../shared/countdown';
import { LANG_LABEL, Lang, LanguageService } from '../../shared/language';
import { StudentExam } from './student.models';
import { StudentService } from './student.service';

@Component({
  selector: 'app-test-instructions',
  imports: [DatePipe, RouterLink],
  templateUrl: './test-instructions.html',
  styleUrl: './test-instructions.scss',
  host: { class: 'bs' },
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
