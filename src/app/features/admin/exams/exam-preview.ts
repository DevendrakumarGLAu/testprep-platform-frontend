import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { ExamPreview } from './exam.models';
import { ExamService } from './exam.service';

/** Read-only walkthrough of a test exactly as students receive it: no correct answers or explanations. */
@Component({
  selector: 'app-exam-preview',
  imports: [DatePipe, RouterLink],
  templateUrl: './exam-preview.html',
  styleUrl: './exam-preview.scss',
  host: { class: 'bs' },
})
export class ExamPreviewPage {
  id = input.required<string>();
  private api = inject(ExamService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  loading = signal(true);
  p = signal<ExamPreview | null>(null);

  /** Prints the paper as it appears here (questions and options, no answers). The browser can save it as a PDF. */
  print() {
    window.print();
  }

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
