import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { DailyQuizCard } from './daily-quiz-card';
import { WeakTopic, WeakTopicsData } from './student.models';
import { StudentService } from './student.service';

const key = (t: WeakTopic) => `${t.subject_id}:${t.topic_id ?? ''}`;

/** Practice: today's quiz, and a short set built from the topics the student gets wrong most. */
@Component({
  selector: 'app-practice',
  imports: [
    RouterLink, MatButtonModule, MatCardModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatProgressBarModule,
    MatSelectModule, DailyQuizCard,
  ],
  styles: `
    :host { display: block; max-width: 900px; }
    .top { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin: 12px 0 20px; }
    .row { display: grid; grid-template-columns: auto 1fr 120px 56px; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .name small { display: block; color: var(--mat-sys-on-surface-variant); }
    .bar { height: 8px; border-radius: 4px; background: var(--mat-sys-surface-container-high); overflow: hidden; }
    .fill { height: 100%; background: var(--mat-sys-error); }
    .fill.ok { background: #2e7d32; }
    .actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
    .muted { color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <h1>Practice</h1>
    <div class="top"><app-daily-quiz-card /></div>

    <mat-card appearance="outlined">
      <mat-card-header><mat-card-title>Practise your weak topics</mat-card-title></mat-card-header>
      <mat-card-content>
        @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
        @if (data(); as d) {
          @if (!d.all.length) {
            <p class="muted">Take a test first. After a few answers in a topic we can show where you need practice.</p>
            <a mat-flat-button routerLink="/student/tests">Browse tests</a>
          } @else {
            <p class="muted">{{ d.rule }} Pick the topics to include; if you pick none, your 3 weakest are used.</p>
            @for (t of d.all; track rowKey(t)) {
              <div class="row">
                <mat-checkbox [checked]="chosen().has(rowKey(t))" (change)="toggle(t, $event.checked)" [attr.aria-label]="'Include ' + t.topic" />
                <div class="name">{{ t.topic }}<small>{{ t.subject }} · {{ t.correct }} of {{ t.answered }} right</small></div>
                <div class="bar"><div class="fill" [class.ok]="t.accuracy >= 60" [style.width.%]="t.accuracy"></div></div>
                <strong>{{ t.accuracy }}%</strong>
              </div>
            }
            <div class="actions">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Questions</mat-label>
                <mat-select [value]="count()" (selectionChange)="count.set($event.value)">
                  @for (n of sizes; track n) { <mat-option [value]="n">{{ n }}</mat-option> }
                </mat-select>
              </mat-form-field>
              <button mat-flat-button (click)="start()" [disabled]="busy()"><mat-icon>play_arrow</mat-icon> Start practice ({{ summary() }})</button>
            </div>
          }
        }
      </mat-card-content>
    </mat-card>
  `,
})
export class Practice {
  private api = inject(StudentService);
  private router = inject(Router);
  private notify = inject(NotifyService);

  readonly sizes = [10, 15, 25, 50];
  rowKey = key;
  loading = signal(true);
  busy = signal(false);
  data = signal<WeakTopicsData | null>(null);
  chosen = signal(new Set<string>());
  count = signal(15);
  summary = computed(() => (this.chosen().size ? `${this.chosen().size} topic${this.chosen().size === 1 ? '' : 's'}` : 'weakest 3'));

  constructor() {
    this.api.weakTopics().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  toggle(t: WeakTopic, on: boolean) {
    this.chosen.update((s) => {
      const next = new Set(s);
      on ? next.add(key(t)) : next.delete(key(t));
      return next;
    });
  }

  start() {
    const picked = (this.data()?.all ?? []).filter((t) => this.chosen().has(key(t)));
    this.busy.set(true);
    this.api.practiceWeak(picked.map((t) => ({ topic_id: t.topic_id, subject_id: t.subject_id })), this.count()).subscribe({
      next: (r) => this.router.navigate(['/student/attempt', r.attempt_id]),
      error: (e) => {
        this.busy.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }
}
