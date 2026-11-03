import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';

interface ViewerData {
  src: string;
  alt: string;
}

/** A question picture at full size, in a window that scrolls, so a diagram can be read properly on a phone. */
@Component({
  selector: 'app-image-viewer',
  templateUrl: './image-viewer.html',
  styleUrl: './image-viewer.scss',
  host: { class: 'bs' },
})
export class ImageViewer {
  data = inject<ViewerData>(MAT_DIALOG_DATA);
  private ref = inject<MatDialogRef<ImageViewer>>(MatDialogRef);

  close() {
    this.ref.close();
  }

  static open(dialog: MatDialog, src: string, alt = 'Question image') {
    return dialog.open(ImageViewer, { data: { src, alt } satisfies ViewerData, maxWidth: '96vw', autoFocus: 'dialog' });
  }
}
