import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { PlatformService } from '../../core/platform.service';

interface PublicExam {
  id: string;
  name: string;
  description: string;
  subjects: string[];
  tests: { title: string; type: string; questions: number; minutes: number; premium: boolean; year: number | null }[];
}

/** A public page for one exam (for example SSC): what it covers and the tests on offer, with a button to sign up. Visible without signing in. */
@Component({
  selector: 'app-public-exam',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule],
  styles: `
    :host { display: block; min-height: 100vh; background: var(--mat-sys-surface-container-low); }
    header { background: var(--mat-sys-surface); border-bottom: 1px solid var(--mat-sys-outline-variant); }
    header .wrap { display: flex; align-items: center; justify-content: space-between; height: 60px; }
    .wrap { max-width: 900px; margin: 0 auto; padding: 0 20px; }
    .logo { display: inline-flex; align-items: center; gap: 8px; font: var(--mat-sys-title-large); font-weight: 700; color: var(--mat-sys-primary); text-decoration: none; }
    main { padding: 32px 0 56px; }
    h1 { font-size: clamp(1.8rem, 4vw, 2.6rem); margin: 8px 0; }
    .lead { color: var(--mat-sys-on-surface-variant); font-size: 1.1rem; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0; }
    .chip { padding: 2px 12px; border-radius: 999px; background: var(--mat-sys-secondary-container); color: var(--mat-sys-on-secondary-container); font-size: 0.85rem; }
    mat-card { margin-bottom: 10px; }
    .test { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .meta { color: var(--mat-sys-on-surface-variant); font-size: 0.9em; }
    .prem { color: #b26a00; margin-left: 6px; }
    .cta { text-align: center; margin-top: 28px; }
    .soon { color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <header><div class="wrap">
      <a class="logo" routerLink="/"><img src="favicon.svg" alt="" width="28" height="28" /> {{ platform.info().platform_name }}</a>
      @if (auth.isLoggedIn()) { <a mat-flat-button [routerLink]="auth.homeRoute()">Go to dashboard</a> }
      @else { <a mat-button routerLink="/login">Log in</a> }
    </div></header>
    <main><div class="wrap">
      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
      @if (exam(); as e) {
        <a mat-button routerLink="/"><mat-icon>arrow_back</mat-icon> All exams</a>
        <h1>{{ e.name }} mock tests</h1>
        @if (e.description) { <p class="lead">{{ e.description }}</p> }
        @if (e.subjects.length) { <div class="chips">@for (s of e.subjects; track s) { <span class="chip">{{ s }}</span> }</div> }
        <h2>Tests</h2>
        @for (t of e.tests; track t.title) {
          <mat-card appearance="outlined"><mat-card-content class="test">
            <div>
              <strong>{{ t.title }}</strong>@if (t.premium) { <span class="prem"><mat-icon inline>workspace_premium</mat-icon> Premium</span> }
              <div class="meta">{{ t.type }}{{ t.year ? ' ' + t.year : '' }} · {{ t.questions }} questions · {{ t.minutes }} minutes</div>
            </div>
          </mat-card-content></mat-card>
        } @empty { <p class="soon">Tests for {{ e.name }} will appear here soon.</p> }
        <div class="cta">
          @if (auth.isLoggedIn()) { <a mat-flat-button class="big" [routerLink]="auth.homeRoute()">Open my dashboard</a> }
          @else if (platform.info().allow_registration) { <a mat-flat-button class="big" routerLink="/register">Sign up free to start practising</a> }
          @else { <a mat-flat-button class="big" routerLink="/login">Log in to start</a> }
        </div>
      } @else if (!loading()) {
        <h1>Exam not found</h1>
        <a mat-flat-button routerLink="/">Back to home</a>
      }
    </div></main>
  `,
})
export class PublicExamPage {
  id = input.required<string>();
  platform = inject(PlatformService);
  auth = inject(AuthService);
  private http = inject(HttpClient);
  private title = inject(Title);

  loading = signal(true);
  exam = signal<PublicExam | null>(null);

  constructor() {
    effect(() => {
      this.loading.set(true);
      this.http.get<PublicExam>(`${environment.apiUrl}/public/exams/${this.id()}/`).subscribe({
        next: (e) => {
          this.exam.set(e);
          this.title.setTitle(`${e.name} mock tests | ${this.platform.info().platform_name}`);
          this.loading.set(false);
        },
        error: () => {
          this.exam.set(null);
          this.loading.set(false);
        },
      });
    });
  }
}
