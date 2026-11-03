import { Component, ElementRef, HostListener, afterNextRender, inject, input, output, viewChild } from '@angular/core';

/**
 * A Bootstrap-styled dialog. The page that uses it shows it with @if and listens for (closed); Escape and a click on the dark
 * background close it. Put the body in the default slot, buttons in the `footer` slot.
 */
@Component({
  selector: 'app-bs-modal',
  templateUrl: './bs-modal.html',
  styleUrl: './bs-modal.scss',
  host: { class: 'bs' },
})
export class BsModal {
  title = input.required<string>();
  size = input<'sm' | 'md' | 'lg'>('md');
  closed = output<void>();

  private dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.focus());
  }

  @HostListener('document:keydown.escape')
  protected onEscape() {
    this.closed.emit();
  }

  protected onBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) this.closed.emit();
  }
}
