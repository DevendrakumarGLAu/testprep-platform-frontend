import { HttpClient } from '@angular/common/http';
import { Component, inject, input, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { PlatformService } from '../../core/platform.service';
import { AuthLayout } from './auth-layout';
import { CaptchaField } from './captcha-field';

const AUTH = `${environment.apiUrl}/auth`;

/** "Forgot password?": asks for the email address and sends a link. The reply never says whether the address has an account. */
@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, AuthLayout, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule, CaptchaField],
  styleUrl: './auth.scss',
  template: `
    <app-auth-layout heading="Forgot your password?" sub="Enter your email address and we will send you a link to choose a new one.">
      @if (!platform.info().email_enabled && platform.loaded()) {
        <p class="form-error" role="alert">Emails are not set up on this site. Ask your administrator to reset your password for you.</p>
      }
      @if (sent()) {
        <p role="status">{{ sent() }}</p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="send()" novalidate>
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="email" />
            <mat-error>Enter a valid email address</mat-error>
          </mat-form-field>
          <app-captcha />
          @if (error()) { <p class="form-error" role="alert">{{ error() }}</p> }
          <button mat-flat-button type="submit" [disabled]="loading()">
            @if (loading()) { <mat-spinner diameter="20" /> } @else { Send the link }
          </button>
        </form>
      }
      <p class="switch"><a routerLink="/login">Back to sign in</a></p>
    </app-auth-layout>
  `,
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

/** The page the emailed link opens: choose a new password. */
@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, AuthLayout, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule],
  styleUrl: './auth.scss',
  template: `
    <app-auth-layout heading="Choose a new password" sub="Pick a password you have not used before.">
      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <mat-form-field appearance="outline">
          <mat-label>New password</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="new-password" />
          <mat-hint>At least 8 characters, not too common</mat-hint>
          <mat-error>Password must be at least 8 characters</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Confirm new password</mat-label>
          <input matInput type="password" formControlName="confirm" autocomplete="new-password" />
          @if (form.controls.confirm.hasError('mismatch')) { <mat-error>Passwords do not match</mat-error> }
        </mat-form-field>
        @if (error()) { <p class="form-error" role="alert">{{ error() }} <a routerLink="/forgot-password">Ask for a new link</a></p> }
        <button mat-flat-button type="submit" [disabled]="loading()">
          @if (loading()) { <mat-spinner diameter="20" /> } @else { Change password }
        </button>
      </form>
    </app-auth-layout>
  `,
})
export class ResetPassword {
  uid = input.required<string>();
  token = input.required<string>();
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private notify = inject(NotifyService);

  loading = signal(false);
  error = signal('');
  form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', Validators.required],
  });

  constructor() {
    const { password, confirm } = this.form.controls;
    const check = () => confirm.setErrors(confirm.value && confirm.value !== password.value ? { mismatch: true } : confirm.hasError('required') ? { required: true } : null);
    password.valueChanges.subscribe(check);
    confirm.valueChanges.subscribe(check);
  }

  save() {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.loading.set(true);
    this.error.set('');
    this.http.post<{ detail: string }>(`${AUTH}/reset-password/`, { uid: this.uid(), token: this.token(), new_password: this.form.getRawValue().password }).subscribe({
      next: (r) => {
        this.notify.success(r.detail);
        this.router.navigateByUrl('/login');
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(e));
      },
    });
  }
}

/** The page the confirmation link opens. It confirms the address straight away. */
@Component({
  selector: 'app-verify-email',
  imports: [RouterLink, AuthLayout, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  styleUrl: './auth.scss',
  template: `
    <app-auth-layout heading="Confirming your email">
      @if (state() === 'working') {
        <p><mat-spinner diameter="28" /></p>
      } @else if (state() === 'ok') {
        <p role="status"><mat-icon inline>check_circle</mat-icon> {{ message() }}</p>
        <a mat-flat-button routerLink="/login">Continue</a>
      } @else {
        <p class="form-error" role="alert">{{ message() }}</p>
        <a mat-stroked-button routerLink="/login">Go to sign in</a>
      }
    </app-auth-layout>
  `,
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
