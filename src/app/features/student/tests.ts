import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { BsTab, BsTabs } from '../../shared/bs-tabs/bs-tabs';
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
  imports: [RouterLink, ReactiveFormsModule, BsTabs, TestCard, LiveStrip],
  templateUrl: './tests.html',
  styleUrl: './tests.scss',
  host: { class: 'bs' },
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
  /** Live tests that have not finished yet; they get their own tab. */
  live = signal<StudentExam[]>([]);
  /** The open tab: 0 is the exams, 1 the live tests. */
  tab = signal(0);

  tabList = computed<BsTab[]>(() => [
    { key: 'exams', label: 'Exams' },
    { key: 'live', label: `Live tests (${this.live().length})`, dot: this.live().length > 0 },
  ]);

  /** Families in the instructor's order, each with its exams. */
  families = computed(() =>
    this.known()
      .map((family) => ({ family, exams: this.exams().filter((e) => e.group?.id === family.id) }))
      .filter((g) => g.exams.length),
  );

  /** Exams that are not part of any family. */
  single = computed(() => this.exams().filter((e) => !e.group || !this.known().some((f) => f.id === e.group!.id)));

  constructor() {
    this.api.exams({ live: 1 }).subscribe({ next: (l) => this.live.set(l), error: () => this.live.set([]) });
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
