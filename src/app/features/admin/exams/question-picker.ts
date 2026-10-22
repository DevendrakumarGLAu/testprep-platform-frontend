import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { MAX_QUESTIONS_PER_TEST, PickedQuestion, Question, Subject } from '../question-bank/qb.models';
import { QuestionBankService } from '../question-bank/qb.service';

export interface PickerData {
  excludeIds: number[];
}

/** Pick active questions from the bank. Selection survives paging and filtering. */
@Component({
  selector: 'app-question-picker',
  imports: [
    ReactiveFormsModule, MatDialogModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatPaginatorModule, MatProgressBarModule, MatIconModule,
  ],
  styles: `
    .filters { display: flex; gap: 12px; flex-wrap: wrap; }
    .bulk { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 12px 0 4px; }
    .bulk .spacer { flex: 1; }
    .rand { width: 110px; }
    .count { color: var(--mat-sys-on-surface-variant); margin: 0 0 8px; font-size: 0.9em; }
    .filters mat-form-field { flex: 1; min-width: 160px; }
    mat-dialog-content { min-width: min(760px, 88vw); }
    .item { display: flex; align-items: flex-start; gap: 4px; padding: 4px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .meta { color: var(--mat-sys-on-surface-variant); font-size: 0.85em; }
    .empty { padding: 24px; text-align: center; color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <h2 mat-dialog-title>Add questions from the bank</h2>
    <mat-dialog-content>
      <div class="filters">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Search</mat-label>
          <input matInput [formControl]="search" />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Subject</mat-label>
          <mat-select [value]="subject()" (selectionChange)="subject.set($event.value); pageIndex.set(0)">
            <mat-option [value]="null">All</mat-option>
            @for (s of subjects(); track s.id) { <mat-option [value]="s.id">{{ s.name }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Difficulty</mat-label>
          <mat-select [value]="difficulty()" (selectionChange)="difficulty.set($event.value); pageIndex.set(0)">
            <mat-option value="">All</mat-option>
            <mat-option value="easy">Easy</mat-option>
            <mat-option value="medium">Medium</mat-option>
            <mat-option value="hard">Hard</mat-option>
          </mat-select>
        </mat-form-field>
      </div>
      <div class="bulk">
        <mat-checkbox [checked]="pageAllSelected()" [indeterminate]="pageSomeSelected()" (change)="togglePage($event.checked)" [disabled]="rows().length === 0">
          Select this page
        </mat-checkbox>
        <button mat-button (click)="selectAllMatching()" [disabled]="busy() || total() === 0">Select all {{ total() }} matching</button>
        <span class="spacer"></span>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="rand">
          <mat-label>Random</mat-label>
          <input matInput type="number" min="1" [max]="limit" [formControl]="randomCount" />
        </mat-form-field>
        <button mat-stroked-button (click)="addRandom()" [disabled]="busy()"><mat-icon>shuffle</mat-icon> Add random</button>
      </div>
      <p class="count">{{ selected().size }} selected · {{ remaining() }} more allowed in this test (limit {{ limit }})</p>
      @if (loading() || busy()) { <mat-progress-bar mode="indeterminate" /> }
      @for (q of rows(); track q.id) {
        <div class="item">
          <mat-checkbox [checked]="selected().has(q.id)" (change)="toggle(q, $event.checked)" [attr.aria-label]="'Select question ' + q.id" />
          <div>
            <div>{{ q.text || q.text_hi }}</div>
            <div class="meta">{{ q.subject_name }}{{ q.topic_name ? ' / ' + q.topic_name : '' }} · {{ q.difficulty }}</div>
          </div>
        </div>
      } @empty {
        @if (!loading()) { <div class="empty">No available questions match.</div> }
      }
      <mat-paginator [length]="total()" [pageIndex]="pageIndex()" [pageSize]="pageSize()" [pageSizeOptions]="[10, 25, 50, 100]" (page)="onPage($event)" />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button [mat-dialog-close]="chosen()" [disabled]="selected().size === 0">Add {{ selected().size || '' }} selected</button>
    </mat-dialog-actions>
  `,
})
export class QuestionPicker {
  private api = inject(QuestionBankService);
  private qapi = this.api;
  private data = inject<PickerData>(MAT_DIALOG_DATA);

