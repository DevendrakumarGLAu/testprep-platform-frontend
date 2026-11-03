import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
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
  templateUrl: './captcha-field.html',
  styleUrl: './captcha-field.scss',
  host: { class: 'bs' },
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
