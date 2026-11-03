import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { Lang, LangSwitch, LanguageService, pick } from '../../shared/language';
import { ReviseCard, ReviseExam } from './student.models';
import { StudentService } from './student.service';

type Source = 'mistakes' | 'saved';

/**
 * Flash cards from the questions the student saved or still gets wrong. The question comes first; "Show answer" reveals the
 * right option and the explanation. "Got it" retires a card for this round, "Again" puts it back at the end of the pile.
 */
@Component({
  selector: 'app-revise',
  imports: [RouterLink, LangSwitch],
  templateUrl: './revise.html',
  styleUrl: './revise.scss',
  host: { class: 'bs' },
})
export class Revise {
  private api = inject(StudentService);
  private notify = inject(NotifyService);
  private language = inject(LanguageService);

  languages: Lang[] = ['en', 'hi'];
  source = signal<Source>('mistakes');
  /** The exam to revise from (its public id, or "none"); empty means all of them. */
  exam = signal('');
  exams = signal<ReviseExam[]>([]);
  allCount = computed(() => this.exams().reduce((n, e) => n + e.count, 0));

  /** The exams offered in the filter, under their family (SSC Exams, Railways...); the rest under "Other". */
  examGroups = computed(() => {
    const out: { name: string; exams: ReviseExam[] }[] = [];
    for (const e of this.exams()) {
      const name = e.group ?? 'Other';
      let g = out.find((x) => x.name === name);
      if (!g) out.push((g = { name, exams: [] }));
      g.exams.push(e);
    }
    return out;
  });
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
    this.exam.set(''); // the other list may have none from this exam
    this.load();
  }

  pickExam(exam: string) {
    this.exam.set(exam);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.revise(this.source(), 20, this.exam()).subscribe({
      next: (r) => {
        this.exams.set(r.exams ?? []);
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
