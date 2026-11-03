import { UsageTags } from '../../../shared/usage-tags';
import { BulkValueDialog, BulkValueData, DuplicatesDialog } from './bulk-dialogs';
import { AGE_PRESETS, ageRange, ageLabel } from '../../../shared/question-age';
import { SelectionModel } from '@angular/cdk/collections';
import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { BsPager, PageChange } from '../../../shared/bs-pager/bs-pager';
import { ConfirmDialog } from '../../../shared/confirm-dialog';
import { BulkAction, Question, Subject, Topic } from './qb.models';
import { QuestionBankService } from './qb.service';
import { QuestionPreview } from './question-preview';

@Component({
  selector: 'app-question-list',
  imports: [ReactiveFormsModule, RouterLink, UsageTags, BsPager],
  templateUrl: './question-list.html',
  styleUrl: './question-list.scss',
  host: { class: 'bs' },
})
export class QuestionList {
  private api = inject(QuestionBankService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);
  private router = inject(Router);

  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** The "Set difficulty" menu of the bulk bar. */
  diffMenu = signal(false);
  review = signal('');
  readonly agePresets = AGE_PRESETS;
  age = signal('');
  ageOf = (d: string | null | undefined) => ageLabel(d ?? null);
  selection = new SelectionModel<number>(true, []);

  search = new FormControl('', { nonNullable: true });
  private searchTerm = toSignal(this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged()), { initialValue: '' });
  subject = signal<number | null>(null);
  topic = signal<number | null>(null);
  difficulty = signal('');
  status = signal('');
  tag = signal('');
  ordering = signal('-created_at');
  pageIndex = signal(0);
  pageSize = signal(20);
  reload = signal(0);

  loading = signal(true);
  total = signal(0);
  rows = signal<Question[]>([]);
  subjects = signal<Subject[]>([]);
  topics = signal<Topic[]>([]);
  tags = signal<string[]>([]);
  topicOptions = computed(() => this.topics().filter((t) => t.subject === this.subject()));
  allSelected = computed(() => this.rows().length > 0 && this.rows().every((r) => this.selection.isSelected(r.id)));

  /** What the list is filtered by (no paging or sort), also used to find every matching question. */
  private filters = computed(() => ({
    search: this.searchTerm(), subject: this.subject(), topic: this.topic(), difficulty: this.difficulty(),
    is_active: this.status(), tag: this.tag(), ...ageRange(this.age()), review_status: this.review(),
  }));

  constructor() {
    this.api.subjects().subscribe((p) => this.subjects.set(p.results));
    this.api.topics().subscribe((p) => this.topics.set(p.results));
    this.api.tags().subscribe((t) => this.tags.set(t));

    this.search.valueChanges.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.pageIndex.set(0));

    const query = computed(() => ({
      ...this.filters(), ordering: this.ordering(), page: this.pageIndex() + 1, page_size: this.pageSize(), r: this.reload(),
    }));
    toObservable(query)
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(({ r, ...q }) => this.api.questions(q)),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (p) => {
          this.rows.set(p.results);
          this.total.set(p.count);
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          this.notify.error(apiErrorMessage(e));
        },
      });
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent) {
    if (this.diffMenu() && !(event.target as Element).closest('.dropdown-wrap')) this.diffMenu.set(false);
  }

  pickSubject(value: string) {
    this.subject.set(value ? Number(value) : null);
    this.topic.set(null);
    this.pageIndex.set(0);
  }

  pickTopic(value: string) {
    this.topic.set(value ? Number(value) : null);
    this.pageIndex.set(0);
  }

  setDifficulty(value: string) {
    this.diffMenu.set(false);
    this.bulk('set_difficulty', value);
  }

  onPage(e: PageChange) {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  /** Selects every question that matches the filters, across all pages (up to 500). */
  selectAllMatching() {
    this.api.ids(this.filters()).subscribe({
      next: (r) => {
        r.ids.forEach((id) => this.selection.select(id));
        if (r.truncated) this.notify.success(`Selected the first ${r.ids.length} of ${r.count} matching questions (the most that can be changed at once).`);
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  bulkValue(kind: 'date' | 'subject') {
    this.dialog
      .open<BulkValueDialog, BulkValueData, string | number>(BulkValueDialog, { data: { kind, count: this.selection.selected.length, subjects: this.subjects().filter((s) => s.is_active) } })
      .afterClosed()
      .subscribe((value) => {
        if (value === undefined || value === null || value === '') return;
        const ids = this.selection.selected;
        const request = kind === 'date' ? this.api.bulk(ids, 'set_question_date', { question_date: String(value) }) : this.api.bulk(ids, 'set_subject', { subject: Number(value) });
        request.subscribe({ next: (r) => this.afterBulk(r.updated), error: (e) => this.notify.error(apiErrorMessage(e)) });
      });
  }

  findDuplicates() {
    this.dialog.open<DuplicatesDialog, void, boolean>(DuplicatesDialog, { maxWidth: '96vw' }).afterClosed().subscribe((changed) => {
      if (changed) this.reload.update((n) => n + 1);
    });
  }

  selectPage() {
    this.rows().forEach((r) => this.selection.select(r.id));
  }

  preview(q: Question) {
    this.dialog.open(QuestionPreview, { data: q, width: '640px', maxWidth: '95vw' });
  }

  duplicate(q: Question) {
    this.api.duplicateQuestion(q.id).subscribe({
      next: (copy) => {
        this.notify.success('Duplicate created as inactive. Review it and activate when ready.');
        this.router.navigate(['/admin/questions', copy.id]);
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  archive(q: Question) {
    this.dialog
      .open(ConfirmDialog, {
        data: { title: 'Archive question?', message: 'It becomes inactive and stays available for past attempts.', confirmLabel: 'Archive' },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.api.archiveQuestion(q.id).subscribe({
          next: () => {
            this.notify.success('Question archived');
            this.reload.update((n) => n + 1);
          },
          error: (e) => this.notify.error(apiErrorMessage(e)),
        });
      });
  }

  bulk(action: BulkAction, value?: string) {
    const ids = this.selection.selected;
    this.api.bulk(ids, action, action === 'set_difficulty' ? { difficulty: value } : action === 'set_review_status' ? { review_status: value } : {}).subscribe({
      next: (r) => this.afterBulk(r.updated),
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  bulkTag() {
    const raw = window.prompt('Tag(s) to add, comma separated');
    const tags = (raw ?? '').split(',').map((t) => t.trim()).filter(Boolean);
    if (!tags.length) return;
    this.api.bulk(this.selection.selected, 'add_tags', { tags }).subscribe({
      next: (r) => {
        this.api.tags().subscribe((t) => this.tags.set(t));
        this.afterBulk(r.updated);
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  private afterBulk(n: number) {
    this.notify.success(`${n} question${n === 1 ? '' : 's'} updated`);
    this.selection.clear();
    this.reload.update((x) => x + 1);
  }
}
