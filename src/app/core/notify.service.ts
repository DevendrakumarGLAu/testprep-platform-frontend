import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotifyService {
  private snack = inject(MatSnackBar);

  // Every message appears in the top-right corner, where it does not cover the exam or the page's own buttons.
  private position = { horizontalPosition: 'end', verticalPosition: 'top' } as const;

  success(msg: string) {
    this.snack.open(msg, 'OK', { duration: 3500, panelClass: 'snack-success', ...this.position });
  }

  /** A heads-up that stays long enough to be read, such as the time warnings in an exam. */
  warning(msg: string) {
    this.snack.open(msg, 'OK', { duration: 8000, panelClass: 'snack-warning', ...this.position });
  }

  error(msg: string) {
    this.snack.open(msg, 'Dismiss', { duration: 6000, panelClass: 'snack-error', ...this.position });
  }
}
