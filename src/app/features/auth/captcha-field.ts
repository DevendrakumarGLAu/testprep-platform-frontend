import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { environment } from '../../../environments/environment';

interface CaptchaResponse {
  enabled: boolean;
  token?: string;
  image?: string;
}

/**
 * The image captcha for the sign-in and registration forms. It fetches its own picture, shows nothing when the server has
 * the captcha switched off, and hands the form its answer through payload(). Call refresh() after a failed attempt:
 * every picture can be tried only once.
 */
@Component({
  selector: 'app-captcha',
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  styles: `
    .pic { display: flex; align-items: center; gap: 4px; margin-bottom: 8px; }
    img { border: 1px solid var(--mat-sys-outline-variant); border-radius: 8px; max-width: 100%; height: 56px; background: #fff; }
  `,
  template: `
    @if (enabled()) {
      <div class="pic">
        @if (image()) { <img [src]="image()" alt="Captcha picture with 5 characters" width="180" height="56" /> }
        <button mat-icon-button type="button" (click)="refresh()" aria-label="Show a different picture"><mat-icon>refresh</mat-icon></button>
      </div>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Type the characters you see</mat-label>
        <input matInput [value]="answer()" (input)="answer.set($any($event.target).value)" autocomplete="off"
          autocapitalize="characters" spellcheck="false" maxlength="8" />
      </mat-form-field>
    }
  `,
})
export class CaptchaField {
  private http = inject(HttpClient);

  enabled = signal(false);
  image = signal('');
  answer = signal('');
  private token = '';

  constructor() {
    this.refresh();
  }

  refresh() {
    this.answer.set('');
    this.http.get<CaptchaResponse>(`${environment.apiUrl}/auth/captcha/`).subscribe({
      next: (c) => {
        this.enabled.set(c.enabled);
        this.token = c.token ?? '';
        this.image.set(c.image ?? '');
      },
      error: () => {
        // Could not reach the server: leave the field out of the way; the sign-in request itself will report the problem.
        this.enabled.set(false);
        this.token = '';
      },
    });
  }

  /** False while the captcha is on and nothing has been typed. */
  ready(): boolean {
    return !this.enabled() || this.answer().trim().length > 0;
  }

  /** The two fields the server expects, or nothing when the captcha is off. */
  payload(): Record<string, string> {
    return this.enabled() ? { captcha_token: this.token, captcha_answer: this.answer().trim() } : {};
  }
}
