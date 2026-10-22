import { SelectionModel } from '@angular/cdk/collections';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { ConfirmDialog } from '../../../shared/confirm-dialog';
import { BulkAction, Question, Subject, Topic } from './qb.models';
import { QuestionBankService } from './qb.service';
import { QuestionPreview } from './question-preview';

@Component({
  selector: 'app-question-list',
  imports: [
    ReactiveFormsModule, RouterLink, MatTableModule, MatPaginatorModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatProgressBarModule, MatCheckboxModule, MatMenuModule,
  ],
  styles: `
    .head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .filters { display: flex; gap: 12px; flex-wrap: wrap; }
    .filters mat-form-field { min-width: 170px; }
    .bulk { display: flex; align-items: center; gap: 8px; padding: 8px 12px; margin-bottom: 8px; border-radius: 8px;
            background: var(--mat-sys-secondary-container); flex-wrap: wrap; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; }
    td.text { max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .off { color: var(--mat-sys-on-surface-variant); font-style: italic; }
    .empty { padding: 24px; text-align: center; color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <div class="head">
      <h1>Question bank</h1>
      <span class="head-actions">
        <button mat-stroked-button routerLink="/admin/questions/import"><mat-icon>upload_file</mat-icon> Import questions</button>
        <button mat-flat-button routerLink="/admin/questions/new"><mat-icon>add</mat-icon> New question</button>
      </span>
    </div>

    <div class="filters">
      <mat-form-field appearance="outline">
        <mat-label>Search question text</mat-label>
        <input matInput [formControl]="search" />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Subject</mat-label>
        <mat-select [value]="subject()" (selectionChange)="subject.set($event.value); topic.set(null); pageIndex.set(0)">
          <mat-option [value]="null">All</mat-option>
          @for (s of subjects(); track s.id) { <mat-option [value]="s.id">{{ s.name }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Topic</mat-label>
        <mat-select [value]="topic()" (selectionChange)="topic.set($event.value); pageIndex.set(0)" [disabled]="!subject()">
          <mat-option [value]="null">All</mat-option>
          @for (t of topicOptions(); track t.id) { <mat-option [value]="t.id">{{ t.name }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Difficulty</mat-label>
        <mat-select [value]="difficulty()" (selectionChange)="difficulty.set($event.value); pageIndex.set(0)">
          <mat-option [value]="''">All</mat-option>
          <mat-option value="easy">Easy</mat-option>
          <mat-option value="medium">Medium</mat-option>
          <mat-option value="hard">Hard</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Status</mat-label>
        <mat-select [value]="status()" (selectionChange)="status.set($event.value); pageIndex.set(0)">
          <mat-option [value]="''">All</mat-option>
          <mat-option value="true">Active</mat-option>
          <mat-option value="false">Inactive</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Tag</mat-label>
        <mat-select [value]="tag()" (selectionChange)="tag.set($event.value); pageIndex.set(0)">
          <mat-option [value]="''">All</mat-option>
          @for (t of tags(); track t) { <mat-option [value]="t">{{ t }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Sort by</mat-label>
        <mat-select [value]="ordering()" (selectionChange)="ordering.set($event.value); pageIndex.set(0)">
          <mat-option value="-created_at">Newest first</mat-option>
          <mat-option value="created_at">Oldest first</mat-option>
          <mat-option value="-updated_at">Recently edited</mat-option>
          <mat-option value="difficulty">Difficulty</mat-option>
        </mat-select>
      </mat-form-field>
    </div>

    @if (selection.hasValue()) {
      <div class="bulk">
        <strong>{{ selection.selected.length }} selected</strong>
        <button mat-button (click)="bulk('activate')">Activate</button>
        <button mat-button (click)="bulk('deactivate')">Deactivate</button>
        <button mat-button [matMenuTriggerFor]="diffMenu">Set difficulty</button>
        <mat-menu #diffMenu="matMenu">
          <button mat-menu-item (click)="bulk('set_difficulty', 'easy')">Easy</button>
          <button mat-menu-item (click)="bulk('set_difficulty', 'medium')">Medium</button>
          <button mat-menu-item (click)="bulk('set_difficulty', 'hard')">Hard</button>
        </mat-menu>
        <button mat-button (click)="bulkTag()">Add tag…</button>
        <button mat-button (click)="selection.clear()">Clear</button>
      </div>
    }

    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    <div class="table-wrap">
      <table mat-table [dataSource]="rows()">
        <ng-container matColumnDef="select">
          <th mat-header-cell *matHeaderCellDef>
            <mat-checkbox (change)="$event.checked ? selectPage() : selection.clear()"
              [checked]="allSelected()" [indeterminate]="selection.hasValue() && !allSelected()" aria-label="Select all on page" />
          </th>
          <td mat-cell *matCellDef="let q">
            <mat-checkbox (click)="$event.stopPropagation()" (change)="selection.toggle(q.id)"
              [checked]="selection.isSelected(q.id)" aria-label="Select question" />
          </td>
        </ng-container>
        <ng-container matColumnDef="text">
          <th mat-header-cell *matHeaderCellDef>Question</th>
          <td mat-cell class="text" *matCellDef="let q" [title]="q.text || q.text_hi"><span [class.off]="!q.is_active">{{ q.text || q.text_hi }}</span></td>
        </ng-container>
        <ng-container matColumnDef="subject">
          <th mat-header-cell *matHeaderCellDef>Subject / topic</th>
          <td mat-cell *matCellDef="let q">{{ q.subject_name }}{{ q.topic_name ? ' / ' + q.topic_name : '' }}</td>
        </ng-container>
        <ng-container matColumnDef="difficulty">
          <th mat-header-cell *matHeaderCellDef>Difficulty</th>
          <td mat-cell *matCellDef="let q">{{ q.difficulty }}</td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let q">{{ q.is_active ? 'Active' : 'Inactive' }}</td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let q">
            <button mat-icon-button (click)="preview(q)" aria-label="Preview"><mat-icon>visibility</mat-icon></button>
            <button mat-icon-button [routerLink]="['/admin/questions', q.id]" aria-label="Edit"><mat-icon>edit</mat-icon></button>
            <button mat-icon-button (click)="duplicate(q)" aria-label="Duplicate"><mat-icon>content_copy</mat-icon></button>
            @if (q.is_active) {
              <button mat-icon-button (click)="archive(q)" aria-label="Archive"><mat-icon>archive</mat-icon></button>
            }
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
      @if (!loading() && rows().length === 0) { <div class="empty">No questions match your filters.</div> }
    </div>
    <mat-paginator [length]="total()" [pageIndex]="pageIndex()" [pageSize]="pageSize()"
      [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" showFirstLastButtons />
  `,
})
export class QuestionList {
  private api = inject(QuestionBankService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);
  private router = inject(Router);

  columns = ['select', 'text', 'subject', 'difficulty', 'status', 'actions'];
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

  constructor() {
    this.api.subjects().subscribe((p) => this.subjects.set(p.results));
    this.api.topics().subscribe((p) => this.topics.set(p.results));
    this.api.tags().subscribe((t) => this.tags.set(t));

    this.search.valueChanges.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.pageIndex.set(0));

    const query = computed(() => ({
      search: this.searchTerm(), subject: this.subject(), topic: this.topic(), difficulty: this.difficulty(),
      is_active: this.status(), tag: this.tag(), ordering: this.ordering(),
      page: this.pageIndex() + 1, page_size: this.pageSize(), r: this.reload(),
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

  onPage(e: PageEvent) {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
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
    this.api.bulk(ids, action, action === 'set_difficulty' ? { difficulty: value } : {}).subscribe({
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
