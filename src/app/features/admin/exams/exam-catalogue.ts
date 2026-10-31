import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
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
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, MatButtonModule, MatIconModule],
  styles: `form { display: flex; flex-direction: column; min-width: min(520px, 84vw); padding-top: 8px; } .err { color: var(--mat-sys-error); margin: 0; } .two { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; } h3 { margin: 20px 0 2px; } .note { margin: 0 0 12px; color: var(--mat-sys-on-surface-variant); font-size: 0.9em; } .tab-row { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; } .tab-row mat-form-field { flex: 1; min-width: 0; } .tab-row.off mat-form-field { opacity: 0.55; }`,
  template: `
    <h2 mat-dialog-title>{{ data.exam ? 'Edit exam' : 'New exam' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="cat-form" (ngSubmit)="save()" novalidate>
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" placeholder="SSC, Banking, Railways…" />
          <mat-error>Required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput rows="3" formControlName="description"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Family (for example SSC)</mat-label>
          <mat-select formControlName="group">
            <mat-option [value]="null">None</mat-option>
            @for (g of groups(); track g.id) { <mat-option [value]="g.id">{{ g.name }}</mat-option> }
          </mat-select>
          <button mat-icon-button matSuffix type="button" (click)="addGroup($event)" aria-label="New family"><mat-icon>add</mat-icon></button>
          <mat-hint>Students pick the family first, then the exam: SSC &rsaquo; MTS, CHSL, CGL</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Sections (subjects)</mat-label>
          <mat-select multiple formControlName="subjects">
            @for (s of data.subjects; track s.id) { <mat-option [value]="s.id">{{ s.name }}</mat-option> }
          </mat-select>
          <mat-hint>For SSC: Maths, GK, Reasoning, English. Students see one subject-test group per section.</mat-hint>
        </mat-form-field>
        <h3>Tabs students see inside this exam</h3>
        <p class="note">Choose which tabs show, rename them and change their order. The four standard tabs hold one type of test each. Add your own tab (for example Current affairs) and then pick it on a test to put that test there.</p>
        @for (t of tabs(); track t.key; let i = $index) {
          <div class="tab-row" [class.off]="!t.visible">
            <mat-slide-toggle [checked]="t.visible" (change)="setTab(i, { visible: $event.checked })" [attr.aria-label]="'Show ' + t.label"></mat-slide-toggle>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ tabKind(t) }}</mat-label>
              <input matInput maxlength="30" [value]="t.label" (input)="setTab(i, { label: $any($event.target).value })" />
            </mat-form-field>
            <button mat-icon-button type="button" (click)="moveTab(i, -1)" [disabled]="i === 0" aria-label="Move tab up"><mat-icon>arrow_upward</mat-icon></button>
            <button mat-icon-button type="button" (click)="moveTab(i, 1)" [disabled]="i === tabs().length - 1" aria-label="Move tab down"><mat-icon>arrow_downward</mat-icon></button>
            @if (t.custom) { <button mat-icon-button type="button" (click)="removeTab(i)" aria-label="Delete this tab"><mat-icon>delete</mat-icon></button> }
          </div>
        }
        <div>
          <button mat-stroked-button type="button" (click)="askForTab()" [disabled]="tabs().length >= maxTabs"><mat-icon>add</mat-icon> Add a tab</button>
          @if (hasCustomTabs()) { <p class="note">Deleting a tab of your own is safe: its tests go back to the tab of their type.</p> }
        </div>
        <h3>Usual pattern of this exam</h3>
        <p class="note">New tests under this exam start with these settings, and you can still change them. Leave a box empty to skip it.</p>
        <div class="two">
          <mat-form-field appearance="outline"><mat-label>Time (minutes)</mat-label><input matInput type="number" min="1" max="600" formControlName="p_duration" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Marks per question</mat-label><input matInput type="number" min="0" step="0.25" formControlName="p_marks" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Passing marks</mat-label><input matInput type="number" min="0" formControlName="p_passing" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Attempts allowed</mat-label><input matInput type="number" min="0" max="50" formControlName="p_attempts" /><mat-hint>0 = unlimited</mat-hint></mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Negative marking</mat-label>
            <mat-select formControlName="p_neg">
              <mat-option value="">Do not set</mat-option>
              <mat-option value="off">None</mat-option>
              <mat-option value="fraction">A fraction of the marks (1/4 = 0.25)</mat-option>
              <mat-option value="fixed">Fixed marks per wrong answer</mat-option>
            </mat-select>
          </mat-form-field>
          @if (form.controls.p_neg.value === 'fraction' || form.controls.p_neg.value === 'fixed') {
            <mat-form-field appearance="outline"><mat-label>Deduction</mat-label><input matInput type="number" min="0" step="0.05" formControlName="p_negvalue" /></mat-form-field>
          }
        </div>
        <mat-slide-toggle formControlName="p_sectional">Time each section separately</mat-slide-toggle>
        <mat-form-field appearance="outline" style="margin-top: 12px">
          <mat-label>Sections of a full test</mat-label>
          <textarea matInput rows="5" formControlName="p_sections" placeholder="General Intelligence | 15&#10;General Awareness | 15&#10;Quantitative Aptitude | 15&#10;English | 15"></textarea>
          <mat-hint>One section per line. Add the minutes after a bar when each section has its own time.</mat-hint>
        </mat-form-field>
        <mat-slide-toggle formControlName="is_active" style="margin-top: 16px">Visible to students</mat-slide-toggle>
        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button type="submit" form="cat-form" [disabled]="saving()">Save</button>
    </mat-dialog-actions>
  `,
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
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  styles: `
    .note { margin: 0 0 12px; color: var(--mat-sys-on-surface-variant); max-width: 460px; }
    .row { display: flex; align-items: center; gap: 4px; padding: 6px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .row .name { flex: 1; min-width: 0; }
    .muted { color: var(--mat-sys-on-surface-variant); font-size: 0.9em; }
    .off { opacity: 0.55; }
    .empty { padding: 12px 0; color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <h2 mat-dialog-title>Exam families</h2>
    <mat-dialog-content>
      <p class="note">
        A family groups related exams. SSC can hold SSC MTS, SSC CHSL and SSC CGL. Students pick the family first, then the exam.
        Put an exam in a family from the exam's own settings.
      </p>
      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
      @for (g of groups(); track g.id; let i = $index) {
        <div class="row" [class.off]="!g.is_active">
          <div class="name"><strong>{{ g.name }}</strong> <span class="muted">· {{ g.exam_count }} exam{{ g.exam_count === 1 ? '' : 's' }}{{ g.is_active ? '' : ' · hidden' }}</span></div>
          <button mat-icon-button (click)="move(i, -1)" [disabled]="i === 0 || busy()" aria-label="Move up"><mat-icon>arrow_upward</mat-icon></button>
          <button mat-icon-button (click)="move(i, 1)" [disabled]="i === groups().length - 1 || busy()" aria-label="Move down"><mat-icon>arrow_downward</mat-icon></button>
          <button mat-icon-button (click)="toggle(g)" [disabled]="busy()" [attr.aria-label]="g.is_active ? 'Hide from students' : 'Show to students'"><mat-icon>{{ g.is_active ? 'visibility' : 'visibility_off' }}</mat-icon></button>
          <button mat-icon-button (click)="rename(g)" [disabled]="busy()" aria-label="Rename family"><mat-icon>edit</mat-icon></button>
          <button mat-icon-button (click)="remove(g)" [disabled]="busy()" aria-label="Delete family"><mat-icon>delete</mat-icon></button>
        </div>
      } @empty {
        @if (!loading()) { <div class="empty">No families yet. Add one, for example SSC.</div> }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="add()" [disabled]="busy()"><mat-icon>add</mat-icon> New family</button>
      <button mat-flat-button [mat-dialog-close]="changed">Done</button>
    </mat-dialog-actions>
  `,
})
export class FamiliesDialog {
  private api = inject(ExamService);
  private notify = inject(NotifyService);
  private dialog = inject(MatDialog);
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
  imports: [MatTableModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  styles: `
    .head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .intro { color: var(--mat-sys-on-surface-variant); max-width: 720px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; }
    .chip { padding: 1px 8px; border-radius: 10px; background: var(--mat-sys-surface-container-high); font-size: 0.85em; margin-right: 4px; display: inline-block; }
    .off { color: var(--mat-sys-error); }
    .empty { padding: 24px; text-align: center; color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <div class="head">
      <h1>Exams</h1>
      <span>
        <button mat-stroked-button (click)="manageFamilies()"><mat-icon>folder_copy</mat-icon> Families</button>
        <button mat-flat-button (click)="edit(null)" style="margin-left: 8px"><mat-icon>add</mat-icon> New exam</button>
      </span>
    </div>
    <p class="intro">
      An exam is what students prepare for, such as SSC CGL. Group related exams into a family (SSC &rsaquo; MTS, CHSL, CGL), save each
      exam's usual pattern, then create tests under it as full tests, subject tests or previous year papers. A test can also be
      shown in other exams from its own settings.
    </p>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    <div class="table-wrap">
      <table mat-table [dataSource]="rows()">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Exam</th>
          <td mat-cell *matCellDef="let c"><strong>{{ c.name }}</strong>@if (c.description) { <div>{{ c.description }}</div> }</td>
        </ng-container>
        <ng-container matColumnDef="family">
          <th mat-header-cell *matHeaderCellDef>Family</th>
          <td mat-cell *matCellDef="let c">{{ c.group_name || '—' }}</td>
        </ng-container>
        <ng-container matColumnDef="sections">
          <th mat-header-cell *matHeaderCellDef>Sections</th>
          <td mat-cell *matCellDef="let c">@for (n of c.subject_names; track n) { <span class="chip">{{ n }}</span> } @empty { — }</td>
        </ng-container>
        <ng-container matColumnDef="tests">
          <th mat-header-cell *matHeaderCellDef>Tests</th>
          <td mat-cell *matCellDef="let c">{{ c.exam_count }}</td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let c"><span [class.off]="!c.is_active">{{ c.is_active ? 'Visible' : 'Hidden' }}</span></td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let c">
            <button mat-icon-button (click)="edit(c)" aria-label="Edit exam"><mat-icon>edit</mat-icon></button>
            <button mat-icon-button (click)="remove(c)" aria-label="Delete exam"><mat-icon>delete</mat-icon></button>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
      @if (!loading() && rows().length === 0) { <div class="empty">No exams yet. Create one, for example SSC.</div> }
    </div>
  `,
})
export class ExamCatalogue {
  private api = inject(ExamService);
  private qb = inject(QuestionBankService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

  columns = ['name', 'family', 'sections', 'tests', 'status', 'actions'];
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
