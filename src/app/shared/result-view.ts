import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { LangSwitch, Lang, LanguageService, pick } from './language';
import { MatDialog } from '@angular/material/dialog';
import { formatDuration, formatSeconds } from '../features/student/student.models';
import { ImageViewer } from './image-viewer';
import { ResultData } from './result.models';

/** Result and question-by-question review. Shared by the student and admin screens. */
@Component({
  selector: 'app-result-view',
  imports: [DatePipe, LangSwitch],
  templateUrl: './result-view.html',
  styleUrl: './result-view.scss',
  host: { class: 'bs' },
})
export class ResultView {
  data = input.required<ResultData>();
  /** On a student's own review: show Save and Report buttons under each question. */
  canAct = input(false);
  saveToggle = output<number>();
  report = output<number>();
  /** Show an "Ask a doubt" button under each question (the page that uses this component opens the dialog). */
  doubtEnabled = input(false);
  doubt = output<number>();
  private langs = inject(LanguageService);
  private dialog = inject(MatDialog);

  /** Questions the student is trying again right now: question number to the option picked this time (null before choosing). Nothing is saved or scored. */
  retry = signal<Record<number, { picked: number | null }>>({});

  startRetry(number: number) {
    this.retry.update((r) => ({ ...r, [number]: { picked: null } }));
  }

  pickRetry(number: number, optionId: number) {
    if (this.retry()[number]?.picked !== null) return; // one go at a time; "Try again" resets it
    this.retry.update((r) => ({ ...r, [number]: { picked: optionId } }));
  }

  stopRetry(number: number) {
    this.retry.update(({ [number]: _gone, ...rest }) => rest);
  }

  isRetryCorrect(q: ResultData['questions'][number], picked: number) {
    return q.options.some((o) => o.id === picked && o.is_correct);
  }

  /** Opens the question picture at full size. */
  zoom(src: string) {
    ImageViewer.open(this.dialog, src);
  }
  /** Languages that appear anywhere in this test. */
  languages = computed<Lang[]>(() => {
    const qs = this.data().questions;
    return [...(qs.some((q) => q.text) ? ['en' as const] : []), ...(qs.some((q) => q.text_hi) ? ['hi' as const] : [])];
  });
  lang = computed<Lang>(() => (this.languages().includes(this.langs.lang()) ? this.langs.lang() : (this.languages()[0] ?? 'en')));
  say = (en?: string, hi?: string) => pick(en, hi, this.lang());
  filter = signal<'all' | 'correct' | 'incorrect' | 'unanswered'>('all');
  duration = formatDuration;
  short = formatSeconds;
  maxTime = computed(() => Math.max(1, ...this.data().questions.map((q) => q.time_spent_seconds)));
  shown = computed(() => {
    const f = this.filter();
    const qs = this.data().questions;
    return f === 'all' || !this.data().solutions_available ? qs : qs.filter((q) => q.status === f);
  });
}
