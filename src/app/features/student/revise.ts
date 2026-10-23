import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { Lang, LangSwitch, LanguageService, pick } from '../../shared/language';
import { ReviseCard } from './student.models';
import { StudentService } from './student.service';

type Source = 'mistakes' | 'saved';

/**
 * Flash cards from the questions the student saved or still gets wrong. The question comes first; "Show answer" reveals the
 * right option and the explanation. "Got it" retires a card for this round, "Again" puts it back at the end of the pile.
 */
@Component({
  selector: 'app-revise',
  imports: [RouterLink, MatButtonModule, MatButtonToggleModule, MatCardModule, MatIconModule, MatProgressBarModule, LangSwitch],
  styles: `
    :host { display: block; max-width: 760px; }
    .bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
    .spacer { flex: 1; }
    .meta { color: var(--mat-sys-on-surface-variant); font-size: 0.85em; margin-bottom: 6px; }
    .q { font: var(--mat-sys-title-large); margin: 4px 0 16px; white-space: pre-wrap; }
    ol { padding-left: 24px; margin: 0 0 12px; }
    li { margin-bottom: 6px; }
    li.correct { color: #2e7d32; font-weight: 600; }
    li.yours { color: var(--mat-sys-error); }
    .mark { font-size: 0.8em; margin-left: 6px; }
    .expl { background: var(--mat-sys-surface-container); padding: 10px 14px; border-radius: 10px; margin-bottom: 12px; white-space: pre-wrap; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .done { text-align: center; padding: 24px 0; }
    .done mat-icon { font-size: 48px; width: 48px; height: 48px; color: var(--mat-sys-primary); }
  `,
  template: `
    <h1>Revise</h1>
    <div class="bar">
      <mat-button-toggle-group [value]="source()" (change)="choose($event.value)" aria-label="What to revise" hideSingleSelectionIndicator>
        <mat-button-toggle value="mistakes">My mistakes</mat-button-toggle>
        <mat-button-toggle value="saved">Saved questions</mat-button-toggle>
      </mat-button-toggle-group>
      <span class="spacer"></span>
      <app-lang-switch [languages]="languages" />
    </div>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

    @if (!loading() && !total()) {
      <mat-card appearance="outlined"><mat-card-content>
        @if (source() === 'saved') {
          <p>You have not saved any questions yet. Save a question from a test review and it will appear here.</p>
        } @else {
          <p>No mistakes to revise. Questions you get wrong in a test show up here once its solutions are released, and leave once you answer them correctly.</p>
        }
        <a mat-stroked-button routerLink="/student/tests">Take a test</a>
      </mat-card-content></mat-card>
    } @else if (!loading() && !current()) {
      <mat-card appearance="outlined"><mat-card-content class="done">
        <mat-icon>celebration</mat-icon>
        <h2>Round complete</h2>
        <p>You went through {{ total() }} {{ total() === 1 ? 'card' : 'cards' }}.@if (more()) { There are {{ more() }} more waiting. }</p>
        <button mat-flat-button (click)="load()">Start another round</button>
      </mat-card-content></mat-card>
    } @else if (current(); as c) {
      <p class="meta" role="status">Card {{ done() + 1 }} of {{ total() }} · {{ remaining() }} left</p>
      <mat-card appearance="outlined"><mat-card-content>
        <div class="meta">{{ c.subject }}@if (c.exam_title) { · {{ c.exam_title }} }</div>
        <div class="q">{{ say(c.text, c.text_hi) }}</div>
        <ol type="A">
          @for (o of c.options; track o.id) {
            <li [class.correct]="shown() && o.is_correct" [class.yours]="shown() && !o.is_correct && o.id === c.your_option">
              {{ say(o.text, o.text_hi) }}
              @if (shown() && o.is_correct) { <span class="mark">Correct answer</span> }
              @if (shown() && !o.is_correct && o.id === c.your_option) { <span class="mark">Your answer</span> }
            </li>
          }
        </ol>
        @if (shown()) {
          @if (say(c.explanation, c.explanation_hi)) { <div class="expl">{{ say(c.explanation, c.explanation_hi) }}</div> }
          <div class="actions">
            <button mat-flat-button (click)="gotIt()"><mat-icon>check</mat-icon> Got it</button>
            <button mat-stroked-button (click)="again()"><mat-icon>replay</mat-icon> Again</button>
          </div>
        } @else {
          <button mat-flat-button (click)="shown.set(true)">Show answer</button>
        }
      </mat-card-content></mat-card>
    }
  `,
})
export class Revise {
  private api = inject(StudentService);
  private notify = inject(NotifyService);
  private language = inject(LanguageService);

  languages: Lang[] = ['en', 'hi'];
  source = signal<Source>('mistakes');
  loading = signal(false);
  pile = signal<ReviseCard[]>([]);
  total = signal(0); // cards in this round
  available = signal(0); // cards that exist in all
  done = signal(0);
  shown = signal(false);

  current = computed(() => this.pile()[0] ?? null);
  remaining = computed(() => this.pile().length);
  more = computed(() => Math.max(0, this.available() - this.total()));
  say = (en?: string, hi?: string) => pick(en, hi, this.language.lang());

  constructor() {
    this.load();
  }

  choose(source: Source) {
    this.source.set(source);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.revise(this.source()).subscribe({
      next: (r) => {
        this.pile.set(r.cards);
        this.total.set(r.cards.length);
        this.available.set(r.total);
        this.done.set(0);
        this.shown.set(false);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.pile.set([]);
        this.total.set(0);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  /** The card is learned for this round. */
  gotIt() {
    this.pile.update((p) => p.slice(1));
    this.done.update((n) => n + 1);
    this.shown.set(false);
  }

  /** Not yet: the card goes to the bottom of the pile and comes back later in the round. */
  again() {
    this.pile.update((p) => [...p.slice(1), p[0]]);
    this.shown.set(false);
  }
}
