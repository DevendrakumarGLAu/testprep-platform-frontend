import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { Subject, Topic } from '../question-bank/qb.models';
import { QuestionBankService } from '../question-bank/qb.service';
import {
  ImportDefaults, ImportJob, ImportMapping, ImportRowData, ImportService, ImportSource, saveBlob,
} from './import.service';
import { RowFixDialog } from './row-fix-dialog';

type Step = 'upload' | 'map' | 'review' | 'done';

const FIELD_LABELS: { key: keyof Omit<ImportMapping, 'options'>; label: string; required?: boolean }[] = [
  { key: 'question', label: 'Question text', required: true },
  { key: 'correct', label: 'Correct answer (A, B, 1, 2 or the option text)', required: true },
  { key: 'explanation', label: 'Explanation' },
  { key: 'subject', label: 'Subject' },
  { key: 'topic', label: 'Topic' },
  { key: 'difficulty', label: 'Difficulty' },
  { key: 'marks', label: 'Marks' },
  { key: 'negative_marks', label: 'Negative marks' },
  { key: 'tags', label: 'Tags (comma separated)' },
];

@Component({
  selector: 'app-import-wizard',
  imports: [
    FormsModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatSelectModule, MatFormFieldModule,
    MatInputModule, MatCheckboxModule, MatPaginatorModule, MatProgressBarModule, MatButtonToggleModule,
  ],
  styleUrl: './import-wizard.scss',
  template: `
    <div class="head">
      <h1>Import questions</h1>
      <a mat-button routerLink="/admin/questions"><mat-icon>arrow_back</mat-icon> Question bank</a>
    </div>

    <ol class="steps" aria-label="Import steps">
      @for (s of stepList; track s.id; let i = $index) {
        <li [class.active]="step() === s.id" [class.done]="stepIndex() > i"><span>{{ i + 1 }}</span> {{ s.label }}</li>
      }
    </ol>
    @if (busy()) { <mat-progress-bar mode="indeterminate" /> }

    @switch (step()) {
      <!-- 1. UPLOAD -->
      @case ('upload') {
        <div class="sources">
          @for (s of sources(); track s.id) {
            <mat-card appearance="outlined" [class.off]="!s.available">
              <mat-card-content>
                <strong>{{ s.label }}</strong>
                @if (s.extensions.length) { <span class="muted"> {{ s.extensions.join(' ') }}</span> }
                @if (!s.available) { <span class="soon">Coming later</span> }
                <p class="muted">{{ s.note }}</p>
              </mat-card-content>
            </mat-card>
          }
        </div>
        <mat-card appearance="outlined">
          <mat-card-content>
            <div class="drop" (dragover)="$event.preventDefault()" (drop)="drop($event)">
              <mat-icon>upload_file</mat-icon>
              <p>Drag a file here, or</p>
              <input #file type="file" accept=".csv,.xlsx,.xls,.pdf" hidden (change)="pick($event)" />
              <button mat-flat-button (click)="file.click()" [disabled]="busy()">Choose file</button>
              <p class="muted">Up to 5 MB and 2000 questions. All sources use the same checks and review step.</p>
            </div>
            @if (uploadError()) { <p class="err" role="alert">{{ uploadError() }}</p> }
            <div class="templates">
              <strong>Need a template?</strong>
              <button mat-button (click)="template('csv')"><mat-icon>download</mat-icon> CSV template</button>
              <button mat-button (click)="template('xlsx')"><mat-icon>download</mat-icon> Excel template</button>
            </div>
          </mat-card-content>
        </mat-card>
      }

      <!-- 2. MAP -->
      @case ('map') {
        @if (job(); as j) {
          <mat-card appearance="outlined">
            <mat-card-header><mat-card-title>{{ j.filename }}</mat-card-title>
              <mat-card-subtitle>{{ j.total_rows }} rows found. Check how its columns map to question fields.</mat-card-subtitle></mat-card-header>
            <mat-card-content>
              @for (w of j.warnings; track w) { <p class="warn"><mat-icon inline>info</mat-icon> {{ w }}</p> }
              <div class="map-grid">
                @for (f of fields; track f.key) {
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>{{ f.label }}{{ f.required ? ' *' : '' }}</mat-label>
                    <mat-select [value]="mapping()[f.key] ?? ''" (selectionChange)="setField(f.key, $event.value)">
                      <mat-option value="">(none)</mat-option>
                      @for (h of j.headers; track h) { <mat-option [value]="h">{{ h }}</mat-option> }
                    </mat-select>
                  </mat-form-field>
                }
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="wide">
                  <mat-label>Option columns * (lettered A, B, C… in file order)</mat-label>
                  <mat-select multiple [value]="mapping().options" (selectionChange)="setOptions($event.value)">
                    @for (h of j.headers; track h) { <mat-option [value]="h">{{ h }}</mat-option> }
                  </mat-select>
                </mat-form-field>
              </div>

              <h3>Defaults for empty cells</h3>
              <div class="map-grid">
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Default subject</mat-label>
                  <mat-select [(ngModel)]="defaults.subject" (selectionChange)="defaults.topic = null">
                    <mat-option [value]="null">(none)</mat-option>
                    @for (s of subjects(); track s.id) { <mat-option [value]="s.id">{{ s.name }}</mat-option> }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Default topic</mat-label>
                  <mat-select [(ngModel)]="defaults.topic" [disabled]="!defaults.subject">
                    <mat-option [value]="null">(none)</mat-option>
                    @for (t of topicsFor(); track t.id) { <mat-option [value]="t.id">{{ t.name }}</mat-option> }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Default difficulty</mat-label>
                  <mat-select [(ngModel)]="defaults.difficulty">
                    <mat-option value="easy">Easy</mat-option><mat-option value="medium">Medium</mat-option><mat-option value="hard">Hard</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Default marks</mat-label>
                  <input matInput type="number" step="0.25" min="0" [(ngModel)]="defaults.marks" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Default negative marks</mat-label>
                  <input matInput type="number" step="0.25" min="0" [(ngModel)]="defaults.negative_marks" />
                </mat-form-field>
              </div>
              <mat-checkbox [(ngModel)]="createMissing">Create subjects and topics that do not exist yet</mat-checkbox>

              <h3>Preview of your file</h3>
              <div class="table-wrap">
                <table class="plain">
                  <thead><tr>@for (h of j.headers; track h) { <th>{{ h }}</th> }</tr></thead>
                  <tbody>@for (r of j.sample; track $index) { <tr>@for (h of j.headers; track h) { <td>{{ r[h] }}</td> }</tr> }</tbody>
                </table>
              </div>
              @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
            </mat-card-content>
            <mat-card-actions align="end">
              <button mat-button (click)="cancel()">Cancel import</button>
              <button mat-flat-button (click)="validate()" [disabled]="busy()">Validate and preview</button>
            </mat-card-actions>
          </mat-card>
        }
      }

      <!-- 3. REVIEW -->
      @case ('review') {
        @if (job(); as j) {
          <div class="counts">
            <span class="pill ok">{{ j.valid_rows }} valid</span>
            <span class="pill dup">{{ j.duplicate_rows }} possible duplicates</span>
            <span class="pill bad">{{ j.invalid_rows }} invalid</span>
            <span class="muted">of {{ j.total_rows }} rows</span>
          </div>
          @for (w of j.warnings; track w) { <p class="warn"><mat-icon inline>info</mat-icon> {{ w }}</p> }
          <div class="toolbar">
            <mat-button-toggle-group [value]="filter()" (change)="setFilter($event.value)" aria-label="Filter rows">
              <mat-button-toggle value="">All</mat-button-toggle>
              <mat-button-toggle value="valid">Valid</mat-button-toggle>
              <mat-button-toggle value="duplicate">Duplicates</mat-button-toggle>
              <mat-button-toggle value="invalid">Invalid</mat-button-toggle>
            </mat-button-toggle-group>
            <span class="spacer"></span>
            <button mat-button (click)="select('valid')">Select valid</button>
            <button mat-button (click)="select('valid_and_duplicates')">Select valid + duplicates</button>
            <button mat-button (click)="select('none')">Clear</button>
          </div>
          <div class="table-wrap">
            <table class="plain review">
              <thead><tr><th></th><th>Row</th><th>Question</th><th>Subject / topic</th><th>Answer</th><th>Check</th><th></th></tr></thead>
              <tbody>
                @for (r of rows(); track r.id) {
                  <tr [class]="r.status">
                    <td><mat-checkbox [checked]="r.selected" [disabled]="r.status === 'invalid'" (change)="toggle(r, $event.checked)" [attr.aria-label]="'Import row ' + r.row_number" /></td>
                    <td>{{ r.row_number }}</td>
                    <td class="q">{{ r.normalized?.question || '(empty)' }}
                      @if (r.normalized?.options?.length) { <div class="opts">@for (o of r.normalized!.options; track o.label) { <span [class.right]="o.label === r.normalized!.correct_label">{{ o.label }}. {{ o.text }}</span> } </div> }
                    </td>
                    <td>{{ r.normalized?.subject }}{{ r.normalized?.topic ? ' / ' + r.normalized?.topic : '' }}
                      @if (r.normalized?.new_subject || r.normalized?.new_topic) { <span class="new">will be created</span> }</td>
                    <td>{{ r.normalized?.correct_label || '—' }}</td>
                    <td>
                      @if (r.status === 'valid') { <span class="ok">Valid</span> }
                      @if (r.status === 'duplicate') {
                        <span class="dup">{{ r.duplicate_info?.in_file ? 'Repeats row ' + r.duplicate_info?.row : (r.duplicate_info?.exact ? 'Already in the bank' : 'Looks like question #' + r.duplicate_of + ' (' + ((r.duplicate_info?.similarity ?? 0) * 100).toFixed(0) + '%)') }}</span>
                      }
                      @for (e of r.errors; track e) { <div class="bad">{{ e }}</div> }
                    </td>
                    <td><button mat-icon-button (click)="fix(r)" aria-label="Fix this row"><mat-icon>edit</mat-icon></button></td>
                  </tr>
                }
              </tbody>
            </table>
            @if (!busy() && rows().length === 0) { <p class="muted pad">No rows in this view.</p> }
          </div>
          <mat-paginator [length]="total()" [pageIndex]="page() - 1" [pageSize]="20" (page)="onPage($event)" hidePageSize />
          @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
          <div class="actions">
            <button mat-button (click)="step.set('map')">Back to mapping</button>
            <button mat-button (click)="cancel()">Cancel import</button>
            <button mat-flat-button (click)="commit()" [disabled]="busy() || selectedCount() === 0">Import {{ selectedCount() }} selected</button>
          </div>
        }
      }

      <!-- 4. DONE -->
      @case ('done') {
        @if (job(); as j) {
          <mat-card appearance="outlined" class="done">
            <mat-card-content>
              <mat-icon class="big">{{ j.imported_count ? 'task_alt' : 'info' }}</mat-icon>
              <h2>{{ j.imported_count }} question{{ j.imported_count === 1 ? '' : 's' }} imported</h2>
              <div class="counts center">
                <span class="pill ok">{{ j.imported_count }} imported</span>
                <span class="pill dup">{{ j.skipped_count }} skipped</span>
                <span class="pill bad">{{ j.failed_count }} failed</span>
              </div>
              @if (j.invalid_rows || j.failed_count) {
                <p>{{ j.invalid_rows + j.failed_count }} row(s) could not be imported. Download the report, fix them in your file and import again.</p>
                <button mat-stroked-button (click)="downloadReport()"><mat-icon>download</mat-icon> Download failed-row report</button>
              }
              <div class="actions center">
                <a mat-flat-button routerLink="/admin/questions">View question bank</a>
                <button mat-button (click)="reset()">Import another file</button>
              </div>
            </mat-card-content>
          </mat-card>
        }
      }
    }
  `,
})
export class ImportWizard {
  private api = inject(ImportService);
  private qb = inject(QuestionBankService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);
  private router = inject(Router);

