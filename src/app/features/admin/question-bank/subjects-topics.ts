import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { BsTab, BsTabs } from '../../../shared/bs-tabs/bs-tabs';
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
  imports: [ReactiveFormsModule],
  templateUrl: './name-dialog.html',
  styleUrl: './name-dialog.scss',
  host: { class: 'bs' },
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

  bad(c: AbstractControl) {
    return c.invalid && (c.touched || c.dirty);
  }

  cancel() {
    this.ref.close(false);
  }

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
  imports: [BsTabs],
  templateUrl: './subjects-topics.html',
  styleUrl: './subjects-topics.scss',
  host: { class: 'bs' },
})
export class SubjectsTopics {
  private api = inject(QuestionBankService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

  readonly tabs: BsTab[] = [{ key: 'subjects', label: 'Subjects' }, { key: 'topics', label: 'Topics' }];
  tab = signal(0);
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

  pickSubject(value: string) {
    this.topicFilter.set(value ? Number(value) : null);
    this.loadTopics();
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
