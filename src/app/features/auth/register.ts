import { Component, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { PlatformService } from '../../core/platform.service';
import { AuthLayout } from './auth-layout';
import { CaptchaField } from './captcha-field';

@Component({
  selector: 'app-register',
  imports: [
    ReactiveFormsModule, RouterLink, AuthLayout, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatProgressSpinnerModule, CaptchaField,
  ],
  styleUrl: './auth.scss',
  template: `
    <app-auth-layout heading="Create student account" sub="Free to join. Start practising in a minute.">
      @if (!platform.info().allow_registration) {
        <p role="alert">Registration is closed. Please ask your administrator to create an account for you.</p>
      }
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate [hidden]="!platform.info().allow_registration">
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>First name</mat-label>
            <input matInput formControlName="first_name" autocomplete="given-name" />
            <mat-error>Required</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Last name</mat-label>
            <input matInput formControlName="last_name" autocomplete="family-name" />
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>Username</mat-label>
          <input matInput formControlName="username" autocomplete="username" />
          <mat-error>Required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email" />
          <mat-error>A valid email is required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Password</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="new-password" />
          <mat-hint>At least 8 characters, not too common</mat-hint>
          <mat-error>Password must be at least 8 characters</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Confirm password</mat-label>
          <input matInput type="password" formControlName="confirm" autocomplete="new-password" />
          @if (form.controls.confirm.hasError('mismatch')) {
            <mat-error>Passwords do not match</mat-error>
          }
        </mat-form-field>
        <app-captcha />
        @if (error()) {
          <p class="form-error" role="alert">{{ error() }}</p>
        }
        <button mat-flat-button type="submit" [disabled]="loading()">
          @if (loading()) { <mat-spinner diameter="20" /> } @else { Register }
        </button>
      </form>
      <p class="switch">Already registered? <a routerLink="/login">Sign in</a></p>
    </app-auth-layout>
  `,
})
export class Register {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private notify = inject(NotifyService);
  platform = inject(PlatformService);

  private captcha = viewChild.required(CaptchaField);
  loading = signal(false);
  error = signal('');

  form = this.fb.nonNullable.group({
    first_name: ['', Validators.required],
    last_name: [''],
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', Validators.required],
  });

  constructor() {
    const { password, confirm } = this.form.controls;
    const check = () =>
      confirm.setErrors(
        confirm.value && confirm.value !== password.value ? { mismatch: true } : confirm.hasError('required') ? { required: true } : null,
      );
    password.valueChanges.subscribe(check);
    confirm.valueChanges.subscribe(check);
  }

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
    const { confirm, ...payload } = this.form.getRawValue();
    this.auth.register({ ...payload, ...this.captcha().payload() }).subscribe({
      next: () => {
        this.notify.success('Account created. Please sign in.');
        this.router.navigateByUrl('/login');
      },
      error: (err) => {
        this.loading.set(false);
        this.captcha().refresh();
        this.error.set(apiErrorMessage(err));
      },
    });
  }
}
