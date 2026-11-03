import { Component, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { PlatformService } from '../../core/platform.service';
import { AuthLayout } from './auth-layout';
import { CaptchaField } from './captcha-field';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, AuthLayout, CaptchaField],
  templateUrl: './register.html',
  styleUrl: './register.scss',
  host: { class: 'bs' },
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

  /** True when a field should show its error: it is wrong and the person has been to it or tried to submit. */
  invalid(name: keyof Register['form']['controls']) {
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
