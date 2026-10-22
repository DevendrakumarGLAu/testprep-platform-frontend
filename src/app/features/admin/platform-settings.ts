import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { PlatformService } from '../../core/platform.service';

@Component({
  selector: 'app-platform-settings',
  imports: [ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSlideToggleModule, MatButtonModule],
  styles: `
    :host { display: block; max-width: 640px; }
    form { display: flex; flex-direction: column; gap: 4px; }
    .hint { color: var(--mat-sys-on-surface-variant); margin: 0 0 12px 48px; font-size: 0.85em; }
    .err { color: var(--mat-sys-error); }
    .actions { display: flex; justify-content: flex-end; margin-top: 8px; }
  `,
  template: `
    <h1>Platform settings</h1>
    <mat-card appearance="outlined">
      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="save()" novalidate>
          <mat-form-field appearance="outline">
            <mat-label>Platform name</mat-label>
            <input matInput formControlName="platform_name" maxlength="60" />
            <mat-error>The platform name is required</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Support email</mat-label>
            <input matInput type="email" formControlName="support_email" />
            <mat-error>Enter a valid email address</mat-error>
          </mat-form-field>
          <mat-slide-toggle formControlName="allow_registration">Allow students to register themselves</mat-slide-toggle>
          <p class="hint">When off, the sign-up page is closed and only administrators can create student accounts.</p>
          @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
          <div class="actions"><button mat-flat-button type="submit" [disabled]="saving()">Save settings</button></div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
})
export class PlatformSettings {
  private platform = inject(PlatformService);
  private fb = inject(FormBuilder);
  private notify = inject(NotifyService);

  saving = signal(false);
  error = signal('');
  form = this.fb.nonNullable.group({
    platform_name: ['', Validators.required],
    support_email: ['', Validators.email],
    allow_registration: [true],
  });

  constructor() {
    effect(() => this.form.patchValue(this.platform.info()));
    this.platform.refresh();
  }

  save() {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.saving.set(true);
    this.error.set('');
    this.platform.save(this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.success('Settings saved');
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(e));
      },
    });
  }
}
