import { Component, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/models';
import { PlatformService } from '../../core/platform.service';
import { AuthLayout } from './auth-layout';
import { CaptchaField } from './captcha-field';
import { SupportLine } from '../../shared/support-line/support-line';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, AuthLayout, CaptchaField, SupportLine],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  host: { class: 'bs' },
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

  /** True when a field should show its error: it is wrong and the person has been to it or tried to submit. */
  invalid(name: 'username' | 'password') {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
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
