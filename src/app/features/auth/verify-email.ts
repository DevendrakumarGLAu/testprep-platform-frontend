import { HttpClient } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { apiErrorMessage } from '../../core/models';
import { AuthLayout } from './auth-layout';

const AUTH = `${environment.apiUrl}/auth`;

/** The page the confirmation link opens. It confirms the address straight away. */
@Component({
  selector: 'app-verify-email',
  imports: [RouterLink, AuthLayout],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.scss',
  host: { class: 'bs' },
})
export class VerifyEmail {
  token = input.required<string>();
  private http = inject(HttpClient);

  state = signal<'working' | 'ok' | 'failed'>('working');
  message = signal('');

  constructor() {
    queueMicrotask(() =>
      this.http.post<{ detail: string }>(`${AUTH}/verify-email/`, { token: this.token() }).subscribe({
        next: (r) => {
          this.message.set(r.detail);
          this.state.set('ok');
        },
        error: (e) => {
          this.message.set(apiErrorMessage(e));
          this.state.set('failed');
        },
      }),
    );
  }
}
