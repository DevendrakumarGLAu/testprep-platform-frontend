import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { PrepHubData, StudentExam } from './student.models';
import { StudentService } from './student.service';
import { TestCard } from './test-card';

/** One exam, for example SSC, with everything a student can attempt: full tests, subject tests, previous year papers. */
@Component({
  selector: 'app-prep-hub',
  imports: [RouterLink, MatTabsModule, MatButtonModule, MatIconModule, MatProgressBarModule, TestCard],
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
    .empty { padding: 16px; color: var(--mat-sys-on-surface-variant); }
    .count { color: var(--mat-sys-on-surface-variant); margin-left: 4px; }
    .soon { margin-left: 6px; padding: 1px 8px; border-radius: 10px; font-size: 0.75em; background: var(--mat-sys-secondary-container); }
  `,
  template: `
    <a mat-button routerLink="/student/prepare"><mat-icon>arrow_back</mat-icon> All exams</a>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    @if (d(); as d) {
      <div class="head">
        <div>
          <h1>{{ d.exam.name }}</h1>
          @if (d.exam.description) { <p class="muted">{{ d.exam.description }}</p> }
          <div>@for (s of d.exam.subjects; track s.id) { <span class="chip">{{ s.name }}</span> }</div>
        </div>
        <button mat-stroked-button (click)="togglePreparing()" [attr.aria-pressed]="d.preparing">
          <mat-icon>{{ d.preparing ? 'check_circle' : 'add_circle_outline' }}</mat-icon>
          {{ d.preparing ? 'Preparing' : 'Prepare for this exam' }}
        </button>
      </div>
      <div class="progress">
        <div class="bar"><div class="fill" [style.width.%]="d.progress.total ? (d.progress.attempted * 100) / d.progress.total : 0"></div></div>
        <span class="muted">{{ d.progress.attempted }} of {{ d.progress.total }} tests attempted</span>
      </div>

      <mat-tab-group animationDuration="0" [(selectedIndex)]="tab">
        <mat-tab [label]="'Full tests (' + d.full_tests.length + ')'">
          <div class="tab">
            @if (d.full_tests.length) {
              <div class="cards">@for (t of d.full_tests; track t.id) { <app-test-card [exam]="t" /> }</div>
            } @else { <p class="empty">No full tests yet.</p> }
          </div>
        </mat-tab>

        <!-- One tab per section of the exam. Sections that have no tests yet say so instead of disappearing. -->
        @for (g of d.subject_tests; track g.subject) {
          <mat-tab>
            <ng-template mat-tab-label>
              {{ g.subject_name }}
              @if (g.tests.length) { <span class="count">({{ g.tests.length }})</span> } @else { <span class="soon">Upcoming</span> }
            </ng-template>
            <div class="tab">
              @if (g.tests.length) {
                <div class="cards">@for (t of g.tests; track t.id) { <app-test-card [exam]="t" /> }</div>
              } @else {
                <p class="empty">
                  <mat-icon inline>schedule</mat-icon>
                  {{ g.subject_name }} tests for {{ d.exam.name }} are coming soon.
                </p>
              }
            </div>
          </mat-tab>
        }

        <mat-tab [label]="'Previous year papers (' + d.previous_year.length + ')'">
          <div class="tab">
            @for (y of years(); track y.year) {
              <h3>{{ y.year || 'Other' }}</h3>
              <div class="cards">@for (t of y.tests; track t.id) { <app-test-card [exam]="t" /> }</div>
            } @empty { <p class="empty">No previous year papers yet.</p> }
          </div>
        </mat-tab>
      </mat-tab-group>
    }
  `,
})
export class PrepHub {
  id = input.required<string>();
  private api = inject(StudentService);
  private notify = inject(NotifyService);
  private router = inject(Router);

  loading = signal(true);
  d = signal<PrepHubData | null>(null);
  tab = 0;

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

  private load(id: string) {
    this.loading.set(true);
    this.api.hub(id).subscribe({
      next: (d) => {
        this.d.set(d);
        this.loading.set(false);
      },
      error: (e) => {
        this.notify.error(e.status === 404 ? 'This exam is not available.' : apiErrorMessage(e));
        this.router.navigateByUrl('/student/prepare');
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
