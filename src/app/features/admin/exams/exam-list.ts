import { DatePipe } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { BsPager, PageChange } from '../../../shared/bs-pager/bs-pager';
import { ConfirmDialog } from '../../../shared/confirm-dialog';
import { Exam, TEST_TYPE_LABELS } from './exam.models';
import { ExamService } from './exam.service';

@Component({
  selector: 'app-exam-list',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, BsPager],
  templateUrl: './exam-list.html',
  styleUrl: './exam-list.scss',
  host: { class: 'bs' },
})
export class ExamList {
  private api = inject(ExamService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

  /** The link to give students for a live test. */
  copyLiveLink(e: Exam) {
    const link = `${window.location.origin}/student/live/${e.public_id}`;
    const fail = () => this.notify.error(`Could not copy. The link is ${link}`);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(() => this.notify.success('Live link copied'), fail);
    else fail();
  }
  private router = inject(Router);

  /** The test whose row menu is open. */
  menuFor = signal<number | null>(null);
  search = new FormControl('', { nonNullable: true });
  private term = toSignal(this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged()), { initialValue: '' });
  status = signal('');
  pageIndex = signal(0);
  pageSize = signal(20);
  reload = signal(0);
  loading = signal(true);
  total = signal(0);
  rows = signal<Exam[]>([]);

  constructor() {
    this.search.valueChanges.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.pageIndex.set(0));
    const query = computed(() => ({
      search: this.term(), status: this.status(), page: this.pageIndex() + 1, page_size: this.pageSize(), r: this.reload(),
    }));
    toObservable(query)
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(({ r, ...q }) => this.api.list(q)),
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

  typeLabel(e: Exam) {
    const base = TEST_TYPE_LABELS[e.test_type];
    return e.test_type === 'sectional' && e.subject_name ? `${base}: ${e.subject_name}` : e.test_type === 'previous_year' && e.year ? `${base} ${e.year}` : base;
  }

  toggleMenu(id: number) {
    this.menuFor.update((open) => (open === id ? null : id));
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent) {
    if (this.menuFor() !== null && !(event.target as Element).closest('.menu-wrap')) this.menuFor.set(null);
  }

  @HostListener('document:keydown.escape')
  protected onEscape() {
    this.menuFor.set(null);
  }

  onPage(e: PageChange) {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  private refresh() {
    this.reload.update((n) => n + 1);
  }

  duplicate(e: Exam) {
    this.api.action(e.id, 'duplicate').subscribe({
      next: (copy) => {
        this.notify.success('Copy created as a draft');
        this.router.navigate(['/admin/tests', copy.id]);
      },
      error: (err) => this.notify.error(apiErrorMessage(err)),
    });
  }

  publish(e: Exam) {
    this.api.action(e.id, 'publish').subscribe({
      next: () => {
        this.notify.success('Test published');
        this.refresh();
      },
      error: (err) => {
        const problems: string[] = err.error?.errors ?? [];
        this.notify.error(problems.length ? `Cannot publish: ${problems.join(' ')}` : apiErrorMessage(err));
      },
    });
  }

  run(e: Exam, name: 'unpublish' | 'archive' | 'restore', title: string, message: string) {
    this.dialog.open(ConfirmDialog, { data: { title, message, confirmLabel: title.split(' ')[0] } }).afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.api.action(e.id, name).subscribe({
        next: () => {
          this.notify.success('Done');
          this.refresh();
        },
        error: (err) => this.notify.error(apiErrorMessage(err)),
      });
    });
  }

  remove(e: Exam) {
    this.dialog
      .open(ConfirmDialog, { data: { title: 'Delete draft?', message: `Permanently delete "${e.title}"?`, confirmLabel: 'Delete' } })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.api.remove(e.id).subscribe({
          next: () => {
            this.notify.success('Draft deleted');
            this.refresh();
          },
          error: (err) => this.notify.error(apiErrorMessage(err)),
        });
      });
  }
}
