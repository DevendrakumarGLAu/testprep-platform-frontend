import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { debounceTime } from 'rxjs';
import { environment } from '../../../environments/environment';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { LangSwitch, Lang, LanguageService, pick } from '../../shared/language';

export interface NoteSummary {
  id: string;
  title: string;
  title_hi: string;
  category: string | null;
  subject: string | null;
  note_date: string | null;
  updated_at: string;
  summary: string;
}

export interface NoteFull extends NoteSummary {
  body: string;
  body_hi: string;
}

/** Splits a note into paragraphs and bullet points ("- item") for display. */
export function noteLines(text: string): { bullet: boolean; text: string }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim())
    .map((l) => (/^\s*[-•*]\s+/.test(l) ? { bullet: true, text: l.replace(/^\s*[-•*]\s+/, '') } : { bullet: false, text: l.trim() }));
}

@Component({
  selector: 'app-notes',
  imports: [DatePipe, RouterLink, ReactiveFormsModule],
  templateUrl: './notes.html',
  styleUrl: './notes.scss',
  host: { class: 'bs' },
})
export class Notes {
  private http = inject(HttpClient);
  private notify = inject(NotifyService);
  search = new FormControl('', { nonNullable: true });
  loading = signal(true);
  rows = signal<NoteSummary[]>([]);

  constructor() {
    this.load('');
    this.search.valueChanges.pipe(debounceTime(300)).subscribe((q) => this.load(q));
  }

  load(q: string) {
    this.loading.set(true);
    this.http.get<{ results: NoteSummary[] }>(`${environment.apiUrl}/student/notes/`, { params: q.trim() ? { search: q.trim() } : {} }).subscribe({
      next: (r) => {
        this.rows.set(r.results);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }
}

@Component({
  selector: 'app-note-detail',
  imports: [DatePipe, RouterLink, LangSwitch],
  templateUrl: './note-detail.html',
  styleUrl: './note-detail.scss',
  host: { class: 'bs' },
})
export class NoteDetail {
  id = input.required<string>();
  private http = inject(HttpClient);
  private langs = inject(LanguageService);

  loading = signal(true);
  note = signal<NoteFull | null>(null);

  languages = computed<Lang[]>(() => {
    const n = this.note();
    return n ? [...((n.body || n.title) ? ['en' as const] : []), ...((n.body_hi || n.title_hi) ? ['hi' as const] : [])] : [];
  });
  lang = computed<Lang>(() => (this.languages().includes(this.langs.lang()) ? this.langs.lang() : (this.languages()[0] ?? 'en')));
  say = (en: string, hi: string) => pick(en, hi, this.lang());
  blocks = computed(() => {
    const n = this.note();
    return n ? noteLines(this.say(n.body, n.body_hi)) : [];
  });

  constructor() {
    effect(() => {
      this.loading.set(true);
      this.http.get<NoteFull>(`${environment.apiUrl}/student/notes/${this.id()}/`).subscribe({
        next: (n) => {
          this.note.set(n);
          this.loading.set(false);
        },
        error: () => {
          this.note.set(null);
          this.loading.set(false);
        },
      });
    });
  }
}
