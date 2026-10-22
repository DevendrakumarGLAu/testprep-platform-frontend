import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { StudentExam } from './student.models';

const LABELS: Record<string, string> = {
  available: 'Available', upcoming: 'Upcoming', in_progress: 'In progress', completed: 'Completed', missed: 'Missed',
};

@Component({
  selector: 'app-test-card',
  imports: [DatePipe, RouterLink, MatCardModule, MatButtonModule, MatIconModule],
  styles: `
    :host { display: block; }
    mat-card { height: 100%; display: flex; flex-direction: column; }
    img { width: 100%; height: 120px; object-fit: cover; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .cat { color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-label-medium); }
    .chip { padding: 2px 10px; border-radius: 12px; font: var(--mat-sys-label-medium); background: var(--mat-sys-surface-container-high); white-space: nowrap; }
    .chip.available { background: var(--mat-sys-tertiary-container); }
    .chip.in_progress { background: var(--mat-sys-primary-container); }
    .chip.missed { background: var(--mat-sys-error-container); }
    .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; margin: 12px 0; font-size: 0.9em; }
    .facts span { color: var(--mat-sys-on-surface-variant); }
    .reason { color: var(--mat-sys-on-surface-variant); font-size: 0.85em; margin: 0; }
    mat-card-content { flex: 1; }
  `,
  template: `
    <mat-card appearance="outlined">
      @if (exam().thumbnail_url) { <img [src]="exam().thumbnail_url" alt="" /> }
      <mat-card-content>
        <div class="top">
          <div>
            <div class="cat">{{ exam().category_name ? exam().category_name + ' · ' : '' }}{{ typeLine() }}</div>
            <h3>{{ exam().title }}</h3>
          </div>
          <span [class]="'chip ' + exam().status">{{ label() }}</span>
        </div>
        <div class="facts">
          <div><span>Questions</span><br />{{ exam().question_count }}</div>
          <div><span>Total marks</span><br />{{ exam().total_marks }}</div>
          <div><span>Duration</span><br />{{ exam().duration_minutes }} min{{ exam().sectional_timing ? ' · timed sections' : '' }}</div>
          <div><span>Attempts</span><br />{{ exam().attempts_used }} / {{ exam().max_attempts || 'unlimited' }}</div>
          <div><span>Starts</span><br />{{ exam().start_at ? (exam().start_at | date: 'medium') : 'Anytime' }}</div>
          <div><span>Ends</span><br />{{ exam().end_at ? (exam().end_at | date: 'medium') : 'No end' }}</div>
        </div>
        @if (!exam().can_start && exam().reason) { <p class="reason">{{ exam().reason }}</p> }
      </mat-card-content>
      <mat-card-actions>
        @if (exam().status === 'in_progress') {
          <a mat-flat-button [routerLink]="['/student/tests', exam().id]"><mat-icon>play_arrow</mat-icon> Resume</a>
        } @else if (exam().can_start) {
          <a mat-flat-button [routerLink]="['/student/tests', exam().id]">{{ exam().attempts_used ? 'Attempt again' : 'Start' }}</a>
        } @else {
          <a mat-stroked-button [routerLink]="['/student/tests', exam().id]">Details</a>
        }
      </mat-card-actions>
    </mat-card>
  `,
})
export class TestCard {
  exam = input.required<StudentExam>();
  label = () => LABELS[this.exam().status] ?? this.exam().status;
  typeLine = () => {
    const e = this.exam();
    return e.test_type === 'sectional' && e.subject_name ? `${e.subject_name} only`
      : e.test_type === 'previous_year' && e.year ? `Previous year ${e.year}` : e.test_type_label;
  };
}