  readonly stepList: { id: Step; label: string }[] = [
    { id: 'upload', label: 'Upload' }, { id: 'map', label: 'Map columns' },
    { id: 'review', label: 'Review' }, { id: 'done', label: 'Done' },
  ];
  readonly fields = FIELD_LABELS;

  step = signal<Step>('upload');
  stepIndex = computed(() => this.stepList.findIndex((s) => s.id === this.step()));
  busy = signal(false);
  error = signal('');
  uploadError = signal('');

  sources = signal<ImportSource[]>([]);
  subjects = signal<Subject[]>([]);
  topics = signal<Topic[]>([]);

  job = signal<ImportJob | null>(null);
  mapping = signal<ImportMapping>({ options: [] });
  defaults: ImportDefaults & { subject: number | null; topic: number | null } = {
    subject: null, topic: null, difficulty: 'medium', marks: 1, negative_marks: 0,
  };
  createMissing = false;

  rows = signal<ImportRowData[]>([]);
  total = signal(0);
  page = signal(1);
  filter = signal('');
  selectedCount = computed(() => this.job()?.selected_count ?? 0);
  topicsFor = computed(() => this.topics().filter((t) => t.subject === this.defaults.subject));

  constructor() {
    this.api.sources().subscribe((s) => this.sources.set(s));
    this.qb.subjects().subscribe((p) => this.subjects.set(p.results.filter((s) => s.is_active)));
    this.qb.topics().subscribe((p) => this.topics.set(p.results.filter((t) => t.is_active)));
  }

