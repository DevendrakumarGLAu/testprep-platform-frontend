import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { StudentService } from '../../student/student.service';
import { BsModal } from '../bs-modal/bs-modal';
import { CoachService } from '../coach.service';
import { PlanData, PlanSubject, PlanTask, TaskKind } from '../coach.models';

const ICON: Record<TaskKind, string> = {
  test: 'bi-pencil-square',
  revise: 'bi-arrow-repeat',
  practice: 'bi-bullseye',
  listen: 'bi-headphones',
  exam_day: 'bi-flag-fill',
};

/** The student's study plan: pick an exam date, get a list of tests and revision for each day, tick them off as you go. */
@Component({
  selector: 'app-study-plan',
  imports: [FormsModule, RouterLink, DatePipe, NgTemplateOutlet, BsModal],
  templateUrl: './study-plan.html',
  styleUrl: './study-plan.scss',
  host: { class: 'bs' },
})
export class StudyPlanPage {
  private api = inject(CoachService);
  private student = inject(StudentService);
  private notify = inject(NotifyService);

  data = signal<PlanData | null>(null);
  loading = signal(true);
  busy = signal(false);
  editing = signal(false);
  confirmDelete = signal(false);
  categories = signal<{ id: string | number; name: string }[]>([]);
  error = signal('');

  readonly minutesChoices = [30, 45, 60, 90, 120, 180];
  readonly minDate = this.isoDate(1);
  readonly maxDate = this.isoDate(180);

  form = { target_name: '', category: '' as string | number, exam_date: '', daily_minutes: 60 };

  plan = computed(() => this.data()?.plan ?? null);
  showForm = computed(() => this.editing() || (!this.loading() && !this.plan()));
  /** Today's minutes of work, to compare with the minutes the student said they have. */
  todayMinutes = computed(() => (this.data()?.today ?? []).reduce((sum, t) => sum + t.minutes, 0));

  constructor() {
    this.load();
    this.student.filters().subscribe({ next: (f) => this.categories.set(f.categories), error: () => this.categories.set([]) });
  }

  private isoDate(daysFromNow: number): string {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  load() {
    this.loading.set(true);
    this.api.plan().subscribe({
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

  edit() {
    const p = this.plan();
    if (p) this.form = { target_name: p.target_name, category: p.category ?? '', exam_date: p.exam_date, daily_minutes: p.daily_minutes };
    this.error.set('');
    this.editing.set(true);
  }

  cancelEdit() {
    this.editing.set(false);
    this.error.set('');
  }

  pickCategory() {
    const c = this.categories().find((x) => String(x.id) === String(this.form.category));
    if (c && !this.form.target_name.trim()) this.form.target_name = c.name;
  }

  save() {
    this.error.set('');
    if (!this.form.exam_date) {
      this.error.set('Choose the date of your exam.');
      return;
    }
    this.busy.set(true);
    this.api.createPlan({ ...this.form, category: this.form.category === '' ? null : this.form.category }).subscribe({
      next: (d) => {
        this.data.set(d);
        this.busy.set(false);
        this.editing.set(false);
        this.notify.success('Your study plan is ready.');
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(e));
      },
    });
  }

  remove() {
    this.confirmDelete.set(false);
    this.api.deletePlan().subscribe({
      next: () => {
        this.data.set({ plan: null, subjects: [], today: [], overdue: [], upcoming: [] });
        this.form = { target_name: '', category: '', exam_date: '', daily_minutes: 60 };
        this.notify.success('Your plan was deleted.');
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  toggle(task: PlanTask) {
    this.api.markTask(task.id, !task.done).subscribe({
      next: (d) => this.data.set(d),
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  catchUp() {
    this.busy.set(true);
    this.api.reschedule().subscribe({
      next: (r) => {
        this.data.set(r);
        this.busy.set(false);
        this.notify.success(r.moved ? `Moved ${r.moved} missed test${r.moved === 1 ? '' : 's'} to the coming days.` : 'Caught up.');
      },
      error: (e) => {
        this.busy.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  /** Plan the coming days again with the latest results. */
  refresh() {
    this.busy.set(true);
    this.api.refreshPlan().subscribe({
      next: (r) => {
        this.data.set(r);
        this.busy.set(false);
        this.notify.success('Your coming days were planned again with your latest results.');
      },
      error: (e) => {
        this.busy.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  /** The bar colour of a subject: red when weak, green when strong, neutral when there is nothing to judge yet. */
  tone(s: PlanSubject) {
    return s.accuracy === null ? 'tone-none' : s.weak ? 'tone-weak' : s.accuracy >= 75 ? 'tone-strong' : 'tone-ok';
  }

  icon(kind: TaskKind) {
    return ICON[kind];
  }
}
