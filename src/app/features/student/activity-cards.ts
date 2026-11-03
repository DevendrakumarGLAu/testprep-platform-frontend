import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DailyQuizCard } from './daily-quiz-card';
import { ActivitySummary } from './student.models';

/** The "Today" row of the student dashboard: daily goal with the last 7 days, today's quiz and a link to practice. The streak is in the page header. */
@Component({
  selector: 'app-activity-cards',
  imports: [RouterLink, DailyQuizCard],
  templateUrl: './activity-cards.html',
  styleUrl: './activity-cards.scss',
  host: { class: 'bs' },
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
