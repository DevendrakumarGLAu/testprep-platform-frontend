import { Component, inject, signal } from '@angular/core';
import { StudentService } from './student.service';
import { WeeklySummary } from './student.models';

/** "This week": the last seven days of practice compared with the seven before. */
@Component({
  selector: 'app-weekly-card',
  templateUrl: './weekly-card.html',
  styleUrl: './weekly-card.scss',
  host: { class: 'bs' },
})
export class WeeklyCard {
  private api = inject(StudentService);
  w = signal<WeeklySummary | null>(null);

  constructor() {
    this.api.weeklySummary().subscribe({ next: (s) => this.w.set(s), error: () => undefined });
  }

  /** "(5 more than last week)" or an empty string when there is nothing to compare with. */
  trend(now: number, before: number) {
    if (!before) return '';
    const diff = now - before;
    return diff === 0 ? '(same as last week)' : `(${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'} than last week)`;
  }
}
