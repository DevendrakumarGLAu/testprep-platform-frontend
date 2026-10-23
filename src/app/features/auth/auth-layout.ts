import { Component, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { PlatformService } from '../../core/platform.service';

/**
 * The frame around the sign-in and registration forms: a brand panel on the left (a banner on small screens) and the form
 * on the right. The form and the links below it are projected in.
 */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterLink, MatIconModule],
  styleUrl: './auth-layout.scss',
  template: `
    <div class="auth-page">
      <aside class="brand-panel">
        <a class="brand-logo" routerLink="/"><img src="favicon.svg" alt="" width="40" height="40" /> {{ platform.info().platform_name }}</a>
        <div class="brand-copy">
          <h2>Practise like it's the real exam.</h2>
          <p>Mock tests, subject-wise practice and previous year papers, with a detailed analysis after every attempt.</p>
          <ul>
            <li><mat-icon inline>check_circle</mat-icon> Real exam pattern and negative marking</li>
            <li><mat-icon inline>translate</mat-icon> Questions in Hindi and English</li>
            <li><mat-icon inline>insights</mat-icon> Accuracy and time-per-question analysis</li>
          </ul>
        </div>
        <span class="brand-foot">© {{ year }} {{ platform.info().platform_name }}</span>
      </aside>

      <main class="form-panel">
        <div class="form-box">
          <a class="home-link" routerLink="/"><mat-icon inline>arrow_back</mat-icon> Back to home</a>
          <h1>{{ heading() }}</h1>
          @if (sub()) { <p class="form-sub">{{ sub() }}</p> }
          <ng-content />
        </div>
      </main>
    </div>
  `,
})
export class AuthLayout {
  heading = input.required<string>();
  sub = input('');
  platform = inject(PlatformService);
  year = new Date().getFullYear();
}
