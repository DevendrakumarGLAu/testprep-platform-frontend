import { Component, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/models';
import { PlatformService } from '../../core/platform.service';
import { AuthLayout } from './auth-layout';
import { CaptchaField } from './captcha-field';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule, RouterLink, AuthLayout, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, CaptchaField,
  ],
  styleUrl: './auth.scss',
  template: `
    <app-auth-layout heading="Sign in" [sub]="'Welcome back to ' + platform.info().platform_name">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <mat-form-field appearance="outline">
          <mat-label>Username or email</mat-label>
          <input matInput formControlName="username" autocomplete="username" />
          @if (form.controls.username.hasError('required')) {
            <mat-error>Username or email is required</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Password</mat-label>
          <input matInput [type]="hide() ? 'password' : 'text'" formControlName="password" autocomplete="current-password" />
          <button mat-icon-button matSuffix type="button" (click)="hide.set(!hide())" [attr.aria-label]="'Toggle password visibility'">
            <mat-icon>{{ hide() ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          @if (form.controls.password.hasError('required')) {
            <mat-error>Password is required</mat-error>
          }
        </mat-form-field>
        <app-captcha />
        <p class="forgot">
          @if (platform.info().email_enabled) { <a routerLink="/forgot-password">Forgot password?</a> }
          @else { <span>Forgot your password? Ask your administrator to reset it.</span> }
        </p>
        @if (error()) {
          <p class="form-error" role="alert">{{ error() }}</p>
        }
        <button mat-flat-button type="submit" [disabled]="loading()">
          @if (loading()) { <mat-spinner diameter="20" /> } @else { Sign in }
        </button>
      </form>
      <p class="switch">
        @if (platform.info().allow_registration) {
          New student? <a routerLink="/register">Create an account</a>
        } @else {
          Need an account? Ask your administrator.
        }
      </p>
    </app-auth-layout>
  `,
})
export class Login {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  platform = inject(PlatformService);

  private captcha = viewChild.required(CaptchaField);
  hide = signal(true);
  loading = signal(false);
  error = signal('');

  form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.captcha().ready()) {
      this.error.set('Type the characters shown in the picture.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const { username, password } = this.form.getRawValue();
    this.auth.login(username.trim(), password, this.captcha().payload()).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        const home = this.auth.homeRoute();
        if (this.auth.user()?.must_change_password) {
          this.router.navigateByUrl(`${home}/profile`); // a temporary password has to be replaced first
          return;
        }
        // Only follow a return URL that stays inside the area this role may enter.
        this.router.navigateByUrl(returnUrl && returnUrl.startsWith(home) ? returnUrl : home);
      },
      error: (err) => {
        this.loading.set(false);
        this.captcha().refresh(); // each picture can be tried only once
        this.error.set(
          err.status === 401 ? 'Invalid credentials, or the account is inactive.' : apiErrorMessage(err),
        );
      },
    });
  }
}
