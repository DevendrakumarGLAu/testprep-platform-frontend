import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { PrepExam, PrepFamily } from './student.models';
import { StudentService } from './student.service';

/** Pick the exams you are preparing for. Choosing is optional; every exam can be opened and attempted. */
@Component({
  selector: 'app-prepare',
  imports: [RouterLink],
  templateUrl: './prepare.html',
  styleUrl: './prepare.scss',
  host: { class: 'bs' },
})
export class Prepare {
  private api = inject(StudentService);
  private notify = inject(NotifyService);

  loading = signal(true);
  saving = signal(false);
  exams = signal<PrepExam[]>([]);
  private families = signal<PrepFamily[]>([]);

  /** Exams grouped under their family (SSC > MTS, CHSL, CGL), families in the instructor's order, loose exams last. */
  sections = computed(() => {
    const exams = this.exams();
    const families = this.families();
    const out: { key: string; title: string; note: string; exams: PrepExam[] }[] = [];
    for (const f of families) {
      const list = exams.filter((e) => e.group?.id === f.id);
      if (list.length) out.push({ key: f.id, title: f.name, note: f.description, exams: list });
    }
    const loose = exams.filter((e) => !e.group || !families.some((f) => f.id === e.group!.id));
    if (loose.length) out.push({ key: 'other', title: out.length ? 'Other exams' : '', note: '', exams: loose });
    return out;
  });

  constructor() {
    this.api.prep().subscribe({
      next: (r) => {
        this.exams.set(r.exams);
        this.families.set(r.families ?? []);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  toggle(e: PrepExam) {
    const chosen = this.exams().filter((x) => x.preparing).map((x) => x.id);
    const next = e.preparing ? chosen.filter((id) => id !== e.id) : [...chosen, e.id];
    this.saving.set(true);
    this.api.setPrep(next).subscribe({
      next: (r) => {
        this.exams.set(r.exams);
        this.families.set(r.families ?? []);
        this.saving.set(false);
        this.notify.success(e.preparing ? `Removed ${e.name} from your preparation` : `You are now preparing for ${e.name}`);
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.error(apiErrorMessage(err));
      },
    });
  }
}
