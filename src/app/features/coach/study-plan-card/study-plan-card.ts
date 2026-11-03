import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CoachService } from '../coach.service';
import { PlanData } from '../coach.models';

/** On the student's dashboard: today's tasks from the study plan, or an invitation to make one. */
@Component({
  selector: 'app-study-plan-card',
  imports: [RouterLink],
  templateUrl: './study-plan-card.html',
  styleUrl: './study-plan-card.scss',
  host: { class: 'bs' },
})
export class StudyPlanCard {
  private api = inject(CoachService);
  data = signal<PlanData | null>(null);
  loaded = signal(false);

  plan = computed(() => this.data()?.plan ?? null);
  today = computed(() => this.data()?.today ?? []);
  left = computed(() => this.today().filter((t) => !t.done));
  /** The first few things still to do today. */
  next = computed(() => this.left().slice(0, 3));

  constructor() {
    this.api.plan().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true), // an older server has no study plan: show nothing rather than an error
    });
  }
}
