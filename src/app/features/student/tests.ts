import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { PrepExam, PrepFamily, StudentExam } from './student.models';
import { StudentService } from './student.service';
import { LiveStrip } from './live-strip';
import { TestCard } from './test-card';

/**
 * Where a student starts: the families and exams they can take tests in. Opening one leads to its exams and then to the
 * tabs Full tests, Mini mocks, Previous year and Subject wise. Typing in the search box looks across every test instead.
 */
@Component({
  selector: 'app-student-tests',
  imports: [RouterLink, ReactiveFormsModule, MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, MatProgressBarModule, TestCard, LiveStrip],
  styles: `
    .intro { color: var(--mat-sys-on-surface-variant); max-width: 680px; margin: 0 0 12px; }
    .search { min-width: min(360px, 100%); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin: 8px 0 24px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-top: 8px; }
    mat-card { display: flex; flex-direction: column; }
    mat-card-content { flex: 1; }
    h2 { margin: 0 0 4px; }
    .desc { margin: 0 0 8px; color: var(--mat-sys-on-surface-variant); }
    .exam-link { display: flex; justify-content: space-between; gap: 8px; padding: 8px 12px; margin-top: 6px; border-radius: 10px; text-decoration: none; color: inherit; background: var(--mat-sys-surface-container-high); }
    .exam-link:hover { background: var(--mat-sys-secondary-container); }
    .exam-link span { color: var(--mat-sys-on-surface-variant); font-size: 0.9em; white-space: nowrap; }
    .counts { color: var(--mat-sys-on-surface-variant); font-size: 0.9em; }
    .empty { padding: 32px; text-align: center; color: var(--mat-sys-on-surface-variant); }
    h3.heading { margin: 20px 0 0; }
  `,
  template: `
    <h1>Tests</h1>
    <p class="intro">Choose your exam. You will find its full tests, mini mocks, previous year papers and subject-wise tests inside.</p>
    <mat-form-field appearance="outline" class="search">
      <mat-label>Search all tests</mat-label>
      <input matInput [formControl]="search" />
      <mat-icon matSuffix>search</mat-icon>
    </mat-form-field>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

    @if (term()) {
      <h3 class="heading">Search results</h3>
      <div class="cards">@for (e of results(); track e.id) { <app-test-card [exam]="e" /> }</div>
      @if (!loading() && results().length === 0) { <div class="empty">No tests match "{{ term() }}".</div> }
    } @else {
      <app-live-strip />
      <div class="grid">
        @for (g of families(); track g.family.id) {
          <mat-card appearance="outlined" class="family">
            <mat-card-content>
              <h2>{{ g.family.name }}</h2>
              @if (g.family.description) { <p class="desc">{{ g.family.description }}</p> }
              @for (e of g.exams; track e.id) {
                <a class="exam-link" [routerLink]="['/student/tests/family', g.family.id]" [queryParams]="{ exam: e.id }">
                  <strong>{{ e.name }}</strong><span>{{ e.counts.total }} test{{ e.counts.total === 1 ? '' : 's' }}</span>
                </a>
              }
            </mat-card-content>
            <mat-card-actions>
              <a mat-flat-button [routerLink]="['/student/tests/family', g.family.id]">Open {{ g.family.name }}</a>
            </mat-card-actions>
          </mat-card>
        }
        @for (e of single(); track e.id) {
          <mat-card appearance="outlined" class="single">
            <mat-card-content>
              <h2>{{ e.name }}</h2>
              @if (e.description) { <p class="desc">{{ e.description }}</p> }
              <div class="counts">{{ e.counts.total }} test{{ e.counts.total === 1 ? '' : 's' }}</div>
            </mat-card-content>
            <mat-card-actions>
              <a mat-flat-button [routerLink]="['/student/tests/exam', e.id]">Open tests</a>
            </mat-card-actions>
          </mat-card>
        }
      </div>
      @if (!loading() && families().length === 0 && single().length === 0) {
        <div class="empty">No tests are available yet. Check back soon.</div>
      }
    }
  `,
})
export class StudentTests {
  private api = inject(StudentService);
  private notify = inject(NotifyService);

  search = new FormControl('', { nonNullable: true });
  term = toSignal(this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged()), { initialValue: '' });
  loading = signal(true);
  private exams = signal<PrepExam[]>([]);
  private known = signal<PrepFamily[]>([]);
  results = signal<StudentExam[]>([]);

  /** Families in the instructor's order, each with its exams. */
  families = computed(() =>
    this.known()
      .map((family) => ({ family, exams: this.exams().filter((e) => e.group?.id === family.id) }))
      .filter((g) => g.exams.length),
  );

  /** Exams that are not part of any family. */
  single = computed(() => this.exams().filter((e) => !e.group || !this.known().some((f) => f.id === e.group!.id)));

  constructor() {
    this.api.prep().subscribe({
      next: (r) => {
        this.exams.set(r.exams);
        this.known.set(r.families ?? []);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
    toObservable(this.term)
      .pipe(
        tap((t) => t && this.loading.set(true)),
        switchMap((t) => (t ? this.api.exams({ search: t }) : of(null))),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (list) => {
          if (list) this.results.set(list);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.notify.error(apiErrorMessage(err));
        },
      });
  }
}
