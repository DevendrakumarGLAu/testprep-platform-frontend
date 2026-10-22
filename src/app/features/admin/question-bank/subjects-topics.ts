import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { Observable } from 'rxjs';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { ConfirmDialog } from '../../../shared/confirm-dialog';
import { Subject, Topic } from './qb.models';
import { QuestionBankService } from './qb.service';

/** Small create/edit dialog shared by subjects and topics. */
interface NameDialogData {
  title: string;
  value: { name: string; description: string; subject?: number | null };
  subjects?: Subject[];
  save: (body: any) => Observable<unknown>;
}

@Component({
  selector: 'app-name-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  styles: `form { display: flex; flex-direction: column; min-width: min(420px, 80vw); padding-top: 8px; } .err { color: var(--mat-sys-error); margin: 0; }`,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="name-form" (ngSubmit)="save()" novalidate>
        @if (data.subjects) {
          <mat-form-field appearance="outline">
            <mat-label>Subject</mat-label>
            <mat-select formControlName="subject">
              @for (s of data.subjects; track s.id) { <mat-option [value]="s.id">{{ s.name }}</mat-option> }
            </mat-select>
            <mat-error>Required</mat-error>
          </mat-form-field>
        }
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" maxlength="120" />
          <mat-error>Required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput rows="3" formControlName="description"></textarea>
        </mat-form-field>
        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button type="submit" form="name-form" [disabled]="saving()">Save</button>
    </mat-dialog-actions>
  `,
})
export class NameDialog {
  data = inject<NameDialogData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<NameDialog, boolean>);
  private fb = inject(FormBuilder);
  saving = signal(false);
  error = signal('');

  form = this.fb.group({
    name: [this.data.value.name, Validators.required],
    description: [this.data.value.description],
    subject: [this.data.value.subject ?? null, this.data.subjects ? Validators.required : []],
  });

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body: any = { name: (v.name ?? '').trim(), description: v.description ?? '' };
    if (this.data.subjects) body.subject = v.subject;
    this.data.save(body).subscribe({
      next: () => this.ref.close(true),
      error: (err) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
  }
}

@Component({
  selector: 'app-subjects-topics',
  imports: [MatTabsModule, MatTableModule, MatButtonModule, MatIconModule, MatSelectModule, MatFormFieldModule, MatProgressBarModule],
  styles: `
    .bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin: 16px 0 8px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; }
    .archived { color: var(--mat-sys-on-surface-variant); font-style: italic; }
    .empty { padding: 24px; text-align: center; color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <h1>Subjects &amp; Topics</h1>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    <mat-tab-group animationDuration="0">
      <mat-tab label="Subjects">
        <div class="bar">
          <span></span>
          <button mat-flat-button (click)="editSubject(null)"><mat-icon>add</mat-icon> New subject</button>
        </div>
        <div class="table-wrap">
          <table mat-table [dataSource]="subjects()">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let s"><span [class.archived]="!s.is_active">{{ s.name }}</span></td>
            </ng-container>
            <ng-container matColumnDef="topics">
              <th mat-header-cell *matHeaderCellDef>Topics</th>
              <td mat-cell *matCellDef="let s">{{ s.topic_count }}</td>
            </ng-container>
            <ng-container matColumnDef="questions">
              <th mat-header-cell *matHeaderCellDef>Questions</th>
              <td mat-cell *matCellDef="let s">{{ s.question_count }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let s">{{ s.is_active ? 'Active' : 'Archived' }}</td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let s">
                <button mat-icon-button (click)="editSubject(s)" aria-label="Edit subject"><mat-icon>edit</mat-icon></button>
                <button mat-icon-button (click)="toggleSubject(s)" [attr.aria-label]="s.is_active ? 'Archive subject' : 'Restore subject'">
                  <mat-icon>{{ s.is_active ? 'archive' : 'unarchive' }}</mat-icon>
                </button>
                <button mat-icon-button (click)="removeSubject(s)" aria-label="Delete subject"><mat-icon>delete</mat-icon></button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="subjectCols"></tr>
            <tr mat-row *matRowDef="let row; columns: subjectCols"></tr>
          </table>
          @if (!loading() && subjects().length === 0) { <div class="empty">No subjects yet. Create one to get started.</div> }
        </div>
      </mat-tab>

      <mat-tab label="Topics">
        <div class="bar">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Filter by subject</mat-label>
            <mat-select [value]="topicFilter()" (selectionChange)="topicFilter.set($event.value); loadTopics()">
              <mat-option [value]="null">All subjects</mat-option>
              @for (s of subjects(); track s.id) { <mat-option [value]="s.id">{{ s.name }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <button mat-flat-button (click)="editTopic(null)" [disabled]="activeSubjects().length === 0">
            <mat-icon>add</mat-icon> New topic
          </button>
        </div>
        <div class="table-wrap">
          <table mat-table [dataSource]="topics()">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Topic</th>
              <td mat-cell *matCellDef="let t"><span [class.archived]="!t.is_active">{{ t.name }}</span></td>
            </ng-container>
            <ng-container matColumnDef="subject">
              <th mat-header-cell *matHeaderCellDef>Subject</th>
              <td mat-cell *matCellDef="let t">{{ t.subject_name }}</td>
            </ng-container>
            <ng-container matColumnDef="questions">
              <th mat-header-cell *matHeaderCellDef>Questions</th>
              <td mat-cell *matCellDef="let t">{{ t.question_count }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let t">{{ t.is_active ? 'Active' : 'Archived' }}</td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let t">
                <button mat-icon-button (click)="editTopic(t)" aria-label="Edit topic"><mat-icon>edit</mat-icon></button>
                <button mat-icon-button (click)="toggleTopic(t)" [attr.aria-label]="t.is_active ? 'Archive topic' : 'Restore topic'">
                  <mat-icon>{{ t.is_active ? 'archive' : 'unarchive' }}</mat-icon>
                </button>
                <button mat-icon-button (click)="removeTopic(t)" aria-label="Delete topic"><mat-icon>delete</mat-icon></button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="topicCols"></tr>
            <tr mat-row *matRowDef="let row; columns: topicCols"></tr>
          </table>
          @if (!loading() && topics().length === 0) { <div class="empty">No topics found.</div> }
        </div>
      </mat-tab>
    </mat-tab-group>
  `,
})
export class SubjectsTopics {
  private api = inject(QuestionBankService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

  subjectCols = ['name', 'topics', 'questions', 'status', 'actions'];
  topicCols = ['name', 'subject', 'questions', 'status', 'actions'];
  loading = signal(true);
  subjects = signal<Subject[]>([]);
  topics = signal<Topic[]>([]);
  topicFilter = signal<number | null>(null);
  activeSubjects = () => this.subjects().filter((s) => s.is_active);

  constructor() {
    this.reload();
  }

  reload() {
    this.loadSubjects();
    this.loadTopics();
  }

  private loadSubjects() {
    this.loading.set(true);
    this.api.subjects().subscribe({
      next: (p) => {
        this.subjects.set(p.results);
        this.loading.set(false);
      },
      error: (e) => this.fail(e),
    });
  }

  loadTopics() {
    const subject = this.topicFilter();
    this.api.topics(subject ? { subject } : {}).subscribe({
      next: (p) => this.topics.set(p.results),
      error: (e) => this.fail(e),
    });
  }

  private fail(err: unknown) {
    this.loading.set(false);
    this.notify.error(apiErrorMessage(err));
  }

  editSubject(s: Subject | null) {
    this.dialog
      .open(NameDialog, {
        data: {
          title: s ? 'Edit subject' : 'New subject',
          value: { name: s?.name ?? '', description: s?.description ?? '' },
          save: (body: any) => this.api.saveSubject(body, s?.id),
        } satisfies NameDialogData,
      })
      .afterClosed()
      .subscribe((ok) => ok && (this.notify.success('Subject saved'), this.reload()));
  }

  editTopic(t: Topic | null) {
    this.dialog
      .open(NameDialog, {
        data: {
          title: t ? 'Edit topic' : 'New topic',
          value: { name: t?.name ?? '', description: t?.description ?? '', subject: t?.subject ?? this.topicFilter() },
          subjects: this.activeSubjects(),
          save: (body: any) => this.api.saveTopic(body, t?.id),
        } satisfies NameDialogData,
      })
      .afterClosed()
      .subscribe((ok) => ok && (this.notify.success('Topic saved'), this.reload()));
  }

  toggleSubject(s: Subject) {
    this.confirm(
      s.is_active ? 'Archive subject?' : 'Restore subject?',
      s.is_active
        ? `"${s.name}" will no longer be selectable for new questions. Existing questions are kept.`
        : `"${s.name}" will be selectable again.`,
      s.is_active ? 'Archive' : 'Restore',
      () => this.api.subjectAction(s.id, s.is_active ? 'archive' : 'restore'),
    );
  }

  toggleTopic(t: Topic) {
    this.confirm(
      t.is_active ? 'Archive topic?' : 'Restore topic?',
      t.is_active ? `"${t.name}" will no longer be selectable for new questions.` : `"${t.name}" will be selectable again.`,
      t.is_active ? 'Archive' : 'Restore',
      () => this.api.topicAction(t.id, t.is_active ? 'archive' : 'restore'),
    );
  }

  removeSubject(s: Subject) {
    this.confirm('Delete subject?', `Permanently delete "${s.name}"? This only works if nothing uses it.`, 'Delete', () =>
      this.api.deleteSubject(s.id),
    );
  }

  removeTopic(t: Topic) {
    this.confirm('Delete topic?', `Permanently delete "${t.name}"? This only works if nothing uses it.`, 'Delete', () =>
      this.api.deleteTopic(t.id),
    );
  }

  private confirm(title: string, message: string, confirmLabel: string, run: () => Observable<unknown>) {
    this.dialog
      .open(ConfirmDialog, { data: { title, message, confirmLabel } })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        run().subscribe({
          next: () => {
            this.notify.success('Done');
            this.reload();
          },
          error: (e) => this.notify.error(apiErrorMessage(e)),
        });
      });
  }
}
