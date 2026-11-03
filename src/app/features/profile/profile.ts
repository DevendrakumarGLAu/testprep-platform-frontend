import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
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
  imports: [DatePipe, ReactiveFormsModule, CaptchaField],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  host: { class: 'bs' },
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

  /** Show a field's error once the person has touched it or tried to save. */
  bad(c: AbstractControl) {
    return c.invalid && (c.touched || c.dirty);
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
