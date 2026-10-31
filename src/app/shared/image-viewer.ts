import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

interface ViewerData {
  src: string;
  alt: string;
}

/** A question picture at full size, in a window that scrolls, so a diagram can be read properly on a phone. */
@Component({
  selector: 'app-image-viewer',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  styles: `
    .bar { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px 0 16px; }
    .hint { color: var(--mat-sys-on-surface-variant); font-size: 0.85rem; }
    .body { overflow: auto; max-height: 78vh; padding: 8px 16px 16px; }
    img { display: block; max-width: none; }
  `,
  template: `
    <div class="bar">
      <span class="hint">Scroll to see all of it</span>
      <button mat-icon-button mat-dialog-close aria-label="Close picture"><mat-icon>close</mat-icon></button>
    </div>
    <div class="body"><img [src]="data.src" [alt]="data.alt" /></div>
  `,
})
export class ImageViewer {
  data = inject<ViewerData>(MAT_DIALOG_DATA);

  static open(dialog: MatDialog, src: string, alt = 'Question image') {
    return dialog.open(ImageViewer, { data: { src, alt } satisfies ViewerData, maxWidth: '96vw', autoFocus: 'dialog' });
  }
}
