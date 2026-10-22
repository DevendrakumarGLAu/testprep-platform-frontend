import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { ExamPreview } from './exam.models';
import { ExamService } from './exam.service';

/** Read-only walkthrough of a test exactly as students receive it: no correct answers or explanations. */
@Component({
  selector: 'app-exam-preview',
  imports: [DatePipe, RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  styles: `
    :host { display: block; max-width: 860px; }
    .banner { padding: 8px 16px; border-radius: 8px; background: var(--mat-sys-tertiary-container); margin-bottom: 16px; }
    .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin: 12px 0; }
    .fact span { color: var(--mat-sys-on-surface-variant); display: block; font-size: 0.85em; }
    .pre { white-space: pre-wrap; }
    mat-card { margin-bottom: 16px; }
    .q { padding: 12px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .q-head { display: flex; justify-content: space-between; gap: 12px; color: var(--mat-sys-on-surface-variant); font-size: 0.85em; }
    .q-text { white-space: pre-wrap; margin: 6px 0; }
    img { max-width: 100%; max-height: 220px; }
    ol { list-style: upper-alpha; padding-left: 28px; margin: 6px 0 0; }
    li { padding: 4px 0; }
  `,
  template: `
    <div class="banner"><mat-icon inline>visibility</mat-icon> Preview mode: answers cannot be submitted.
      <a mat-button [routerLink]="['/admin/tests', id()]">Back to editor</a></div>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    @if (p(); as t) {
      <h1>{{ t.title }}</h1>
      <mat-card appearance="outlined">
        <mat-card-content>
          <p>{{ t.description }}</p>
          <div class="facts">
            <div class="fact"><span>Duration</span>{{ t.duration_minutes }} minutes</div>
            <div class="fact"><span>Questions</span>{{ t.question_count }}</div>
            <div class="fact"><span>Total marks</span>{{ t.total_marks }}</div>
            <div class="fact"><span>Negative marking</span>{{ t.negative_marking_enabled ? 'Yes' : 'No' }}</div>
            <div class="fact"><span>Attempts allowed</span>{{ t.max_attempts || "Unlimited" }}</div>
            <div class="fact"><span>Available</span>
              @if (t.start_at || t.end_at) { {{ t.start_at ? (t.start_at | date: 'short') : 'Any time' }} → {{ t.end_at ? (t.end_at | date: 'short') : 'No end' }} } @else { Always }
            </div>
          </div>
          @if (t.instructions) { <h3>Instructions</h3><p class="pre">{{ t.instructions }}</p> }
        </mat-card-content>
      </mat-card>

      @for (s of t.sections; track s.id) {
        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>{{ s.name }}</mat-card-title></mat-card-header>
          <mat-card-content>
            @for (q of s.questions; track q.id; let i = $index) {
              <div class="q">
                <div class="q-head"><span>Question {{ i + 1 }}</span><span>+{{ q.marks }} / -{{ q.negative_marks }}</span></div>
                @if (q.image_url) { <img [src]="q.image_url" alt="Question image" /> }
                <div class="q-text">{{ q.text }}@if (q.text && q.text_hi) { <br /> } <span lang="hi">{{ q.text_hi }}</span></div>
                <ol>@for (o of q.options; track o.id) { <li>{{ o.text }}{{ o.text && o.text_hi ? " / " : "" }}<span lang="hi">{{ o.text_hi }}</span></li> }</ol>
              </div>
            } @empty {
              <p>No questions in this section.</p>
            }
          </mat-card-content>
        </mat-card>
      }
    }
  `,
})
export class ExamPreviewPage {
  id = input.required<string>();
  private api = inject(ExamService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  loading = signal(true);
  p = signal<ExamPreview | null>(null);

  constructor() {
    effect(() => {
      this.api.preview(+this.id()).subscribe({
        next: (p) => {
          this.p.set(p);
          this.loading.set(false);
        },
        error: (e) => {
          this.notify.error(apiErrorMessage(e));
          this.router.navigateByUrl('/admin/tests');
        },
      });
    });
  }
}
