import { HttpClient } from '@angular/common/http';
import { Component, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { apiErrorMessage } from '../../core/models';
import { PlatformService } from '../../core/platform.service';
import { AuthLayout } from './auth-layout';
import { CaptchaField } from './captcha-field';

const AUTH = `${environment.apiUrl}/auth`;

/** "Forgot password?": asks for the email address and sends a link. The reply never says whether the address has an account. */
@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, AuthLayout, CaptchaField],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
  host: { class: 'bs' },
})
export class ForgotPassword {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private captcha = viewChild.required(CaptchaField);
  platform = inject(PlatformService);

  loading = signal(false);
  error = signal('');
  sent = signal('');
  form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]] });

  /** True when the address should show its error: it is wrong and the person has been to it or tried to send. */
  get emailInvalid() {
    const email = this.form.controls.email;
    return email.invalid && (email.touched || email.dirty);
  }

  send() {
    if (this.form.invalid) return this.form.markAllAsTouched();
    if (!this.captcha().ready()) return this.error.set('Type the characters shown in the picture.');
    this.loading.set(true);
    this.error.set('');
    this.http.post<{ detail: string }>(`${AUTH}/forgot-password/`, { email: this.form.getRawValue().email.trim(), ...this.captcha().payload() }).subscribe({
      next: (r) => {
        this.loading.set(false);
        this.sent.set(r.detail);
      },
      error: (e) => {
        this.loading.set(false);
        this.captcha().refresh();
        this.error.set(apiErrorMessage(e));
      },
    });
  }
}
