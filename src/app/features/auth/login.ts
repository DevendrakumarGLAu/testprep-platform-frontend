import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/models';
import { PlatformService } from '../../core/platform.service';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  styleUrl: './auth.scss',
  template: `
    <main class="auth-page">
      <mat-card class="auth-card">
        <mat-card-header>
          <mat-card-title>Sign in</mat-card-title>
          <mat-card-subtitle>Welcome back to {{ platform.info().platform_name }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
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
            @if (error()) {
              <p class="form-error" role="alert">{{ error() }}</p>
            }
            <button mat-flat-button type="submit" [disabled]="loading()">
              @if (loading()) { <mat-spinner diameter="20" /> } @else { Sign in }
            </button>
          </form>
        </mat-card-content>
        <mat-card-actions>
          @if (platform.info().allow_registration) {
            <span>New student?</span> <a routerLink="/register">Create an account</a>
          } @else {
            <span>Need an account? Ask your administrator.</span>
          }
        </mat-card-actions>
      </mat-card>
    </main>
  `,
})
export class Login {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  platform = inject(PlatformService);

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
    this.loading.set(true);
    this.error.set('');
    const { username, password } = this.form.getRawValue();
    this.auth.login(username.trim(), password).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        const home = this.auth.homeRoute();
        // Only follow a return URL that stays inside the area this role may enter.
        this.router.navigateByUrl(returnUrl && returnUrl.startsWith(home) ? returnUrl : home);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err.status === 401 ? 'Invalid credentials, or the account is inactive.' : apiErrorMessage(err),
        );
      },
    });
  }
}
