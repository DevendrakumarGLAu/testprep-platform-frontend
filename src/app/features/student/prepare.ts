import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { PrepExam, PrepFamily } from './student.models';
import { StudentService } from './student.service';

/** Pick the exams you are preparing for. Choosing is optional; every exam can be opened and attempted. */
@Component({
  selector: 'app-prepare',
  imports: [RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  styles: `
    .intro { color: var(--mat-sys-on-surface-variant); max-width: 640px; }
    .family { margin: 28px 0 0; }
    .family-note { margin: 2px 0 0; color: var(--mat-sys-on-surface-variant); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-top: 16px; }
    mat-card { display: flex; flex-direction: column; }
    mat-card.on { border-color: var(--mat-sys-primary); border-width: 2px; }
    mat-card-content { flex: 1; }
    .chip { display: inline-block; padding: 1px 10px; margin: 0 4px 4px 0; border-radius: 12px; background: var(--mat-sys-surface-container-high); font-size: 0.85em; }
    .counts { color: var(--mat-sys-on-surface-variant); font-size: 0.9em; margin-top: 8px; }
    .empty { padding: 32px; text-align: center; color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <h1>My preparation</h1>
    <p class="intro">
      Choose the exam you are preparing for. You will see its full tests, subject-wise tests and previous year papers together,
      and you can attempt whichever you like.
    </p>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    @for (sec of sections(); track sec.key) {
      @if (sec.title) {
        <h2 class="family">{{ sec.title }}</h2>
        @if (sec.note) { <p class="family-note">{{ sec.note }}</p> }
      }
    <div class="grid">
      @for (e of sec.exams; track e.id) {
        <mat-card appearance="outlined" [class.on]="e.preparing">
          <mat-card-content>
            <h2>{{ e.name }}</h2>
            @if (e.description) { <p>{{ e.description }}</p> }
            <div>@for (s of e.subjects; track s) { <span class="chip">{{ s }}</span> }</div>
            <div class="counts">
              {{ e.counts.full_test }} full test{{ e.counts.full_test === 1 ? '' : 's' }} ·
              {{ e.counts.mini_mock ?? 0 }} mini mock{{ e.counts.mini_mock === 1 ? '' : 's' }} ·
              {{ e.counts.sectional }} subject test{{ e.counts.sectional === 1 ? '' : 's' }} ·
              {{ e.counts.previous_year }} previous year paper{{ e.counts.previous_year === 1 ? '' : 's' }}
            </div>
          </mat-card-content>
          <mat-card-actions>
            <a mat-flat-button [routerLink]="['/student/prepare', e.id]">Open tests</a>
            <button mat-button (click)="toggle(e)" [disabled]="saving()" [attr.aria-pressed]="e.preparing">
              <mat-icon>{{ e.preparing ? 'check_circle' : 'add_circle_outline' }}</mat-icon>
              {{ e.preparing ? 'Preparing' : 'Prepare for this' }}
            </button>
          </mat-card-actions>
        </mat-card>
      }
    </div>
    }
    @if (!loading() && exams().length === 0) { <div class="empty">No exams are available yet. Check back soon.</div> }
  `,
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
