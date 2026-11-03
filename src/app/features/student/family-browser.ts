import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { BsTab, BsTabs } from '../../shared/bs-tabs/bs-tabs';
import { PrepExam, PrepFamily } from './student.models';
import { StudentService } from './student.service';
import { PrepHub } from './prep-hub';

/**
 * A family of exams, for example SSC: one tab per exam (SSC CGL, SSC CHSL, SSC MTS), and inside each exam the tabs
 * Full tests, Mini mocks, Previous year and Subject wise. The chosen exam is kept in the address (?exam=).
 */
@Component({
  selector: 'app-family-browser',
  imports: [RouterLink, BsTabs, PrepHub],
  templateUrl: './family-browser.html',
  styleUrl: './family-browser.scss',
  host: { class: 'bs' },
})
export class FamilyBrowser {
  id = input.required<string>();
  /** The exam whose tab is open (public id), from the address. */
  exam = input<string>();
  private api = inject(StudentService);
  private notify = inject(NotifyService);
  private router = inject(Router);

  loading = signal(true);
  private all = signal<PrepExam[]>([]);
  private families = signal<PrepFamily[]>([]);

  family = computed(() => this.families().find((f) => f.id === this.id()) ?? null);
  exams = computed(() => this.all().filter((e) => e.group?.id === this.id()));
  index = computed(() => Math.max(0, this.exams().findIndex((e) => e.id === this.exam())));
  /** The exam open now. */
  open = computed(() => this.exams()[this.index()] ?? null);
  strip = computed<BsTab[]>(() => this.exams().map((e) => ({ key: e.id, label: `${e.name} (${e.counts.total})` })));

  constructor() {
    effect(() => {
      this.id();
      untracked(() => this.load());
    });
  }

  private load() {
    this.loading.set(true);
    this.api.prep().subscribe({
      next: (r) => {
        this.all.set(r.exams);
        this.families.set(r.families ?? []);
        this.loading.set(false);
        if (!(r.families ?? []).some((f) => f.id === this.id())) {
          this.notify.error('This exam family is not available.');
          this.router.navigateByUrl('/student/tests');
        }
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  pick(i: number) {
    const e = this.exams()[i];
    if (e && e.id !== this.exam()) this.router.navigate([], { queryParams: { exam: e.id, type: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
