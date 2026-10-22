import { Component, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { debounceTime, distinctUntilChanged, map, startWith, switchMap } from 'rxjs';
import { User } from '../../../core/models';
import { ExamService } from './exam.service';

/** Searchable multi-select of active students. Selected ids stay selected across searches. */
@Component({
  selector: 'app-student-picker',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatCheckboxModule, MatIconModule],
  styles: `
    .list { max-height: 260px; overflow-y: auto; border: 1px solid var(--mat-sys-outline-variant); border-radius: 8px; padding: 4px 8px; }
    .row { display: flex; align-items: center; gap: 4px; }
    .muted { color: var(--mat-sys-on-surface-variant); font-size: 0.85em; }
    .empty { padding: 12px; color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>Search students</mat-label>
      <input matInput [formControl]="search" placeholder="Name, username or email" />
      <mat-icon matSuffix>search</mat-icon>
    </mat-form-field>
    <p class="muted">{{ selected().length }} selected</p>
    <div class="list">
      @for (s of results(); track s.id) {
        <div class="row">
          <mat-checkbox [checked]="selected().includes(s.id)" (change)="toggle(s.id, $event.checked)">
            {{ (s.first_name + ' ' + s.last_name).trim() || s.username }}
            <span class="muted">{{ s.email }}</span>
          </mat-checkbox>
        </div>
      } @empty {
        <div class="empty">No students found.</div>
      }
    </div>
  `,
})
export class StudentPicker {
  private api = inject(ExamService);
  value = input<number[]>([]);
  changed = output<number[]>();

  search = new FormControl('', { nonNullable: true });
  selected = signal<number[]>([]);
  results = toSignal(
    this.search.valueChanges.pipe(
      startWith(''),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((q) => this.api.students(q)),
      map((p) => p.results),
    ),
    { initialValue: [] as User[] },
  );

  constructor() {
    effect(() => this.selected.set([...this.value()]));
  }

  toggle(id: number, on: boolean) {
    this.selected.update((l) => (on ? [...new Set([...l, id])] : l.filter((x) => x !== id)));
    this.changed.emit(this.selected());
  }
}
