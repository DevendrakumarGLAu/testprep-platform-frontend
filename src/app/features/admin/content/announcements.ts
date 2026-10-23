import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { environment } from '../../../../environments/environment';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { ConfirmDialog } from '../../../shared/confirm-dialog';
import { Batch, ExamCategory } from '../exams/exam.models';
import { ExamService } from '../exams/exam.service';

/** Send a message to students' notification bell: everyone, the students preparing for one exam, or one batch. */
@Component({
  selector: 'app-announcements',
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  styles: `
    :host { display: block; max-width: 640px; }
    form { display: flex; flex-direction: column; gap: 4px; }
    .muted { color: var(--mat-sys-on-surface-variant); }
    .err { color: var(--mat-sys-error); margin: 0; }
  `,
  template: `
    <h1>Announcements</h1>
    <p class="muted">The message appears under the bell icon for each student. Students are not emailed.</p>
    <mat-card appearance="outlined"><mat-card-content>
      <form [formGroup]="form" (ngSubmit)="send()" novalidate>
        <mat-form-field appearance="outline">
          <mat-label>Title</mat-label>
          <input matInput formControlName="title" maxlength="200" />
          <mat-error>Required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Message (optional)</mat-label>
          <textarea matInput rows="4" formControlName="body" maxlength="1000"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Send to</mat-label>
          <mat-select formControlName="audience">
            <mat-option value="all">All students</mat-option>
            <mat-option value="exam">Students preparing for an exam</mat-option>
            <mat-option value="batch">A batch</mat-option>
          </mat-select>
        </mat-form-field>
        @if (form.value.audience === 'exam') {
          <mat-form-field appearance="outline">
            <mat-label>Exam</mat-label>
            <mat-select formControlName="target">
              @for (c of categories(); track c.id) { <mat-option [value]="c.id">{{ c.name }}</mat-option> }
            </mat-select>
          </mat-form-field>
        }
        @if (form.value.audience === 'batch') {
          <mat-form-field appearance="outline">
            <mat-label>Batch</mat-label>
            <mat-select formControlName="target">
              @for (b of batches(); track b.id) { <mat-option [value]="b.id">{{ b.name }}</mat-option> }
            </mat-select>
          </mat-form-field>
        }
        <mat-form-field appearance="outline">
          <mat-label>Link (optional)</mat-label>
          <input matInput formControlName="link" placeholder="/student/tests" />
          <mat-hint>A page of this app that opens when the student clicks the message.</mat-hint>
        </mat-form-field>
        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
        <div><button mat-flat-button type="submit" [disabled]="sending()"><mat-icon>send</mat-icon> Send</button></div>
      </form>
    </mat-card-content></mat-card>
  `,
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
