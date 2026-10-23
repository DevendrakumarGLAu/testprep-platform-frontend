import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi } from 'vitest';
import { NotifyService } from './notify.service';

describe('NotifyService', () => {
  const open = vi.fn();

  beforeEach(() => {
    open.mockClear();
    TestBed.configureTestingModule({ providers: [{ provide: MatSnackBar, useValue: { open } }] });
  });

  it('shows success messages in the top-right corner', () => {
    TestBed.inject(NotifyService).success('Saved');
    expect(open).toHaveBeenCalledWith('Saved', 'OK', expect.objectContaining({ horizontalPosition: 'end', verticalPosition: 'top', panelClass: 'snack-success' }));
  });

  it('shows warnings in the top-right corner for a longer time', () => {
    TestBed.inject(NotifyService).warning('Careful');
    expect(open).toHaveBeenCalledWith('Careful', 'OK', expect.objectContaining({ horizontalPosition: 'end', verticalPosition: 'top', panelClass: 'snack-warning', duration: 8000 }));
  });

  it('shows errors in the top-right corner and keeps them longer', () => {
    TestBed.inject(NotifyService).error('Failed');
    expect(open).toHaveBeenCalledWith('Failed', 'Dismiss', expect.objectContaining({ horizontalPosition: 'end', verticalPosition: 'top', panelClass: 'snack-error', duration: 6000 }));
  });
});
