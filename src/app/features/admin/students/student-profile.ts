import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { ChartComponent } from '../../../shared/chart';
import { formatDuration } from '../../student/student.models';
import { Batch, Exam } from '../exams/exam.models';
import { ExamService } from '../exams/exam.service';
import { saveBlob } from '../imports/import.service';
import { ReportsService, StudentProfileData } from './reports.service';
import { blobError } from './student-list';

@Component({
  selector: 'app-student-profile',
  imports: [DatePipe, RouterLink, ChartComponent],
  templateUrl: './student-profile.html',
  styleUrl: './student-profile.scss',
  host: { class: 'bs' },
})
export class StudentProfile {
  id = input.required<string>();
  private api = inject(ReportsService);
  private exams = inject(ExamService);
  private notify = inject(NotifyService);

  loading = signal(true);
  pdfBusy = signal(false);
  s = signal<StudentProfileData | null>(null);
  allBatches = signal<Batch[]>([]);
  allExams = signal<Exam[]>([]);
  batchIds = signal<number[]>([]);
  toAssign = signal<number[]>([]);
  notes = signal<string[]>([]);
  duration = formatDuration;

  assignable = computed(() => {
    const have = new Set(this.s()?.assigned_exams.map((e) => e.id));
    return this.allExams().filter((e) => !have.has(e.id) && e.status !== 'archived');
  });
  trendLabels = computed(() => (this.s()?.performance.trend ?? []).map((t) => t.title));
  trendSeries = computed(() => [{ label: 'Score %', data: (this.s()?.performance.trend ?? []).map((t) => t.percentage ?? 0) }]);
  subjectLabels = computed(() => (this.s()?.performance.subjects ?? []).map((x) => x.subject));
  subjectSeries = computed(() => [{ label: 'Accuracy %', data: (this.s()?.performance.subjects ?? []).map((x) => x.accuracy) }]);

  constructor() {
    this.exams.batches().subscribe((p) => this.allBatches.set(p.results));
    this.exams.list({ page_size: 100, ordering: 'title' }).subscribe((p) => this.allExams.set(p.results));
    effect(() => {
      this.id();
      untracked(() => this.load());
    });
  }

  toggleBatch(id: number, on: boolean) {
    this.batchIds.update((l) => (on ? [...l.filter((x) => x !== id), id] : l.filter((x) => x !== id)));
  }

  toggleAssign(id: number, on: boolean) {
    this.toAssign.update((l) => (on ? [...l.filter((x) => x !== id), id] : l.filter((x) => x !== id)));
  }

  val(v: number | null) {
    return v === null ? '—' : v + '%';
  }

  private load() {
    this.api.student(+this.id()).subscribe({
      next: (s) => {
        this.s.set(s);
        this.batchIds.set(s.batches.map((b) => b.id));
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  pdf() {
    this.pdfBusy.set(true);
    this.api.studentReportPdf(+this.id()).subscribe({
      next: (b) => {
        this.pdfBusy.set(false);
        saveBlob(b, `student-report-${this.s()!.username}.pdf`);
      },
      error: async (e) => {
        this.pdfBusy.set(false);
        this.notify.error(await blobError(e));
      },
    });
  }

  saveBatches() {
    this.api.setBatches(+this.id(), this.batchIds()).subscribe({
      next: (r) => {
        this.s.update((s) => (s ? { ...s, batches: r.batches } : s));
        this.notify.success('Batches saved');
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  assign() {
    this.api.assignTests(+this.id(), this.toAssign(), 'add').subscribe({
      next: (r) => {
        this.s.update((s) => (s ? { ...s, assigned_exams: r.assigned_exams } : s));
        this.notes.set(r.notes);
        this.toAssign.set([]);
        this.notify.success('Tests assigned');
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  unassign(examId: number) {
    this.api.assignTests(+this.id(), [examId], 'remove').subscribe({
      next: (r) => {
        this.s.update((s) => (s ? { ...s, assigned_exams: r.assigned_exams } : s));
        this.notes.set([]);
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }
}
