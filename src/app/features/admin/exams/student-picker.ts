import { Component, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map, startWith, switchMap } from 'rxjs';
import { User } from '../../../core/models';
import { ExamService } from './exam.service';

/** Searchable multi-select of active students. Selected ids stay selected across searches. */
@Component({
  selector: 'app-student-picker',
  imports: [ReactiveFormsModule],
  templateUrl: './student-picker.html',
  styleUrl: './student-picker.scss',
  host: { class: 'bs' },
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
