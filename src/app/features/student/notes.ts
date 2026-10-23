import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
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
  imports: [DatePipe, RouterLink, ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule],
  styles: `
    :host { display: block; max-width: 900px; }
    mat-card { margin-bottom: 12px; }
    a.card { display: block; text-decoration: none; color: inherit; }
    .meta { color: var(--mat-sys-on-surface-variant); font-size: 0.85em; }
    h2 { margin: 4px 0; }
    p { margin: 4px 0 0; color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <h1>Study notes</h1>
    <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width: min(420px, 100%)">
      <mat-label>Search notes</mat-label>
      <input matInput [formControl]="search" />
      <mat-icon matSuffix>search</mat-icon>
    </mat-form-field>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    @for (n of rows(); track n.id) {
      <a class="card" [routerLink]="['/student/notes', n.id]">
        <mat-card appearance="outlined"><mat-card-content>
          <div class="meta">{{ n.category || 'All exams' }}{{ n.subject ? ' · ' + n.subject : '' }}{{ n.note_date ? ' · ' + (n.note_date | date: 'MMM y') : '' }}</div>
          <h2>{{ n.title || n.title_hi }}</h2>
          <p>{{ n.summary }}</p>
        </mat-card-content></mat-card>
      </a>
    } @empty {
      @if (!loading()) { <mat-card appearance="outlined"><mat-card-content>No notes yet. Check back soon.</mat-card-content></mat-card> }
    }
  `,
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
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule, LangSwitch],
  styles: `
    :host { display: block; max-width: 760px; }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .meta { color: var(--mat-sys-on-surface-variant); }
    p { line-height: 1.6; margin: 0 0 10px; }
    ul { margin: 0 0 12px; padding-left: 22px; line-height: 1.6; }
    @media print { a, app-lang-switch { display: none; } }
  `,
  template: `
    <a mat-button routerLink="/student/notes"><mat-icon>arrow_back</mat-icon> All notes</a>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    @if (note(); as n) {
      <div class="head">
        <h1 [attr.lang]="lang()">{{ say(n.title, n.title_hi) }}</h1>
        <app-lang-switch [languages]="languages()" />
      </div>
      <p class="meta">{{ n.category || 'All exams' }}{{ n.subject ? ' · ' + n.subject : '' }}{{ n.note_date ? ' · ' + (n.note_date | date: 'MMMM y') : '' }}</p>
      <div [attr.lang]="lang()">
        @for (l of blocks(); track $index) {
          @if (l.bullet) { <ul><li>{{ l.text }}</li></ul> } @else { <p>{{ l.text }}</p> }
        }
      </div>
    } @else if (!loading()) {
      <p>This note is not available.</p>
    }
  `,
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
