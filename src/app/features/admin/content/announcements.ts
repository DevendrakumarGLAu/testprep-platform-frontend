import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { environment } from '../../../../environments/environment';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { ConfirmDialog } from '../../../shared/confirm-dialog';
import { Batch, ExamCategory } from '../exams/exam.models';
import { ExamService } from '../exams/exam.service';

/** Send a message to students' notification bell: everyone, the students preparing for one exam, or one batch. */
@Component({
  selector: 'app-announcements',
  imports: [ReactiveFormsModule],
  templateUrl: './announcements.html',
  styleUrl: './announcements.scss',
  host: { class: 'bs' },
})
export class Announcements {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);
  private examApi = inject(ExamService);

  categories = signal<ExamCategory[]>([]);
  batches = signal<Batch[]>([]);
  sending = signal(false);
  error = signal('');

  form = this.fb.nonNullable.group({
    title: [''],
    body: [''],
    audience: ['all' as 'all' | 'exam' | 'batch'],
    target: this.fb.control<number | null>(null),
    link: [''],
  });

  constructor() {
    this.examApi.categories().subscribe((p) => this.categories.set(p.results.filter((c) => c.is_active)));
    this.examApi.batches({ page_size: 100 }).subscribe((p) => this.batches.set(p.results.filter((b) => b.is_active)));
    this.form.controls.audience.valueChanges.subscribe(() => this.form.controls.target.setValue(null));
  }

  send() {
    const v = this.form.getRawValue();
    if (!v.title.trim()) return this.error.set('Give the announcement a title.');
    if (v.audience !== 'all' && v.target === null) return this.error.set(v.audience === 'exam' ? 'Choose the exam.' : 'Choose the batch.');
    this.error.set('');
    const who = v.audience === 'all' ? 'every student' : v.audience === 'exam' ? 'the students preparing for this exam' : 'this batch';
    this.dialog
      .open(ConfirmDialog, { data: { title: 'Send this announcement?', message: `"${v.title.trim()}" goes to ${who}. It cannot be taken back.`, confirmLabel: 'Send' } })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.sending.set(true);
        this.http.post<{ sent: number }>(`${environment.apiUrl}/announcements/`, { ...v, title: v.title.trim(), body: v.body.trim(), link: v.link.trim() }).subscribe({
          next: (r) => {
            this.sending.set(false);
            this.notify.success(`Sent to ${r.sent} student${r.sent === 1 ? '' : 's'}.`);
            this.form.reset({ title: '', body: '', audience: 'all', target: null, link: '' });
          },
          error: (e) => {
            this.sending.set(false);
            this.error.set(apiErrorMessage(e));
          },
        });
      });
  }
}