  search = new FormControl('', { nonNullable: true });
  private term = toSignal(this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged()), { initialValue: '' });
  subject = signal<number | null>(null);
  difficulty = signal('');
  pageIndex = signal(0);
  pageSize = signal(10);
  busy = signal(false);
  randomCount = new FormControl(25, { nonNullable: true });
  readonly limit = MAX_QUESTIONS_PER_TEST;
  loading = signal(true);
  total = signal(0);
  rows = signal<Question[]>([]);
  subjects = signal<Subject[]>([]);
  selected = signal(new Map<number, PickedQuestion>());
  private notify = inject(NotifyService);
  chosen = computed(() => [...this.selected().values()]);

  constructor() {
    this.api.subjects().subscribe((p) => this.subjects.set(p.results));
    this.search.valueChanges.pipe(debounceTime(300)).subscribe(() => this.pageIndex.set(0));
    const query = computed(() => ({
      search: this.term(), subject: this.subject(), difficulty: this.difficulty(),
      is_active: true, page: this.pageIndex() + 1, page_size: this.pageSize(), ordering: '-created_at',
    }));
    toObservable(query)
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap((q) => this.api.questions(q)),
      )
      .subscribe({
        next: (p) => {
          this.rows.set(p.results.filter((r) => !this.data.excludeIds.includes(r.id)));
          this.total.set(p.count);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  remaining = computed(() => Math.max(0, this.limit - this.data.excludeIds.length - this.selected().size));
  pageAllSelected = computed(() => this.rows().length > 0 && this.rows().every((r) => this.selected().has(r.id)));
  pageSomeSelected = computed(() => !this.pageAllSelected() && this.rows().some((r) => this.selected().has(r.id)));

  onPage(e: PageEvent) {
    this.pageSize.set(e.pageSize);
    this.pageIndex.set(e.pageIndex);
  }

  /** Adds picked questions to the selection without going past the test's question limit. */
  private addAll(picked: PickedQuestion[]) {
    const room = this.remaining();
    const fresh = picked.filter((q) => !this.selected().has(q.id));
    if (fresh.length > room) this.notify.error(`A test can have ${this.limit} questions at most, so only ${room} were added.`);
    this.selected.update((m) => {
      const next = new Map(m);
      fresh.slice(0, Math.max(0, room)).forEach((q) => next.set(q.id, q));
      return next;
    });
  }

  togglePage(on: boolean) {
    if (on) this.addAll(this.rows());
    else this.selected.update((m) => {
      const next = new Map(m);
      this.rows().forEach((r) => next.delete(r.id));
      return next;
    });
  }

  private pickFilters() {
    return {
      subject: this.subject(), difficulty: this.difficulty() || undefined, search: this.term() || undefined,
      exclude_ids: [...this.data.excludeIds, ...this.selected().keys()],
    };
  }

  private fetch(count: number, mode: 'random' | 'newest') {
    if (count < 1 || this.remaining() < 1) {
      this.notify.error(this.remaining() < 1 ? `This test already has the maximum of ${this.limit} questions.` : 'Enter how many questions to add.');
      return;
    }
    this.busy.set(true);
    this.qapi.pick({ count: Math.min(count, this.remaining()), mode, ...this.pickFilters() }).subscribe({
      next: (r) => {
        this.busy.set(false);
        if (!r.questions.length) this.notify.error('No more questions match these filters.');
        else if (mode === 'random' && r.questions.length < count) this.notify.success(`Only ${r.questions.length} matching questions were left, and all were added.`);
        this.addAll(r.questions);
      },
      error: (e) => {
        this.busy.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  /** Every question that matches the current filters, newest first, up to the limit. */
  selectAllMatching() {
    this.fetch(this.total(), 'newest');
  }

  addRandom() {
    this.fetch(Math.floor(Number(this.randomCount.value)) || 0, 'random');
  }

  toggle(q: Question, on: boolean) {
    this.selected.update((m) => {
      const next = new Map(m);
      on ? next.set(q.id, q) : next.delete(q.id);
      return next;
    });
  }
}
