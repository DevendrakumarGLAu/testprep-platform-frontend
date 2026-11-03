import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { NotifyService } from '../../core/notify.service';
import { Toasts } from './toasts';

describe('Toasts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the current message as a Bootstrap toast and closes it with its button', () => {
    const f = TestBed.createComponent(Toasts);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.toast')).toBeNull();
    TestBed.inject(NotifyService).error('Could not save');
    f.detectChanges();
    const toast = el.querySelector('.toast')!;
    expect(toast.textContent).toContain('Could not save');
    expect(toast.classList.contains('error')).toBe(true);
    expect(toast.getAttribute('role')).toBe('alert');
    (toast.querySelector('button') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el.querySelector('.toast')).toBeNull();
    expect(el.querySelector('mat-snack-bar-container, simple-snack-bar')).toBeNull();
  });

  it('shows a success message as a polite status', () => {
    const f = TestBed.createComponent(Toasts);
    TestBed.inject(NotifyService).success('Saved');
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('.toast.success')!.getAttribute('role')).toBe('status');
  });
});
