import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { BsPager, PageChange } from '../../../shared/bs-pager/bs-pager';
import { UsageTags } from '../../../shared/usage-tags';
import { AGE_PRESETS, ageLabel, ageRange, isOld } from '../../../shared/question-age';
import { MAX_QUESTIONS_PER_TEST, PickedQuestion, Question, Subject } from '../question-bank/qb.models';
import { QuestionBankService } from '../question-bank/qb.service';

export interface PickerData {
  excludeIds: number[];
  /** The test being edited, so the picker can say which questions are already in it. */
  examId?: number | null;
}

/** Pick active questions from the bank. Selection survives paging and filtering. */
@Component({
  selector: 'app-question-picker',
  imports: [ReactiveFormsModule, UsageTags, BsPager],
  templateUrl: './question-picker.html',
  styleUrl: './question-picker.scss',
  host: { class: 'bs' },
})
export class QuestionPicker {
  private api = inject(QuestionBankService);
  private qapi = this.api;
  protected data = inject<PickerData>(MAT_DIALOG_DATA);
  private ref = inject<MatDialogRef<QuestionPicker, PickedQuestion[]>>(MatDialogRef);

  search = new FormControl('', { nonNullable: true });
  private term = toSignal(this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged()), { initialValue: '' });
  subject = signal<number | null>(null);
  difficulty = signal('');
  age = signal('');
  usage = signal<'' | 'yes' | 'no'>('');
  showInTest = signal(false);
  inTest = (id: number) => this.data.excludeIds.includes(id);
  readonly agePresets = AGE_PRESETS;
  ageOf = ageLabel;
  old = (d: string | null | undefined) => isOld(d);
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
      search: this.term(), subject: this.subject(), difficulty: this.difficulty(), ...ageRange(this.age()),
      is_active: true, exclude_ids: this.showInTest() ? '' : this.data.excludeIds.join(','), ...this.usedParam(), page: this.pageIndex() + 1, page_size: this.pageSize(), ordering: '-question_date',
    }));
    toObservable(query)
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap((q) => this.api.questions(q)),
      )
      .subscribe({
        next: (p) => {
          this.rows.set(this.showInTest() ? p.results : p.results.filter((r) => !this.data.excludeIds.includes(r.id)));
          this.total.set(p.count);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  private usedParam(): { used?: boolean } {
    return this.usage() === '' ? {} : { used: this.usage() === 'yes' };
  }

  remaining = computed(() => Math.max(0, this.limit - this.data.excludeIds.length - this.selected().size));
  private pickable = computed(() => this.rows().filter((r) => !this.inTest(r.id)));
  pageAllSelected = computed(() => this.pickable().length > 0 && this.pickable().every((r) => this.selected().has(r.id)));
  pageSomeSelected = computed(() => !this.pageAllSelected() && this.pickable().some((r) => this.selected().has(r.id)));

  pickSubject(value: string) {
    this.subject.set(value ? Number(value) : null);
    this.pageIndex.set(0);
  }

  add() {
    this.ref.close(this.chosen());
  }

  cancel() {
    this.ref.close(undefined);
  }

  onPage(e: PageChange) {
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
    if (on) this.addAll(this.rows().filter((r) => !this.inTest(r.id)));
    else this.selected.update((m) => {
      const next = new Map(m);
      this.rows().forEach((r) => next.delete(r.id));
      return next;
    });
  }

  private pickFilters() {
    return {
      subject: this.subject(), difficulty: this.difficulty() || undefined, search: this.term() || undefined, ...ageRange(this.age()), ...this.usedParam(),
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
