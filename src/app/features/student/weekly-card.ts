import { Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { StudentService } from './student.service';
import { WeeklySummary } from './student.models';

/** "This week": the last seven days of practice compared with the seven before. */
@Component({
  selector: 'app-weekly-card',
  imports: [MatCardModule, MatIconModule],
  styles: `
    mat-card { margin: 0 0 16px; }
    .head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .head mat-icon { color: var(--mat-sys-primary); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
    .big { font: var(--mat-sys-headline-small); line-height: 1.1; }
    .label { color: var(--mat-sys-on-surface-variant); font-size: 0.85rem; }
    .up { color: #1b5e20; }
    .down { color: var(--mat-sys-error); }
    .note { margin: 12px 0 0; color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    @if (w(); as s) {
      <mat-card appearance="outlined">
        <mat-card-content>
          <div class="head"><mat-icon>insights</mat-icon><strong>This week</strong></div>
          @if (!s.questions && !s.tests) {
            <p class="note">Nothing yet in the last 7 days. Answer a few questions to see your week here.</p>
          } @else {
            <div class="grid">
              <div><div class="big">{{ s.questions }}</div><div class="label">questions answered {{ trend(s.questions, s.questions_before) }}</div></div>
              <div><div class="big">{{ s.tests }}</div><div class="label">tests taken · {{ s.active_days }} active {{ s.active_days === 1 ? 'day' : 'days' }}</div></div>
              @if (s.accuracy !== null) {
                <div>
                  <div class="big">{{ s.accuracy }}%</div>
                  <div class="label">accuracy
                    @if (s.accuracy_change) { <span [class.up]="s.accuracy_change > 0" [class.down]="s.accuracy_change < 0">({{ s.accuracy_change > 0 ? '+' : '' }}{{ s.accuracy_change }} points)</span> }
                  </div>
                </div>
              }
            </div>
            @if (s.best_subject) {
              <p class="note">Strongest: <strong>{{ s.best_subject.name }}</strong> ({{ s.best_subject.accuracy }}%)@if (s.weakest_subject) { · Needs work: <strong>{{ s.weakest_subject.name }}</strong> ({{ s.weakest_subject.accuracy }}%) }</p>
            }
          }
        </mat-card-content>
      </mat-card>
    }
  `,
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