  // --- 1 upload ---
  template(kind: 'csv' | 'xlsx') {
    this.api.template(kind).subscribe({
      next: (b) => saveBlob(b, `question-import-template.${kind}`),
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  pick(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (f) this.upload(f);
    (ev.target as HTMLInputElement).value = '';
  }

  drop(ev: DragEvent) {
    ev.preventDefault();
    const f = ev.dataTransfer?.files?.[0];
    if (f) this.upload(f);
  }

  private upload(file: File) {
    this.uploadError.set('');
    this.busy.set(true);
    this.api.upload(file).subscribe({
      next: (j) => {
        this.busy.set(false);
        this.job.set(j);
        this.mapping.set({ ...j.mapping, options: [...(j.mapping.options ?? [])] });
        this.step.set('map');
      },
      error: (e) => {
        this.busy.set(false);
        this.uploadError.set(e.error?.file ? String(e.error.file) : apiErrorMessage(e));
      },
    });
  }

  // --- 2 map ---
  setField(key: keyof Omit<ImportMapping, 'options'>, value: string) {
    this.mapping.update((m) => ({ ...m, [key]: value || undefined }));
  }

  setOptions(selected: string[]) {
    const order = this.job()!.headers;
    this.mapping.update((m) => ({ ...m, options: [...selected].sort((a, b) => order.indexOf(a) - order.indexOf(b)) }));
  }

  validate() {
    const m = this.mapping();
    if (!m.question) return this.error.set('Choose the column that holds the question text.');
    if (!m.correct) return this.error.set('Choose the column that holds the correct answer.');
    if (m.options.length < 2) return this.error.set('Choose at least two option columns.');
    this.error.set('');
    this.busy.set(true);
    const clean = Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined && v !== '')) as unknown as ImportMapping;
    this.api.process(this.job()!.id, clean, { ...this.defaults }, this.createMissing).subscribe({
      next: (j) => {
        this.job.set(j);
        this.filter.set('');
        this.page.set(1);
        this.step.set('review');
        this.loadRows();
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(e.error?.mapping ? String(e.error.mapping) : apiErrorMessage(e));
      },
    });
  }

  // --- 3 review ---
  loadRows() {
    this.busy.set(true);
    this.api.rows(this.job()!.id, this.filter(), this.page()).subscribe({
      next: (p) => {
        this.rows.set(p.results);
        this.total.set(p.count);
        this.busy.set(false);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(e));
      },
    });
  }

