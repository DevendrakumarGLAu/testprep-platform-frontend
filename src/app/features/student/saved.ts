import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { LangSwitch, Lang, LanguageService, pick } from '../../shared/language';
import { MyReport, SavedList, SavedQuestion } from './student.models';
import { StudentService } from './student.service';

/** Questions the student saved from their reviews (with private notes), and the problems they have reported. */
@Component({
  selector: 'app-saved',
  imports: [
    FormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressBarModule, MatSelectModule, LangSwitch,
  ],
  styles: `
    :host { display: block; max-width: 900px; }
    .bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
    .bar .spacer { flex: 1; }
    mat-card { margin-bottom: 12px; }
    .meta { color: var(--mat-sys-on-surface-variant); font-size: 0.85em; margin-bottom: 6px; }
    .q { font: var(--mat-sys-title-medium); margin: 4px 0 8px; white-space: pre-wrap; }
    ol { padding-left: 22px; margin: 0 0 8px; }
    li.correct { color: #2e7d32; font-weight: 500; }
    li.wrong { color: var(--mat-sys-error); }
    .mark { font-size: 0.8em; margin-left: 6px; }
    .expl { background: var(--mat-sys-surface-container); padding: 8px 12px; border-radius: 8px; margin-bottom: 8px; }
    mat-form-field { width: 100%; }
    .actions { display: flex; gap: 8px; }
    .muted { color: var(--mat-sys-on-surface-variant); }
    .chip { display: inline-block; padding: 1px 10px; border-radius: 10px; font-size: 0.8em; background: var(--mat-sys-secondary-container); }
    .chip.resolved { background: #c8e6c9; color: #1b5e20; }
    .chip.rejected { background: var(--mat-sys-surface-container-high); }
    .note { border-left: 3px solid var(--mat-sys-primary); padding-left: 10px; margin-top: 6px; }
  `,
  template: `
    <h1>Saved questions</h1>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

    <div class="bar">
      @if (data()?.subjects?.length) {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Subject</mat-label>
          <mat-select [value]="subject()" (selectionChange)="subject.set($event.value); load()">
            <mat-option value="">All subjects</mat-option>
            @for (s of data()!.subjects; track s) { <mat-option [value]="s">{{ s }}</mat-option> }
          </mat-select>
        </mat-form-field>
      }
      <span class="spacer"></span>
      <app-lang-switch [languages]="languages" />
    </div>

    @for (s of data()?.results ?? []; track s.id) {
      <mat-card appearance="outlined">
        <mat-card-content>
          <div class="meta">{{ s.subject }}{{ s.subject ? ' · ' : '' }}from {{ s.exam_title }}</div>
          <div class="q" [attr.lang]="lang()">{{ say(s.text, s.text_hi) }}</div>
          <ol>
            @for (o of s.options; track o.id) {
              <li [class.correct]="o.is_correct" [class.wrong]="s.selected_option === o.id && !o.is_correct">
                {{ say(o.text, o.text_hi) }}
                @if (s.selected_option === o.id) { <span class="mark">Your answer</span> }
                @if (o.is_correct) { <span class="mark">Correct answer</span> }
              </li>
            }
          </ol>
          @if (s.explanation || s.explanation_hi) { <div class="expl"><strong>Explanation</strong><br />{{ say(s.explanation, s.explanation_hi) }}</div> }
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>My note</mat-label>
            <textarea matInput rows="2" maxlength="1000" [ngModel]="s.note" (ngModelChange)="draft(s.id, $event)" placeholder="Why this one matters, a trick to remember..."></textarea>
          </mat-form-field>
          <div class="actions">
            <button mat-flat-button (click)="saveNote(s)" [disabled]="!isDirty(s)">Save note</button>
            <button mat-button (click)="remove(s)"><mat-icon>bookmark_remove</mat-icon> Remove</button>
          </div>
        </mat-card-content>
      </mat-card>
    } @empty {
      @if (!loading()) {
        <mat-card appearance="outlined"><mat-card-content>
          <p>You have not saved any questions yet. Open a result and press <strong>Save</strong> under a question to keep it here.</p>
          <a mat-flat-button routerLink="/student/attempts">Open my results</a>
        </mat-card-content></mat-card>
      }
    }

    @if (reports().length) {
      <h2>Problems I reported</h2>
      @for (r of reports(); track r.id) {
        <mat-card appearance="outlined"><mat-card-content>
          <div class="meta">{{ r.exam_title }}</div>
          <div>{{ r.question }}</div>
          <p class="muted">{{ r.reason }}{{ r.message ? ': ' + r.message : '' }}</p>
          <span class="chip" [class]="'chip ' + r.status">{{ r.status === 'open' ? 'Waiting for review' : r.status === 'resolved' ? 'Fixed' : 'No change needed' }}</span>
          @if (r.admin_note) { <div class="note">Admin: {{ r.admin_note }}</div> }
        </mat-card-content></mat-card>
      }
    }
  `,
})
export class Saved {
  private api = inject(StudentService);
  private notify = inject(NotifyService);
  private langs = inject(LanguageService);

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
