import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/models';
import { Sparkline } from '../sparkline/sparkline';
import { CoachService } from '../coach.service';
import { RanksData } from '../coach.models';

/** The student's rank and percentile in every test they finished, like the real exam's scorecard. */
@Component({
  selector: 'app-my-ranks',
  imports: [RouterLink, DatePipe, Sparkline],
  templateUrl: './my-ranks.html',
  styleUrl: './my-ranks.scss',
  host: { class: 'bs' },
})
export class MyRanks {
  private api = inject(CoachService);
  data = signal<RanksData | null>(null);
  loading = signal(true);
  error = signal('');

  /** Percentiles from the oldest test to the newest, for the little trend line. */
  trend = computed(() => [...(this.data()?.results ?? [])].reverse().map((r) => r.percentile));
  best = computed(() => (this.data()?.results ?? []).reduce<number | null>((b, r) => (b === null || r.percentile > b ? r.percentile : b), null));

  constructor() {
    this.api.ranks().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(e));
      },
    });
  }

  tone(percentile: number) {
    return percentile >= 80 ? 'bg-success' : percentile >= 50 ? '' : 'bg-warning';
  }
}
