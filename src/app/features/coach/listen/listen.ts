import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/models';
import { ReviseCard, ReviseExam } from '../../student/student.models';
import { StudentService } from '../../student/student.service';
import { Clip, SpeechService } from './speech.service';

type Source = 'mistakes' | 'saved';
type Mode = 'hindi' | 'english' | 'both';

/** The words spoken for one revision card. */
export function clipsFor(card: ReviseCard, mode: Mode, withQuestion: boolean): Clip[] {
  const out: Clip[] = [];
  const right = card.options.find((o) => o.is_correct);
  const say = (hi: string, en: string, lang: 'hi' | 'en') => out.push({ text: lang === 'hi' ? hi : en, lang });
  const langs: ('hi' | 'en')[] = mode === 'both' ? ['hi', 'en'] : mode === 'hindi' ? ['hi'] : ['en'];
  for (const lang of langs) {
    // Fall back to the other language when a card has only one, so nothing is skipped in silence.
    const pick = (hi: string, en: string) => (lang === 'hi' ? hi || en : en || hi);
    const used: 'hi' | 'en' = lang === 'hi' ? (card.text_hi ? 'hi' : 'en') : card.text ? 'en' : 'hi';
    if (withQuestion) say(`प्रश्न। ${pick(card.text_hi, card.text)}`, `Question. ${pick(card.text_hi, card.text)}`, used);
    if (right) say(`सही उत्तर। ${pick(right.text_hi, right.text)}`, `Correct answer. ${pick(right.text_hi, right.text)}`, used);
    const expl = pick(card.explanation_hi, card.explanation);
    if (expl) say(`व्याख्या। ${expl}`, `Explanation. ${expl}`, used);
  }
  return out;
}

/** Audio revision: the student's mistakes or saved questions are read aloud, in Hindi if they like, for listening on the way. */
@Component({
  selector: 'app-listen',
  imports: [FormsModule, RouterLink],
  templateUrl: './listen.html',
  styleUrl: './listen.scss',
  host: { class: 'bs' },
})
export class Listen {
  private api = inject(StudentService);
  protected speech = inject(SpeechService);

  source = signal<Source>('mistakes');
  mode = signal<Mode>('hindi');
  withQuestion = signal(true);
  count = signal(20);
  exam = signal('');
  cards = signal<ReviseCard[]>([]);
  exams = signal<ReviseExam[]>([]);
  total = signal(0);
  loading = signal(false);
  loaded = signal(false);
  error = signal('');

  current = computed(() => this.cards()[this.speech.index()] ?? null);
  readonly rates = [0.75, 0.9, 1, 1.15, 1.3, 1.5];

  constructor() {
    inject(DestroyRef).onDestroy(() => this.speech.stop());
    this.load();
  }

  load() {
    this.speech.stop();
    this.loading.set(true);
    this.error.set('');
    this.api.revise(this.source(), this.count(), this.exam()).subscribe({
      next: (d) => {
        this.cards.set(d.cards);
        this.total.set(d.total);
        this.exams.set(d.exams ?? []);
        this.loading.set(false);
        this.loaded.set(true);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(e));
      },
    });
  }

  pickSource(s: Source) {
    this.source.set(s);
    this.exam.set('');
    this.load();
  }

  play(from = 0) {
    const cards = this.cards();
    if (!cards.length) return;
    this.speech.start(
      cards.map((c) => clipsFor(c, this.mode(), this.withQuestion())),
      from,
      (i) => `${i + 1} of ${cards.length}: ${cards[i]?.subject || cards[i]?.exam_title || 'Question'}`,
    );
  }

  rateChanged(value: string) {
    this.speech.setRate(Number(value));
  }

  text(card: ReviseCard) {
    return card.text_hi || card.text;
  }
}
