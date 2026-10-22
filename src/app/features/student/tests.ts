import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { StudentExam } from './student.models';
import { StudentService } from './student.service';
import { TestCard } from './test-card';

@Component({
  selector: 'app-student-tests',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule, MatProgressBarModule, TestCard],
  styles: `
    .filters { display: flex; gap: 12px; flex-wrap: wrap; }
    .filters mat-form-field { min-width: 180px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-top: 8px; }
    .empty { padding: 32px; text-align: center; color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <h1>Tests</h1>
    <div class="filters">
      <mat-form-field appearance="outline">
        <mat-label>Search</mat-label>
        <input matInput [formControl]="search" />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Status</mat-label>
        <mat-select [value]="status()" (selectionChange)="status.set($event.value)">
          <mat-option value="">All</mat-option>
          <mat-option value="available">Available</mat-option>
          <mat-option value="upcoming">Upcoming</mat-option>
          <mat-option value="in_progress">In progress</mat-option>
          <mat-option value="completed">Completed</mat-option>
          <mat-option value="missed">Missed</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Type</mat-label>
        <mat-select [value]="testType()" (selectionChange)="testType.set($event.value)">
          <mat-option value="">All</mat-option>
          <mat-option value="full_test">Full tests</mat-option>
          <mat-option value="sectional">Subject tests</mat-option>
          <mat-option value="previous_year">Previous year papers</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Subject</mat-label>
        <mat-select [value]="subject()" (selectionChange)="subject.set($event.value)">
          <mat-option value="">All</mat-option>
          @for (s of subjects(); track s.id) { <mat-option [value]="s.id">{{ s.name }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Category</mat-label>
        <mat-select [value]="category()" (selectionChange)="category.set($event.value)">
          <mat-option value="">All</mat-option>
          @for (c of categories(); track c.id) { <mat-option [value]="c.id">{{ c.name }}</mat-option> }
        </mat-select>
      </mat-form-field>
    </div>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    <div class="cards">
      @for (e of exams(); track e.id) { <app-test-card [exam]="e" /> }
    </div>
    @if (!loading() && exams().length === 0) { <div class="empty">No tests match your filters.</div> }
  `,
})
export class StudentTests {
  private api = inject(StudentService);
  private notify = inject(NotifyService);

  search = new FormControl('', { nonNullable: true });
  private term = toSignal(this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged()), { initialValue: '' });
  status = signal('');
  category = signal('');
  subject = signal('');
  testType = signal('');
  subjects = signal<{ id: number; name: string }[]>([]);
  loading = signal(true);
  exams = signal<StudentExam[]>([]);
  categories = signal<{ id: string; name: string }[]>([]);

  constructor() {
    this.api.filters().subscribe((f) => {
      this.categories.set(f.categories);
      this.subjects.set(f.subjects);
    });
    const query = computed(() => ({ search: this.term(), status: this.status(), category: this.category(), subject: this.subject(), test_type: this.testType() }));
    toObservable(query)
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap((q) => this.api.exams(q)),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (e) => {
          this.exams.set(e);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.notify.error(apiErrorMessage(err));
        },
      });
  }
}