  setFilter(v: string) {
    this.filter.set(v);
    this.page.set(1);
    this.loadRows();
  }

  onPage(e: PageEvent) {
    this.page.set(e.pageIndex + 1);
    this.loadRows();
  }

  toggle(r: ImportRowData, selected: boolean) {
    this.api.patchRow(this.job()!.id, r.id, { selected }).subscribe({
      next: (res) => {
        this.rows.update((l) => l.map((x) => (x.id === r.id ? res.row : x)));
        this.job.set(res.job);
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  select(mode: 'valid' | 'none' | 'valid_and_duplicates') {
    this.api.select(this.job()!.id, mode).subscribe({
      next: (j) => {
        this.job.set(j);
        this.loadRows();
      },
    });
  }

  fix(r: ImportRowData) {
    this.dialog
      .open(RowFixDialog, { data: { jobId: this.job()!.id, row: r, subjects: this.subjects() }, width: '600px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((job) => {
        if (!job) return;
        this.job.set(job);
        this.loadRows();
      });
  }

  commit() {
    this.busy.set(true);
    this.error.set('');
    this.api.commit(this.job()!.id).subscribe({
      next: (j) => {
        this.busy.set(false);
        this.job.set(j);
        this.step.set('done');
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(e.error?.detail ? String(e.error.detail) : apiErrorMessage(e));
      },
    });
  }

  // --- 4 done ---
  downloadReport() {
    const id = this.job()!.id;
    this.api.failedReport(id).subscribe({
      next: (b) => saveBlob(b, `import-${id}-failed-rows.csv`),
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  cancel() {
    const j = this.job();
    if (!j) return this.reset();
    this.api.discard(j.id).subscribe({ next: () => this.reset(), error: () => this.router.navigateByUrl('/admin/questions') });
  }

  reset() {
    this.job.set(null);
    this.rows.set([]);
    this.step.set('upload');
    this.error.set('');
  }
}
