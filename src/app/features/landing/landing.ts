import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { PlatformService } from '../../core/platform.service';

interface HomeData {
  stats: { tests: number; questions: number; students: number };
  exams: { id: string; name: string; description: string; tests: number; subjects: string[] }[];
}

const FEATURES = [
  { icon: 'assignment', title: 'Full-length mock tests', text: 'Practise in the real exam pattern, with the same number of questions, timing and negative marking.' },
  { icon: 'category', title: 'Subject-wise tests', text: 'Work on one subject at a time, such as Maths, GK, Reasoning or English, and fix your weak spots.' },
  { icon: 'history_edu', title: 'Previous year papers', text: 'Solve papers from earlier years, with each question dated so you know how recent it is.' },
  { icon: 'translate', title: 'Hindi and English', text: 'Read every question in the language you are comfortable with and switch whenever you like.' },
  { icon: 'insights', title: 'Detailed analysis', text: 'See your accuracy, section-wise marks and the time you spent on each question after every test.' },
  { icon: 'timer', title: 'Timed sections', text: 'Sections open one after another with their own timers, just like the real SSC-style exam.' },
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
  imports: [RouterLink, MatButtonModule, MatIconModule, MatExpansionModule],
  styleUrl: './landing.scss',
  template: `
    <header class="top">
      <div class="wrap bar">
        <a class="logo" routerLink="/" aria-label="Home"><img src="favicon.svg" alt="" width="32" height="32" /> {{ platform.info().platform_name }}</a>
        <nav class="links" aria-label="Sections">
          <a href="#exams" (click)="go($event, 'exams')">Exams</a>
          <a href="#features" (click)="go($event, 'features')">Features</a>
          <a href="#how" (click)="go($event, 'how')">How it works</a>
          <a href="#faq" (click)="go($event, 'faq')">FAQ</a>
        </nav>
        <div class="actions">
          @if (auth.isLoggedIn()) {
            <a mat-flat-button [routerLink]="auth.homeRoute()">Go to dashboard</a>
          } @else {
            <a mat-button routerLink="/login">Log in</a>
            @if (platform.info().allow_registration) { <a mat-flat-button routerLink="/register">Sign up free</a> }
          }
        </div>
      </div>
    </header>

    <main>
      <section class="hero">
        <div class="wrap hero-grid">
          <div>
            <span class="pill"><mat-icon inline>translate</mat-icon> Hindi + English · Free mock tests</span>
            <h1>Prepare smarter.<br /><em>Crack your exam.</em></h1>
            <p class="lead">Mock tests, subject-wise practice and previous year papers in the real exam pattern, with a detailed analysis after every attempt.</p>
            <div class="cta">
              @if (auth.isLoggedIn()) {
                <a mat-flat-button class="big" [routerLink]="auth.homeRoute()">Continue practising</a>
              } @else if (platform.info().allow_registration) {
                <a mat-flat-button class="big" routerLink="/register">Start practising free</a>
                <a mat-stroked-button class="big" routerLink="/login">I already have an account</a>
              } @else {
                <a mat-flat-button class="big" routerLink="/login">Log in</a>
              }
            </div>
            <ul class="ticks">
              <li><mat-icon inline>check_circle</mat-icon> Real exam pattern and negative marking</li>
              <li><mat-icon inline>check_circle</mat-icon> Attempt as many times as you like</li>
              <li><mat-icon inline>check_circle</mat-icon> Solutions and time-per-question analysis</li>
            </ul>
          </div>
          <div class="preview" aria-hidden="true">
            <div class="card result">
              <div class="row"><strong>SSC Full Test 1</strong><span class="chip">Attempt 3</span></div>
              <div class="score"><span class="big-n">78.5</span><span>/ 100 marks</span></div>
              <div class="bars">
                <div><span>Maths</span><i style="--w: 82%"></i></div>
                <div><span>GK</span><i style="--w: 70%"></i></div>
                <div><span>Reasoning</span><i style="--w: 88%"></i></div>
                <div><span>English</span><i style="--w: 64%"></i></div>
              </div>
              <div class="mini"><span><mat-icon inline>check_circle</mat-icon> 80 correct</span><span><mat-icon inline>cancel</mat-icon> 14 wrong</span><span><mat-icon inline>timer</mat-icon> 54 min</span></div>
            </div>
            <div class="card float"><mat-icon>translate</mat-icon> <span>हिन्दी / English</span></div>
          </div>
        </div>
      </section>

      @if (numbers().length) {
        <section class="stats">
          <div class="wrap">
            @for (s of numbers(); track s.label) {
              <div><strong>{{ s.value }}</strong><span>{{ s.label }}</span></div>
            }
          </div>
        </section>
      }

      <section id="exams" class="block">
        <div class="wrap">
          <h2>Choose your exam</h2>
          <p class="sub">Tests for the exams students are preparing for right now.</p>
          @if (exams().length) {
            <div class="exam-grid">
              @for (e of exams(); track e.name) {
                <article class="card exam">
                  <div class="avatar" aria-hidden="true">{{ e.name.charAt(0) }}</div>
                  <h3>{{ e.name }}</h3>
                  @if (e.description) { <p class="desc">{{ e.description }}</p> }
                  <p class="count">{{ e.tests }} {{ e.tests === 1 ? 'free test' : 'free tests' }}</p>
                  @if (e.subjects.length) {
                    <div class="chips">@for (s of e.subjects; track s) { <span class="chip">{{ s }}</span> }</div>
                  }
                  <a mat-stroked-button [routerLink]="['/exam', e.id]">See the tests</a>
                </article>
              }
            </div>
          } @else {
            <p class="soon">Exams will appear here as soon as the first tests are published.</p>
          }
        </div>
      </section>

      <section id="features" class="block alt">
        <div class="wrap">
          <h2>Everything you need to practise</h2>
          <p class="sub">Built around how real exams work.</p>
          <div class="feature-grid">
            @for (f of features; track f.title) {
              <article class="card feature">
                <div class="ico"><mat-icon>{{ f.icon }}</mat-icon></div>
                <h3>{{ f.title }}</h3>
                <p>{{ f.text }}</p>
              </article>
            }
          </div>
        </div>
      </section>

      <section id="how" class="block">
        <div class="wrap">
          <h2>How it works</h2>
          <div class="steps">
            @for (s of steps; track s.n) {
              <div class="step"><span class="num">{{ s.n }}</span><h3>{{ s.title }}</h3><p>{{ s.text }}</p></div>
            }
          </div>
        </div>
      </section>

      <section id="faq" class="block alt">
        <div class="wrap narrow">
          <h2>Questions students ask</h2>
          <mat-accordion displayMode="flat">
            @for (f of faq; track f.q) {
              <mat-expansion-panel>
                <mat-expansion-panel-header><mat-panel-title>{{ f.q }}</mat-panel-title></mat-expansion-panel-header>
                <p>{{ f.a }}</p>
              </mat-expansion-panel>
            }
          </mat-accordion>
        </div>
      </section>

      <section class="final">
        <div class="wrap">
          <h2>Ready for your next mock test?</h2>
          <p>Join and start practising today.</p>
          @if (auth.isLoggedIn()) {
            <a mat-flat-button class="big light" [routerLink]="auth.homeRoute()">Go to dashboard</a>
          } @else if (platform.info().allow_registration) {
            <a mat-flat-button class="big light" routerLink="/register">Create free account</a>
          } @else {
            <a mat-flat-button class="big light" routerLink="/login">Log in</a>
          }
        </div>
      </section>
    </main>

    <footer class="foot">
      <div class="wrap">
        <span class="logo"><img src="favicon.svg" alt="" width="24" height="24" /> {{ platform.info().platform_name }}</span>
        <nav aria-label="Footer">
          <a routerLink="/login">Log in</a>
          @if (platform.info().allow_registration) { <a routerLink="/register">Sign up</a> }
          @if (platform.info().support_email) { <a [href]="'mailto:' + platform.info().support_email">{{ platform.info().support_email }}</a> }
        </nav>
        <span class="copy">© {{ year }} {{ platform.info().platform_name }}. All rights reserved.</span>
      </div>
    </footer>
  `,
})
export class Landing {
  platform = inject(PlatformService);
  auth = inject(AuthService);
  private http = inject(HttpClient);

  features = FEATURES;
  steps = STEPS;
  faq = FAQ;
  year = new Date().getFullYear();
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

  go(event: Event, id: string) {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
