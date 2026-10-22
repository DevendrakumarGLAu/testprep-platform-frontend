import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Question } from './qb.models';

@Component({
  selector: 'app-question-preview',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  styles: `
    .meta { color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-label-large); margin-bottom: 12px; }
    .q { white-space: pre-wrap; font: var(--mat-sys-body-large); margin-bottom: 12px; }
    img { max-width: 100%; max-height: 240px; display: block; margin-bottom: 12px; }
    ol { list-style: upper-alpha; padding-left: 28px; }
    li { padding: 6px 8px; border-radius: 8px; margin-bottom: 4px; }
    li.correct { background: var(--mat-sys-tertiary-container); }
    .expl { margin-top: 16px; padding: 12px; border-radius: 8px; background: var(--mat-sys-surface-container); white-space: pre-wrap; }
  `,
  template: `
    <h2 mat-dialog-title>Question preview</h2>
    <mat-dialog-content>
      <div class="meta">
        {{ q.subject_name }}{{ q.topic_name ? ' / ' + q.topic_name : '' }} · {{ q.difficulty }} ·
        +{{ q.marks }} / -{{ q.negative_marks }} · v{{ q.version }}
      </div>
      @if (q.image_url) { <img [src]="q.image_url" alt="Question image" /> }
      @if (q.text) { <div class="q">{{ q.text }}</div> }
      @if (q.text_hi) { <div class="q" lang="hi">{{ q.text_hi }}</div> }
      <ol>
        @for (o of q.options; track o.id) {
          <li [class.correct]="o.is_correct">{{ o.text }}{{ o.text && o.text_hi ? " / " : "" }}<span lang="hi">{{ o.text_hi }}</span> @if (o.is_correct) { <mat-icon inline>check_circle</mat-icon> }</li>
        }
      </ol>
      @if (q.explanation) { <div class="expl"><strong>Explanation</strong><br />{{ q.explanation }}</div> }
      @if (q.explanation_hi) { <div class="expl" lang="hi"><strong>व्याख्या</strong><br />{{ q.explanation_hi }}</div> }
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button mat-dialog-close>Close</button></mat-dialog-actions>
  `,
})
export class QuestionPreview {
  q = inject<Question>(MAT_DIALOG_DATA);
}
