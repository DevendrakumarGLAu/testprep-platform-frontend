import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Question } from './qb.models';

@Component({
  selector: 'app-question-preview',
  imports: [],
  templateUrl: './question-preview.html',
  styleUrl: './question-preview.scss',
  host: { class: 'bs' },
})
export class QuestionPreview {
  q = inject<Question>(MAT_DIALOG_DATA);
  private ref = inject<MatDialogRef<QuestionPreview>>(MatDialogRef);

  close() {
    this.ref.close();
  }
}
