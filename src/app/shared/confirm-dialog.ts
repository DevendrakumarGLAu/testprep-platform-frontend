import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmData {
  title: string;
  message: string;
  confirmLabel?: string;
}

/** Asks "are you sure?". Opened with MatDialog (the dialog's frame); the buttons and text are Bootstrap. Closes with true or false. */
@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
  host: { class: 'bs', role: 'alertdialog', '[attr.aria-labelledby]': 'titleId' },
})
export class ConfirmDialog {
  data = inject<ConfirmData>(MAT_DIALOG_DATA);
  private ref = inject<MatDialogRef<ConfirmDialog, boolean>>(MatDialogRef);
  readonly titleId = 'confirm-title';

  close(ok: boolean) {
    this.ref.close(ok);
  }
}
