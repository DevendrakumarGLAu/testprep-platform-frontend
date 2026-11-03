import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';

function render(data: Record<string, unknown>) {
  const close = vi.fn();
  TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close } }] });
  const f = TestBed.createComponent(ConfirmDialog);
  f.detectChanges();
  return { el: f.nativeElement as HTMLElement, close };
}

const button = (el: HTMLElement, label: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === label)!;

describe('ConfirmDialog', () => {
  it('shows the question with Bootstrap buttons and no Material component', () => {
    const { el } = render({ title: 'Delete this note?', message: 'It will be removed for everyone.', confirmLabel: 'Delete' });
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('h2')!.textContent).toContain('Delete this note?');
    expect(el.textContent).toContain('It will be removed for everyone.');
    expect(button(el, 'Delete').classList.contains('btn-primary')).toBe(true);
    expect(el.querySelector('[mat-dialog-title], mat-dialog-content, [mat-button], [mat-flat-button]')).toBeNull();
  });

  it('uses "Confirm" when no label is given', () => {
    const { el } = render({ title: 'Sure?', message: 'Really?' });
    expect(button(el, 'Confirm')).toBeDefined();
  });

  it('closes with true when confirmed and false when cancelled', () => {
    const a = render({ title: 'T', message: 'M', confirmLabel: 'Yes' });
    button(a.el, 'Yes').click();
    expect(a.close).toHaveBeenCalledWith(true);
    TestBed.resetTestingModule();
    const b = render({ title: 'T', message: 'M' });
    button(b.el, 'Cancel').click();
    expect(b.close).toHaveBeenCalledWith(false);
  });
});
