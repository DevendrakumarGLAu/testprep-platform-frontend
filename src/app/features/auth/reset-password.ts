import { HttpClient } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { AuthLayout } from './auth-layout';

const AUTH = `${environment.apiUrl}/auth`;

/** The page the emailed link opens: choose a new password. */
@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, AuthLayout],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
  host: { class: 'bs' },
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

  /** True when a field should show its error: it is wrong and the person has been to it or tried to save. */
  invalid(name: 'password' | 'confirm') {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
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
