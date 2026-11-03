import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { NotifyService } from './notify.service';

describe('NotifyService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const service = () => TestBed.inject(NotifyService);

  it('shows a success message for a short time', () => {
    const s = service();
    s.success('Saved');
    expect(s.toasts()).toEqual([expect.objectContaining({ kind: 'success', message: 'Saved', action: 'OK' })]);
    vi.advanceTimersByTime(3499);
    expect(s.toasts().length).toBe(1);
    vi.advanceTimersByTime(1);
    expect(s.toasts()).toEqual([]);
  });

  it('keeps a warning on screen longer', () => {
    const s = service();
    s.warning('Careful');
    expect(s.toasts()[0]).toEqual(expect.objectContaining({ kind: 'warning', message: 'Careful', action: 'OK' }));
    vi.advanceTimersByTime(7999);
    expect(s.toasts().length).toBe(1);
    vi.advanceTimersByTime(1);
    expect(s.toasts()).toEqual([]);
  });

  it('keeps an error until it has been readable for a while, with a Dismiss button', () => {
    const s = service();
    s.error('Failed');
    expect(s.toasts()[0]).toEqual(expect.objectContaining({ kind: 'error', message: 'Failed', action: 'Dismiss' }));
    vi.advanceTimersByTime(6000);
    expect(s.toasts()).toEqual([]);
  });

  it('a new message replaces the one before, and the old one is not removed early', () => {
    const s = service();
    s.success('First');
    vi.advanceTimersByTime(3000);
    s.error('Second');
    vi.advanceTimersByTime(600); // the first message's time is up now
    expect(s.toasts().map((t) => t.message)).toEqual(['Second']);
  });

  it('can be dismissed by hand', () => {
    const s = service();
    s.error('Failed');
    s.dismiss(s.toasts()[0].id);
    expect(s.toasts()).toEqual([]);
  });
});
