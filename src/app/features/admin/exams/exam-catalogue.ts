import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { forkJoin } from 'rxjs';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { ConfirmDialog } from '../../../shared/confirm-dialog';
import { Subject } from '../question-bank/qb.models';
import { QuestionBankService } from '../question-bank/qb.service';
import { ExamCategory, ExamGroup, ExamPattern, ExamTab, STANDARD_TABS } from './exam.models';
import { ExamService } from './exam.service';

interface CatalogueDialogData {
  exam: ExamCategory | null;
  subjects: Subject[];
  groups: ExamGroup[];
}

/** "General Intelligence | 15" per line -> sections; the minutes after the bar are optional. */
function parseSections(text: string): { name: string; duration_minutes: number | null }[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, mins] = l.split('|').map((x) => x.trim());
      const n = mins ? Number(mins) : NaN;
      return { name, duration_minutes: Number.isFinite(n) && n >= 1 ? Math.floor(n) : null };
    });
}

function sectionsText(p: ExamPattern | undefined): string {
  return (p?.sections ?? []).map((s) => (s.duration_minutes ? `${s.name} | ${s.duration_minutes}` : s.name)).join('\n');
}

@Component({
  selector: 'app-catalogue-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './catalogue-dialog.html',
  styleUrl: './catalogue-dialog.scss',
  host: { class: 'bs' },
})
export class CatalogueDialog {
  data = inject<CatalogueDialogData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<CatalogueDialog, boolean>);
  private api = inject(ExamService);
  private fb = inject(FormBuilder);
  private notify = inject(NotifyService);
  saving = signal(false);
  error = signal('');
  groups = signal<ExamGroup[]>(this.data.groups);
  private p = this.data.exam?.pattern;
  tabs = signal<ExamTab[]>((this.data.exam?.tabs?.length ? this.data.exam.tabs : STANDARD_TABS).map((t) => ({ ...t })));

  hasSubject(id: number) {
    return this.form.controls.subjects.value.includes(id);
  }

  toggleSubject(id: number, on: boolean) {
    const now = this.form.controls.subjects.value.filter((x) => x !== id);
    this.form.controls.subjects.setValue(on ? [...now, id] : now);
    this.form.controls.subjects.markAsDirty();
  }

  cancel() {
    this.ref.close(false);
  }

  /** What a tab holds, shown as the label of its name box. */
  tabKind(t: ExamTab) {
    return t.custom ? 'Your tab' : ({ full: 'Full tests tab', mini: 'Mini mocks tab', previous: 'Previous year tab', subject: 'Subject wise tab' } as Record<string, string>)[t.key];
  }

  maxTabs = 12;
  hasCustomTabs = () => this.tabs().some((t) => t.custom);

  askForTab() {
    const name = window.prompt('Name of the new tab, for example Current affairs')?.trim();
    if (name) this.addTab(name);
  }

  /** A tab of your own gets a short random key, which is what tests are tied to, so renaming it later never loses its tests. */
  addTab(name: string) {
    const label = name.trim().slice(0, 30);
    if (!label) return;
    if (this.tabs().length >= this.maxTabs) return this.error.set('An exam can have at most ' + this.maxTabs + ' tabs.');
    const key = 'c' + Math.random().toString(36).slice(2, 8).padEnd(6, '0');
    this.tabs.update((l) => [...l, { key, label, visible: true, custom: true }]);
    this.error.set('');
  }

  removeTab(i: number) {
    this.tabs.update((l) => l.filter((_, j) => j !== i));
  }

  setTab(i: number, change: Partial<ExamTab>) {
    this.tabs.update((l) => l.map((t, j) => (j === i ? { ...t, ...change } : t)));
    this.error.set('');
  }

  moveTab(i: number, by: -1 | 1) {
    this.tabs.update((l) => {
      const out = [...l];
      [out[i], out[i + by]] = [out[i + by], out[i]];
      return out;
    });
  }

  form = this.fb.group({
    name: this.fb.nonNullable.control(this.data.exam?.name ?? '', Validators.required),
    description: this.fb.nonNullable.control(this.data.exam?.description ?? ''),
    subjects: this.fb.nonNullable.control(this.data.exam?.subjects ?? ([] as number[])),
    group: this.fb.control<number | null>(this.data.exam?.group ?? null),
    is_active: this.fb.nonNullable.control(this.data.exam?.is_active ?? true),
    p_duration: this.fb.control<number | null>(this.p?.duration_minutes ?? null),
    p_marks: this.fb.control<number | null>(this.p?.marks_per_question ?? null),
    p_passing: this.fb.control<number | null>(this.p?.passing_marks ?? null),
    p_attempts: this.fb.control<number | null>(this.p?.max_attempts ?? null),
    p_neg: this.fb.nonNullable.control<string>(this.p?.negative_option ?? ''),
    p_negvalue: this.fb.control<number | null>(this.p?.negative_value ?? null),
    p_sectional: this.fb.nonNullable.control(!!this.p?.sectional_timing),
    p_sections: this.fb.nonNullable.control(sectionsText(this.p)),
  });

  addGroup(ev: Event) {
    ev.stopPropagation();
    const name = window.prompt('Name of the new family, for example SSC')?.trim();
    if (!name) return;
    this.api.saveGroup({ name }).subscribe({
      next: (g) => {
        this.groups.update((l) => [...l, g]);
        this.form.controls.group.setValue(g.id);
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  /** Only the settings that were filled in are saved; an empty pattern means none. */
  private pattern(): ExamPattern {
    const v = this.form.getRawValue();
    const p: ExamPattern = {};
    const num = (x: number | null) => (x === null || (x as unknown) === '' ? null : Number(x));
    if (num(v.p_duration)) p.duration_minutes = num(v.p_duration)!;
    if (num(v.p_marks)) p.marks_per_question = num(v.p_marks)!;
    if (num(v.p_passing) !== null) p.passing_marks = num(v.p_passing)!;
    if (num(v.p_attempts) !== null) p.max_attempts = num(v.p_attempts)!;
    if (v.p_neg) {
      p.negative_option = v.p_neg as ExamPattern['negative_option'];
      if (v.p_neg === 'fraction' || v.p_neg === 'fixed') p.negative_value = num(v.p_negvalue) ?? 0;
    }
    if (v.p_sectional) p.sectional_timing = true;
    const sections = parseSections(v.p_sections);
    if (sections.length) p.sections = sections;
    return p;
  }

  save() {
    if (this.form.invalid) return this.form.markAllAsTouched();
    if (!this.tabs().some((t) => t.visible)) return this.error.set('Show at least one tab.');
    if (this.tabs().some((t) => t.custom && !t.label.trim())) return this.error.set('Give every new tab a name.');
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body = { name: v.name, description: v.description, subjects: v.subjects, group: v.group, is_active: v.is_active, pattern: this.pattern(), tabs: this.tabs().map((t) => ({ key: t.key, label: t.label.trim(), visible: t.visible })) };
    this.api.saveCategory(body, this.data.exam?.id).subscribe({
      next: () => this.ref.close(true),
      error: (e) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(e));
      },
    });
  }
}

@Component({
  selector: 'app-families-dialog',
  imports: [],
  templateUrl: './families-dialog.html',
  styleUrl: './families-dialog.scss',
  host: { class: 'bs' },
})
export class FamiliesDialog {
  private api = inject(ExamService);
  private notify = inject(NotifyService);
  private dialog = inject(MatDialog);
  private ref = inject<MatDialogRef<FamiliesDialog, boolean>>(MatDialogRef);
  loading = signal(true);
  busy = signal(false);
  groups = signal<ExamGroup[]>([]);
  /** True once anything was added, renamed, moved or deleted, so the page reloads when the dialog closes. */
  changed = false;

  constructor() {
    this.load();
  }

  private load() {
    this.api.groups().subscribe({
      next: (p) => {
        this.groups.set(p.results);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  done() {
    this.ref.close(this.changed);
  }

  private run(call: import('rxjs').Observable<unknown>) {
    this.busy.set(true);
    call.subscribe({
      next: () => {
        this.changed = true;
        this.busy.set(false);
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  add() {
    const name = window.prompt('Name of the new family, for example SSC')?.trim();
    if (name) this.run(this.api.saveGroup({ name, order: this.groups().length }));
  }

  rename(g: ExamGroup) {
    const name = window.prompt('Family name', g.name)?.trim();
    if (name && name !== g.name) this.run(this.api.saveGroup({ name }, g.id));
  }

  toggle(g: ExamGroup) {
    this.run(this.api.saveGroup({ is_active: !g.is_active }, g.id));
  }

  /** Swaps a family with its neighbour; students see families in this order. */
  move(i: number, by: number) {
    const list = [...this.groups()];
    const j = i + by;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const calls = list.map((g, n) => (g.order === n ? null : this.api.saveGroup({ order: n }, g.id))).filter((c) => c !== null);
    if (!calls.length) return;
    this.run(forkJoin(calls));
  }

  remove(g: ExamGroup) {
    this.dialog
      .open(ConfirmDialog, {
        data: { title: 'Delete family?', message: `Delete "${g.name}"? A family that still holds exams cannot be deleted; move them out or hide it instead.`, confirmLabel: 'Delete' },
      })
      .afterClosed()
      .subscribe((ok) => ok && this.run(this.api.deleteGroup(g.id)));
  }
}

@Component({
  selector: 'app-exam-catalogue',
  imports: [],
  templateUrl: './exam-catalogue.html',
  styleUrl: './exam-catalogue.scss',
  host: { class: 'bs' },
})
export class ExamCatalogue {
  private api = inject(ExamService);
  private qb = inject(QuestionBankService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

  loading = signal(true);
  rows = signal<ExamCategory[]>([]);
  subjects = signal<Subject[]>([]);
  groups = signal<ExamGroup[]>([]);

  constructor() {
    this.qb.subjects().subscribe((p) => this.subjects.set(p.results.filter((s) => s.is_active)));
    this.loadGroups();
    this.load();
  }

  private loadGroups() {
    this.api.groups().subscribe((p) => this.groups.set(p.results.filter((g) => g.is_active)));
  }

  manageFamilies() {
    this.dialog
      .open(FamiliesDialog)
      .afterClosed()
      .subscribe((changed) => {
        if (changed) {
          this.loadGroups();
          this.load();
        }
      });
  }

  load() {
    this.loading.set(true);
    this.api.categories().subscribe({
      next: (p) => {
        this.rows.set(p.results);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  edit(exam: ExamCategory | null) {
    this.dialog
      .open(CatalogueDialog, { data: { exam, subjects: this.subjects(), groups: this.groups() } satisfies CatalogueDialogData })
      .afterClosed()
      .subscribe((ok) => {
        if (ok) {
          this.notify.success('Exam saved');
          this.load();
        }
      });
  }

  remove(c: ExamCategory) {
    this.dialog
      .open(ConfirmDialog, {
        data: { title: 'Delete exam?', message: `Delete "${c.name}"? Exams that have tests cannot be deleted; hide them instead.`, confirmLabel: 'Delete' },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.api.deleteCategory(c.id).subscribe({
          next: () => {
            this.notify.success('Exam deleted');
            this.load();
          },
          error: (e) => this.notify.error(apiErrorMessage(e)),
        });
      });
  }
}
