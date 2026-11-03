import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { ImageViewer } from '../../shared/image-viewer';
import { LangSwitch, Lang, LanguageService, pick } from '../../shared/language';
import { MyReport, SavedList, SavedQuestion } from './student.models';
import { StudentService } from './student.service';

/** Questions the student saved from their reviews (with private notes), and the problems they have reported. */
@Component({
  selector: 'app-saved',
  imports: [FormsModule, RouterLink, LangSwitch],
  templateUrl: './saved.html',
  styleUrl: './saved.scss',
  host: { class: 'bs' },
})
export class Saved {
  private api = inject(StudentService);
  private notify = inject(NotifyService);
  private langs = inject(LanguageService);
  private dialog = inject(MatDialog);

  zoom(src: string) {
    ImageViewer.open(this.dialog, src, 'The picture you sent');
  }

  languages: Lang[] = ['en', 'hi'];
  lang = computed<Lang>(() => this.langs.lang());
  say = (en?: string, hi?: string) => pick(en, hi, this.lang());

  loading = signal(true);
  data = signal<SavedList | null>(null);
  reports = signal<MyReport[]>([]);
  subject = signal('');
  private drafts = signal<Record<number, string>>({});

  constructor() {
    this.load();
    this.api.myReports().subscribe({ next: (r) => this.reports.set(r.results), error: () => undefined });
  }

  load() {
    this.loading.set(true);
    this.api.saved(this.subject()).subscribe({
      next: (d) => {
        this.data.set(d);
        this.drafts.set({});
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  draft(id: number, text: string) {
    this.drafts.update((d) => ({ ...d, [id]: text }));
  }

  isDirty(s: SavedQuestion) {
    const d = this.drafts()[s.id];
    return d !== undefined && d !== s.note;
  }

  saveNote(s: SavedQuestion) {
    this.api.updateSaved(s.id, this.drafts()[s.id] ?? s.note).subscribe({
      next: (u) => {
        this.data.update((d) => (d ? { ...d, results: d.results.map((r) => (r.id === u.id ? u : r)) } : d));
        this.drafts.update((x) => {
          const { [s.id]: _gone, ...rest } = x;
          return rest;
        });
        this.notify.success('Note saved.');
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  remove(s: SavedQuestion) {
    this.api.deleteSaved(s.id).subscribe({
      next: () => {
        this.data.update((d) => (d ? { ...d, count: d.count - 1, results: d.results.filter((r) => r.id !== s.id) } : d));
        this.notify.success('Removed.');
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }
}
