import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSelectModule } from '@angular/material/select';
import { THEME_LABEL, ThemeMode, ThemeService } from '../../core/theme.service';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { CaptchaField } from '../auth/captcha-field';

const PHONE = /^\+?[0-9][0-9 ()-]{6,18}[0-9]$/;

function phoneOk(c: AbstractControl): ValidationErrors | null {
  const v = (c.value ?? '').trim();
  return !v || PHONE.test(v) ? null : { phone: true };
}

const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin', student: 'Student' } as const;

/** "My profile": the signed-in person's own details and password. The same page serves students and admins. */
@Component({
  selector: 'app-profile',
  imports: [
    DatePipe, ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, CaptchaField, MatButtonToggleModule, MatSelectModule, MatCheckboxModule,
  ],
  styleUrl: './profile.scss',
  template: `
    @if (user(); as u) {
      <header class="who">
        <div class="avatar" aria-hidden="true">{{ initials() }}</div>
        <div>
          <h1>{{ fullName() }}</h1>
          <p class="sub">{{ roleLabel() }} · member since {{ u.date_joined | date: 'mediumDate' }}</p>
        </div>
      </header>

      <div class="grid">
        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>My details</mat-card-title></mat-card-header>
          <mat-card-content>
            <form [formGroup]="details" (ngSubmit)="saveDetails()" novalidate>
              <div class="row">
                <mat-form-field appearance="outline">
                  <mat-label>First name</mat-label>
                  <input matInput formControlName="first_name" autocomplete="given-name" maxlength="150" />
                  <mat-error>First name is required</mat-error>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Last name</mat-label>
                  <input matInput formControlName="last_name" autocomplete="family-name" maxlength="150" />
                </mat-form-field>
              </div>
              <mat-form-field appearance="outline">
                <mat-label>Phone</mat-label>
                <input matInput type="tel" formControlName="phone" autocomplete="tel" maxlength="20" />
                <mat-icon matSuffix>call</mat-icon>
                <mat-error>Enter a valid phone number</mat-error>
              </mat-form-field>
              @if (u.role === 'student') {
                <mat-form-field appearance="outline">
                  <mat-label>Daily goal (questions)</mat-label>
                  <mat-select formControlName="daily_goal_questions">
                    @for (n of goals; track n) { <mat-option [value]="n">{{ n }} questions a day</mat-option> }
                  </mat-select>
                  <mat-hint>Shown as a progress ring on your dashboard.</mat-hint>
                </mat-form-field>
                <mat-checkbox formControlName="weekly_summary">Send me a weekly summary of my practice</mat-checkbox>
              }
              <mat-form-field appearance="outline">
                <mat-label>Username</mat-label>
                <input matInput [value]="u.username" disabled />
                <mat-icon matSuffix>lock</mat-icon>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Email</mat-label>
                <input matInput [value]="u.email" disabled />
                <mat-icon matSuffix>lock</mat-icon>
                <mat-hint>
                  Username and email can only be changed by an administrator.
                  @if (u.email_verified) { Email confirmed. } @else { Email not confirmed yet. }
                </mat-hint>
              </mat-form-field>
              @if (detailsError()) { <p class="form-error" role="alert">{{ detailsError() }}</p> }
              <div class="actions">
                <button mat-flat-button type="submit" [disabled]="savingDetails() || details.pristine">
                  @if (savingDetails()) { <mat-spinner diameter="20" /> } @else { Save changes }
                </button>
                <button mat-button type="button" (click)="resetDetails()" [disabled]="details.pristine">Undo</button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Appearance</mat-card-title></mat-card-header>
          <mat-card-content>
            <mat-button-toggle-group [value]="theme.mode()" (change)="theme.set($event.value)" aria-label="Appearance" hideSingleSelectionIndicator>
              @for (m of modes; track m) { <mat-button-toggle [value]="m">{{ label[m] }}</mat-button-toggle> }
            </mat-button-toggle-group>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Change password</mat-card-title></mat-card-header>
          <mat-card-content>
            <form [formGroup]="password" (ngSubmit)="changePassword()" novalidate>
              <mat-form-field appearance="outline">
                <mat-label>Current password</mat-label>
                <input matInput type="password" formControlName="old_password" autocomplete="current-password" />
                <mat-error>Enter your current password</mat-error>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>New password</mat-label>
                <input matInput type="password" formControlName="new_password" autocomplete="new-password" />
                <mat-hint>At least 8 characters, not too common</mat-hint>
                <mat-error>Password must be at least 8 characters</mat-error>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Confirm new password</mat-label>
                <input matInput type="password" formControlName="confirm" autocomplete="new-password" />
                @if (password.controls.confirm.hasError('mismatch')) { <mat-error>Passwords do not match</mat-error> }
              </mat-form-field>
              <app-captcha />
              @if (passwordError()) { <p class="form-error" role="alert">{{ passwordError() }}</p> }
              <div class="actions">
                <button mat-flat-button type="submit" [disabled]="savingPassword()">
                  @if (savingPassword()) { <mat-spinner diameter="20" /> } @else { Update password }
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>
      </div>
    }
  `,
})
export class Profile {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);
  private captcha = viewChild.required(CaptchaField);
  theme = inject(ThemeService);
  readonly modes: ThemeMode[] = ['light', 'dark', 'auto'];
  readonly label = THEME_LABEL;
  readonly goals = [10, 20, 30, 50, 100];

  user = this.auth.user;
  fullName = computed(() => {
    const u = this.user();
    return u ? `${u.first_name} ${u.last_name}`.trim() || u.username : '';
  });
  initials = computed(() => {
    const u = this.user();
    if (!u) return '';
    const letters = (u.first_name[0] ?? '') + (u.last_name[0] ?? '');
    return (letters || u.username.slice(0, 2)).toUpperCase();
  });
  roleLabel = computed(() => ROLE_LABEL[this.user()?.role ?? 'student']);

  savingDetails = signal(false);
  savingPassword = signal(false);
  detailsError = signal('');
  passwordError = signal('');

  details = this.fb.nonNullable.group({
    first_name: [this.user()?.first_name ?? '', Validators.required],
    last_name: [this.user()?.last_name ?? ''],
    phone: [this.user()?.phone ?? '', phoneOk],
    daily_goal_questions: [this.user()?.daily_goal_questions ?? 20],
    weekly_summary: [this.user()?.weekly_summary ?? true],
  });

  password = this.fb.nonNullable.group({
    old_password: ['', Validators.required],
    new_password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', Validators.required],
  });

  constructor() {
    const { new_password, confirm } = this.password.controls;
    const check = () =>
      confirm.setErrors(
        confirm.value && confirm.value !== new_password.value ? { mismatch: true } : confirm.hasError('required') ? { required: true } : null,
      );
    new_password.valueChanges.subscribe(check);
    confirm.valueChanges.subscribe(check);
  }

  resetDetails() {
    const u = this.user();
    this.details.reset({ first_name: u?.first_name ?? '', last_name: u?.last_name ?? '', phone: u?.phone ?? '', daily_goal_questions: u?.daily_goal_questions ?? 20, weekly_summary: u?.weekly_summary ?? true });
    this.detailsError.set('');
  }

  saveDetails() {
    if (this.details.invalid) {
      this.details.markAllAsTouched();
      return;
    }
    this.savingDetails.set(true);
    this.detailsError.set('');
    this.auth.updateProfile(this.details.getRawValue()).subscribe({
      next: (u) => {
        this.savingDetails.set(false);
        this.details.reset({ first_name: u.first_name, last_name: u.last_name, phone: u.phone, daily_goal_questions: u.daily_goal_questions ?? 20, weekly_summary: u.weekly_summary ?? true });
        this.notify.success('Your details were saved.');
      },
      error: (err) => {
        this.savingDetails.set(false);
        this.detailsError.set(apiErrorMessage(err));
      },
    });
  }

  changePassword() {
    if (this.password.invalid) {
      this.password.markAllAsTouched();
      return;
    }
    if (!this.captcha().ready()) {
      this.passwordError.set('Type the characters shown in the picture.');
      return;
    }
    this.savingPassword.set(true);
    this.passwordError.set('');
    const { old_password, new_password } = this.password.getRawValue();
    this.auth.changePassword(old_password, new_password, this.captcha().payload()).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.password.reset({ old_password: '', new_password: '', confirm: '' });
        this.auth.loadProfile().subscribe({ error: () => undefined }); // clears the "temporary password" notice
        this.captcha().refresh();
        this.notify.success('Your password was changed.');
      },
      error: (err) => {
        this.savingPassword.set(false);
        this.captcha().refresh(); // a picture can be tried only once
        this.passwordError.set(apiErrorMessage(err));
      },
    });
  }
}
