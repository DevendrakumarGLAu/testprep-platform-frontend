import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { BsTab, BsTabs } from '../../shared/bs-tabs/bs-tabs';
import { PrepHubData, StudentExam } from './student.models';
import { LiveStrip } from './live-strip';
import { StudentService } from './student.service';
import { TestCard } from './test-card';

/** The tabs of an exam, in order. The ids go in the address (?type=) so a refresh or a shared link opens the same tab. */
export const HUB_TABS = ['full', 'mini', 'previous', 'subject'] as const;
type HubTab = (typeof HUB_TABS)[number];

const STANDARD_LABELS: Record<HubTab, string> = { full: 'Full tests', mini: 'Mini mocks', previous: 'Previous year', subject: 'Subject wise' };

/**
 * One exam, for example SSC CGL, with everything a student can attempt, in up to four tabs: Full tests, Mini mocks,
 * Previous year papers and Subject wise (Maths, Reasoning...). The admin chooses which show, their names and their order.
 * Used on its own and inside the exam tabs of a family.
 */
@Component({
  selector: 'app-prep-hub',
  imports: [RouterLink, BsTabs, TestCard, LiveStrip],
  templateUrl: './prep-hub.html',
  styleUrl: './prep-hub.scss',
  host: { class: 'bs' },
})
export class PrepHub {
  id = input.required<string>();
  /** True inside the exam tabs of a family: no back link or title, because the page around it already says which exam this is. */
  embedded = input(false);
  /** Where the back link goes. */
  back = input('/student/prepare');
  private api = inject(StudentService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = signal(true);
  d = signal<PrepHubData | null>(null);
  /** Live tests of this exam that have not finished yet; they get a tab of their own after the others. */
  live = signal<StudentExam[]>([]);
  private chosen = signal<number | null>(null);

  /** The tabs the admin set up for this exam, hidden ones left out. An answer without tab settings means the four standard tabs. */
  tabList = computed<{ key: string; label: string }[]>(() => {
    const set = this.d()?.tabs;
    const all = set?.length ? set : HUB_TABS.map((key) => ({ key, label: STANDARD_LABELS[key], visible: true }));
    return all.filter((t) => t.visible).map((t) => ({ key: t.key, label: t.label || STANDARD_LABELS[t.key as HubTab] || 'Tests' }));
  });

  /** The tabs as the tab strip shows them: each with its test count, and the live tests after them when there are some. */
  strip = computed<BsTab[]>(() => [
    ...this.tabList().map((t) => ({ key: t.key, label: `${t.label} (${this.count(t.key)})` })),
    ...(this.live().length ? [{ key: 'live', label: `Live tests (${this.live().length})`, dot: true }] : []),
  ]);

  /** The key of the open tab ('live' for the live tests tab). */
  openKey = computed(() => this.tabList()[this.tab()]?.key ?? 'live');

  /** How many tests a tab holds (the number in its title). */
  count(key: string) {
    const d = this.d();
    if (!d) return 0;
    const own: Record<string, number> = { full: d.full_tests.length, mini: d.mini_mocks.length, previous: d.previous_year.length, subject: this.subjectCount() };
    return own[key] ?? this.customTests(key).length;
  }

  /** The tests the admin put in one of the exam's own tabs. */
  customTests(key: string): StudentExam[] {
    return this.d()?.custom_tests?.[key] ?? [];
  }

  /** The tab shown: the one the student picked, else the one in the address, else the first one that has tests. */
  tab = computed(() => {
    const list = this.tabList();
    const picked = this.chosen();
    if (picked !== null && picked < list.length) return picked;
    const wanted = list.findIndex((t) => t.key === this.route.snapshot.queryParamMap.get('type'));
    if (wanted >= 0) return wanted;
    if (this.route.snapshot.queryParamMap.get('type') === 'live' && this.live().length) return list.length;
    if (!this.d()) return 0;
    const first = list.findIndex((t) => this.count(t.key) > 0);
    return first < 0 ? 0 : first;
  });

  subjectCount = computed(() => (this.d()?.subject_tests ?? []).reduce((n, g) => n + g.tests.length, 0));

  years = computed(() => {
    const out: { year: number | null; tests: StudentExam[] }[] = [];
    for (const t of this.d()?.previous_year ?? []) {
      let g = out.find((x) => x.year === t.year);
      if (!g) out.push((g = { year: t.year, tests: [] }));
      g.tests.push(t);
    }
    return out;
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  pick(i: number) {
    this.chosen.set(i);
    this.router.navigate([], { queryParams: { type: this.tabList()[i]?.key ?? 'live' }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private load(id: string) {
    this.loading.set(true);
    this.api.hub(id).subscribe({
      next: (d) => {
        this.api.exams({ live: 1, category: id }).subscribe({ next: (l) => this.live.set(l), error: () => this.live.set([]) });
        this.d.set(d);
        this.loading.set(false);
      },
      error: (e) => {
        this.notify.error(e.status === 404 ? 'This exam is not available.' : apiErrorMessage(e));
        this.router.navigateByUrl('/student/tests');
      },
    });
  }

  togglePreparing() {
    const d = this.d()!;
    this.api.prep().subscribe((r) => {
      const next = d.preparing ? r.preparing.filter((x) => x !== d.exam.id) : [...r.preparing, d.exam.id];
      this.api.setPrep(next).subscribe({
        next: () => {
          this.d.update((x) => (x ? { ...x, preparing: !d.preparing } : x));
          this.notify.success(d.preparing ? 'Removed from your preparation' : `You are now preparing for ${d.exam.name}`);
        },
        error: (e) => this.notify.error(apiErrorMessage(e)),
      });
    });
  }
}
