import { Component, computed, inject, input, signal } from '@angular/core';
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
  imports: [RouterLink, DailyQuizCard],
  templateUrl: './practice.html',
  styleUrl: './practice.scss',
  host: { class: 'bs' },
})
export class Practice {
  private api = inject(StudentService);
  private router = inject(Router);
  private notify = inject(NotifyService);

  /** From the address (?subject=): the subject to practise, set by a study plan task. */
  subject = input<string>();
  /** Its name, also from the address, for a subject the student has not answered anything in yet. */
  name = input<string>();

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

  /** The subject a study plan task asked for, with its name. */
  focus = computed(() => {
    const id = this.subject();
    if (!id) return null;
    const known = this.data()?.all.find((t) => String(t.subject_id) === id)?.subject;
    return { id: Number(id), name: this.name() || known || 'this subject' };
  });

  /** A practice set from every topic of the focus subject. */
  startFocus() {
    const f = this.focus();
    if (!f) return;
    this.busy.set(true);
    this.api.practiceWeak([{ topic_id: null, subject_id: f.id, whole_subject: true }], this.count()).subscribe({
      next: (r) => this.router.navigate(['/student/attempt', r.attempt_id]),
      error: (e) => {
        this.busy.set(false);
        this.notify.error(apiErrorMessage(e));
      },
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
