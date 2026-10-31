import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { vi } from 'vitest';
import { ImageViewer } from './image-viewer';

describe('ImageViewer', () => {
  it('shows the picture at full size with a close button and a scroll hint', () => {
    TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: { src: 'https://cdn.example/storage/questions/a.png', alt: 'Question image' } }] });
    const f = TestBed.createComponent(ImageViewer);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const img = el.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://cdn.example/storage/questions/a.png');
    expect(img.getAttribute('alt')).toBe('Question image');
    expect(el.querySelector('button[aria-label="Close picture"]')).not.toBeNull();
    expect(el.textContent).toContain('Scroll to see all of it');
  });

  it('opens in a dialog with the address it was given', () => {
    const dialog = { open: vi.fn() } as unknown as MatDialog;
    ImageViewer.open(dialog, 'https://cdn.example/x.png');
    expect(dialog.open).toHaveBeenCalledWith(ImageViewer, expect.objectContaining({ data: { src: 'https://cdn.example/x.png', alt: 'Question image' } }));
  });

  it('can describe the picture differently for screen readers', () => {
    const dialog = { open: vi.fn() } as unknown as MatDialog;
    ImageViewer.open(dialog, 'https://cdn.example/x.png', 'Figure 2');
    expect(dialog.open).toHaveBeenCalledWith(ImageViewer, expect.objectContaining({ data: { src: 'https://cdn.example/x.png', alt: 'Figure 2' } }));
  });
});
