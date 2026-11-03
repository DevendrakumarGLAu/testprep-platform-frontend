import { Component, effect, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { PlatformService } from '../../core/platform.service';

@Component({
  selector: 'app-platform-settings',
  imports: [ReactiveFormsModule],
  templateUrl: './platform-settings.html',
  styleUrl: './platform-settings.scss',
  host: { class: 'bs' },
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
    support_phone: [''],
    support_hours: [''],
    allow_registration: [true],
  });

  constructor() {
    effect(() => this.form.patchValue(this.platform.info()));
    this.platform.refresh();
  }

  /** Show a field's error once it has been touched or the person tried to save. */
  bad(c: AbstractControl) {
    return c.invalid && (c.touched || c.dirty);
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
