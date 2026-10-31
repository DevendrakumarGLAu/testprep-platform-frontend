import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { PrepExam, PrepFamily } from './student.models';
import { StudentService } from './student.service';
import { PrepHub } from './prep-hub';

/**
 * A family of exams, for example SSC: one tab per exam (SSC CGL, SSC CHSL, SSC MTS), and inside each exam the tabs
 * Full tests, Mini mocks, Previous year and Subject wise. The chosen exam is kept in the address (?exam=).
 */
@Component({
  selector: 'app-family-browser',
  imports: [RouterLink, MatTabsModule, MatButtonModule, MatIconModule, MatProgressBarModule, PrepHub],
  styles: `
    .muted { color: var(--mat-sys-on-surface-variant); }
    h1 { margin-bottom: 4px; }
    .empty { padding: 32px; text-align: center; color: var(--mat-sys-on-surface-variant); }
    .exam-tabs { margin-top: 12px; }
  `,
  template: `
    <a mat-button routerLink="/student/tests"><mat-icon>arrow_back</mat-icon> All exams</a>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    @if (family(); as f) {
      <h1>{{ f.name }}</h1>
      @if (f.description) { <p class="muted">{{ f.description }}</p> }
      @if (exams().length) {
        <mat-tab-group class="exam-tabs" animationDuration="0" [selectedIndex]="index()" (selectedIndexChange)="pick($event)">
          @for (e of exams(); track e.id) {
            <mat-tab [label]="e.name + ' (' + e.counts.total + ')'">
              <ng-template matTabContent><app-prep-hub [id]="e.id" [embedded]="true" /></ng-template>
            </mat-tab>
          }
        </mat-tab-group>
      } @else {
        <p class="empty">No tests in {{ f.name }} yet. Check back soon.</p>
      }
    }
  `,
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

/** One exam that is not in a family: straight to its four tabs. */
@Component({
  selector: 'app-exam-browser',
  imports: [PrepHub],
  template: `<app-prep-hub [id]="id()" back="/student/tests" />`,
})
export class ExamBrowser {
  id = input.required<string>();
}
