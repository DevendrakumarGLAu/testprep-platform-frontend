import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
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
  imports: [RouterLink, MatTabsModule, MatButtonModule, MatIconModule, MatProgressBarModule, TestCard, LiveStrip],
  styles: `
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
    .muted { color: var(--mat-sys-on-surface-variant); }
    .chip { display: inline-block; padding: 1px 10px; margin: 0 4px 4px 0; border-radius: 12px; background: var(--mat-sys-surface-container-high); font-size: 0.85em; }
    .progress { max-width: 420px; margin: 12px 0; }
    .bar { height: 8px; border-radius: 4px; background: var(--mat-sys-surface-container-high); overflow: hidden; }
    .fill { height: 100%; background: var(--mat-sys-primary); }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin: 8px 0 20px; }
    .tab { padding-top: 16px; }
    h3 { margin: 16px 0 0; }
    h3 .count { font-weight: 400; font-size: 0.8em; }
    .empty { padding: 16px; color: var(--mat-sys-on-surface-variant); }
    .count { color: var(--mat-sys-on-surface-variant); margin-left: 4px; }
    .soon { margin-left: 6px; padding: 1px 8px; border-radius: 10px; font-size: 0.75em; background: var(--mat-sys-secondary-container); }
  `,
  template: `
    @if (!embedded()) { <a mat-button [routerLink]="back()"><mat-icon>arrow_back</mat-icon> All exams</a> }
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    @if (d(); as d) {
      <div class="head">
        <div>
          @if (!embedded()) {
            @if (d.exam.group) { <div class="muted family">{{ d.exam.group.name }} &rsaquo;</div> }
            <h1>{{ d.exam.name }}</h1>
          }
          @if (d.exam.description) { <p class="muted">{{ d.exam.description }}</p> }
          <div>@for (s of d.exam.subjects; track s.id) { <span class="chip">{{ s.name }}</span> }</div>
        </div>
        <button mat-stroked-button (click)="togglePreparing()" [attr.aria-pressed]="d.preparing">
          <mat-icon>{{ d.preparing ? 'check_circle' : 'add_circle_outline' }}</mat-icon>
          {{ d.preparing ? 'Preparing' : 'Prepare for this exam' }}
        </button>
      </div>
      <app-live-strip [category]="d.exam.id" />
      <div class="progress">
        <div class="bar"><div class="fill" [style.width.%]="d.progress.total ? (d.progress.attempted * 100) / d.progress.total : 0"></div></div>
        <span class="muted">{{ d.progress.attempted }} of {{ d.progress.total }} tests attempted</span>
      </div>

      <mat-tab-group animationDuration="0" [selectedIndex]="tab()" (selectedIndexChange)="pick($event)">
        @for (t of tabList(); track t.key) {
          <mat-tab [label]="t.label + ' (' + count(t.key) + ')'">
            <div class="tab">
              @switch (t.key) {
                @case ('full') {
                  @if (d.full_tests.length) {
                    <div class="cards">@for (x of d.full_tests; track x.id) { <app-test-card [exam]="x" /> }</div>
                  } @else { <p class="empty">No full tests yet.</p> }
                }
                @case ('mini') {
                  @if (d.mini_mocks.length) {
                    <div class="cards">@for (x of d.mini_mocks; track x.id) { <app-test-card [exam]="x" /> }</div>
                  } @else { <p class="empty">No mini mocks yet.</p> }
                }
                @case ('previous') {
                  @for (y of years(); track y.year) {
                    <h3>{{ y.year || 'Other' }}</h3>
                    <div class="cards">@for (x of y.tests; track x.id) { <app-test-card [exam]="x" /> }</div>
                  } @empty { <p class="empty">No previous year papers yet.</p> }
                }
                @case ('subject') {
                  <!-- Every section of the exam (Maths, Reasoning...) under its own heading. Sections without tests say so. -->
                  @for (g of d.subject_tests; track g.subject) {
                    <h3>
                      {{ g.subject_name }}
                      @if (g.tests.length) { <span class="count">({{ g.tests.length }})</span> } @else { <span class="soon">Upcoming</span> }
                    </h3>
                    @if (g.tests.length) {
                      <div class="cards">@for (x of g.tests; track x.id) { <app-test-card [exam]="x" /> }</div>
                    } @else {
                      <p class="empty">
                        <mat-icon inline>schedule</mat-icon>
                        {{ g.subject_name }} tests for {{ d.exam.name }} are coming soon.
                      </p>
                    }
                  } @empty { <p class="empty">No subject tests yet.</p> }
                }
                @default {
                  @if (customTests(t.key).length) {
                    <div class="cards">@for (x of customTests(t.key); track x.id) { <app-test-card [exam]="x" /> }</div>
                  } @else { <p class="empty">No tests in {{ t.label }} yet.</p> }
                }
              }
            </div>
          </mat-tab>
        }
      </mat-tab-group>
    }
  `,
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
  private chosen = signal<number | null>(null);

  /** The tabs the admin set up for this exam, hidden ones left out. An answer without tab settings means the four standard tabs. */
  tabList = computed<{ key: string; label: string }[]>(() => {
    const set = this.d()?.tabs;
    const all = set?.length ? set : HUB_TABS.map((key) => ({ key, label: STANDARD_LABELS[key], visible: true }));
    return all.filter((t) => t.visible).map((t) => ({ key: t.key, label: t.label || STANDARD_LABELS[t.key as HubTab] || 'Tests' }));
  });

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
    this.router.navigate([], { queryParams: { type: this.tabList()[i]?.key }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private load(id: string) {
    this.loading.set(true);
    this.api.hub(id).subscribe({
      next: (d) => {
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
