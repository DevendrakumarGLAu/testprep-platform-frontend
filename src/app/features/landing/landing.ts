import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupportLine } from '../../shared/support-line/support-line';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { PlatformService } from '../../core/platform.service';

interface HomeData {
  stats: { tests: number; questions: number; students: number };
  exams: { id: string; name: string; description: string; tests: number; subjects: string[] }[];
}

const FEATURES = [
  { icon: 'bi-clipboard-check', title: 'Full-length mock tests', text: 'Practise in the real exam pattern, with the same number of questions, timing and negative marking.' },
  { icon: 'bi-tags', title: 'Subject-wise tests', text: 'Work on one subject at a time, such as Maths, GK, Reasoning or English, and fix your weak spots.' },
  { icon: 'bi-journal-bookmark', title: 'Previous year papers', text: 'Solve papers from earlier years, with each question dated so you know how recent it is.' },
  { icon: 'bi-translate', title: 'Hindi and English', text: 'Read every question in the language you are comfortable with and switch whenever you like.' },
  { icon: 'bi-graph-up', title: 'Detailed analysis', text: 'See your accuracy, section-wise marks and the time you spent on each question after every test.' },
  { icon: 'bi-stopwatch', title: 'Timed sections', text: 'Sections open one after another with their own timers, just like the real SSC-style exam.' },
];

const STEPS = [
  { n: 1, title: 'Create your free account', text: 'Sign up in a minute with your name and email.' },
  { n: 2, title: 'Pick the exam you are preparing for', text: 'See its full tests, subject tests and previous year papers in one place.' },
  { n: 3, title: 'Take a test and review it', text: 'Attempt as many times as you want, then study the solutions and your analysis.' },
];

const FAQ = [
  { q: 'Is it free to practise?', a: 'You can create an account for free and attempt the tests that are open to everyone.' },
  { q: 'Can I take a test more than once?', a: 'Yes. Most tests allow unlimited attempts, and each attempt is scored and kept in your history.' },
  { q: 'How is negative marking applied?', a: 'Every test shows its own rule before you start, for example one third of the marks for a wrong answer, exactly as in the real exam.' },
  { q: 'Which languages are available?', a: 'Questions are available in English, Hindi or both, and you can switch the language during the test.' },
  { q: 'What happens if my internet drops during a test?', a: 'Your answers are saved as you go and the timer runs on our server, so you can reopen the test and carry on from where you were.' },
];

/** The public home page: what the platform offers, which exams are available, and how to start. */
@Component({
  selector: 'app-landing',
  imports: [RouterLink, SupportLine],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
  host: { class: 'bs' },
})
export class Landing {
  platform = inject(PlatformService);
  auth = inject(AuthService);
  private http = inject(HttpClient);

  features = FEATURES;
  steps = STEPS;
  faq = FAQ;
  year = new Date().getFullYear();
  /** The question of the FAQ that is open, if any. */
  openFaq = signal<number | null>(null);
  home = signal<HomeData | null>(null);
  exams = computed(() => this.home()?.exams ?? []);
  numbers = computed(() => {
    const s = this.home()?.stats;
    if (!s) return [];
    const compact = (n: number) => (n >= 1000 ? `${Math.floor(n / 100) / 10}K+` : String(n));
    return [
      { value: compact(s.tests), label: 'Mock tests', show: s.tests > 0 },
      { value: compact(s.questions), label: 'Practice questions', show: s.questions > 0 },
      { value: compact(s.students), label: 'Students practising', show: s.students > 0 },
      { value: '2', label: 'Languages', show: true },
    ].filter((n) => n.show);
  });

  constructor() {
    this.http.get<HomeData>(`${environment.apiUrl}/public/home/`).subscribe({ next: (d) => this.home.set(d), error: () => undefined });
  }

  toggleFaq(i: number) {
    this.openFaq.update((o) => (o === i ? null : i));
  }

  go(event: Event, id: string) {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
