import { Component, computed, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { DailyQuizCard } from './daily-quiz-card';
import { ActivitySummary } from './student.models';

/** The top of the student dashboard: streak, daily goal with the last 7 days, today's quiz and a link to practice. */
@Component({
  selector: 'app-activity-cards',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule, DailyQuizCard],
  styles: `
    :host { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin: 16px 0; }
    mat-card { height: 100%; }
    .head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .head mat-icon { color: var(--mat-sys-primary); }
    .fire { color: #e65100 !important; }
    .big { font: var(--mat-sys-headline-medium); line-height: 1.1; }
    .muted { color: var(--mat-sys-on-surface-variant); margin: 4px 0 0; }
    .week { display: flex; align-items: flex-end; gap: 6px; height: 40px; margin-top: 12px; }
    .week i { flex: 1; min-height: 3px; border-radius: 3px; background: var(--mat-sys-primary); opacity: 0.85; }
    .week i.none { background: var(--mat-sys-outline-variant); }
    p.text { margin: 4px 0 12px; color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <mat-card appearance="outlined">
      <mat-card-content>
        <div class="head"><mat-icon class="fire">local_fire_department</mat-icon><strong>Streak</strong></div>
        <div class="big">{{ activity().streak }} {{ activity().streak === 1 ? 'day' : 'days' }}</div>
        <p class="muted">
          @if (activity().streak === 0) { Answer a question today to start a streak. } @else { Best streak: {{ activity().best_streak }} }
        </p>
      </mat-card-content>
    </mat-card>

    <mat-card appearance="outlined">
      <mat-card-content>
        <div class="head"><mat-icon>flag</mat-icon><strong>Daily goal</strong></div>
        <div class="big">{{ activity().today }} <span class="muted">/ {{ activity().goal }} questions</span></div>
        <mat-progress-bar mode="determinate" [value]="goalPercent()" aria-label="Progress towards today's goal" />
        <p class="muted">{{ activity().goal_reached ? 'Goal reached. Great work!' : activity().goal - activity().today + ' to go today' }}</p>
        <div class="week" aria-label="Questions answered in the last 7 days">
          @for (d of week(); track d.date) { <i [class.none]="!d.questions" [style.height.%]="d.height" [attr.title]="d.date + ': ' + d.questions"></i> }
        </div>
      </mat-card-content>
    </mat-card>

    <app-daily-quiz-card />

    <mat-card appearance="outlined">
      <mat-card-content>
        <div class="head"><mat-icon>fitness_center</mat-icon><strong>Practice</strong></div>
        <p class="text">Find the topics you get wrong most and practise them.</p>
        <a mat-stroked-button routerLink="/student/practice">Practise weak topics</a>
      </mat-card-content>
    </mat-card>
  `,
})
export class ActivityCards {
  activity = input.required<ActivitySummary>();

  goalPercent = computed(() => Math.min(100, Math.round((this.activity().today * 100) / (this.activity().goal || 1))));
  week = computed(() => {
    const days = this.activity().last_7_days;
    const max = Math.max(1, ...days.map((d) => d.questions));
    return days.map((d) => ({ ...d, height: Math.max(8, Math.round((d.questions * 100) / max)) }));
  });
}
