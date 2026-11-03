import { Component, ElementRef, effect, inject, input, output } from '@angular/core';

export interface BsTab {
  /** Identifies the tab. */
  key: string;
  label: string;
  /** Show a pulsing red dot before the label (for example for live tests). */
  dot?: boolean;
  /** The tab cannot be opened (for example until the page has something to show in it). */
  disabled?: boolean;
}

/**
 * Bootstrap tabs. The page keeps the chosen tab and shows the panel for it in the default slot (so a tab that is not open is never
 * built). The strip scrolls sideways when there are more tabs than fit, by touch, mouse wheel or drag, and the open tab is kept in view.
 */
@Component({
  selector: 'app-bs-tabs',
  templateUrl: './bs-tabs.html',
  styleUrl: './bs-tabs.scss',
  host: { class: 'bs' },
})
export class BsTabs {
  tabs = input.required<BsTab[]>();
  /** Index of the open tab. */
  selected = input(0);
  selectedChange = output<number>();

  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    effect(() => {
      this.selected();
      this.tabs();
      // after the strip has been drawn, bring the open tab into view
      queueMicrotask(() => this.el.nativeElement.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }));
    });
  }

  /** Arrow keys, Home and End move between tabs, as people expect from tabs. */
  onKey(event: KeyboardEvent, index: number) {
    const last = this.tabs().length - 1;
    const next = event.key === 'ArrowRight' ? Math.min(index + 1, last) : event.key === 'ArrowLeft' ? Math.max(index - 1, 0) : event.key === 'Home' ? 0 : event.key === 'End' ? last : null;
    if (next === null) return;
    event.preventDefault();
    this.selectedChange.emit(next);
    queueMicrotask(() => this.el.nativeElement.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus());
  }
}
