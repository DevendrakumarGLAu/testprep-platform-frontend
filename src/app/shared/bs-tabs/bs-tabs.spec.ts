import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BsTab, BsTabs } from './bs-tabs';

@Component({
  imports: [BsTabs],
  template: `
    <app-bs-tabs [tabs]="tabs()" [selected]="index()" (selectedChange)="index.set($event)">
      @switch (index()) {
        @case (0) { <p class="first">First panel</p> }
        @case (1) { <p class="second">Second panel</p> }
        @default { <p class="third">Third panel</p> }
      }
    </app-bs-tabs>
  `,
})
class Host {
  tabs = signal<BsTab[]>([{ key: 'a', label: 'Alpha (2)' }, { key: 'b', label: 'Beta' }, { key: 'c', label: 'Live', dot: true }]);
  index = signal(0);
}

function render() {
  const f = TestBed.createComponent(Host);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const tabs = () => Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  return { f, el, tabs };
}

describe('BsTabs', () => {
  it('shows the tabs as a Bootstrap nav with the first one open', () => {
    const { el, tabs } = render();
    expect(tabs().map((t) => t.textContent!.trim())).toEqual(['Alpha (2)', 'Beta', 'Live']);
    expect(el.querySelector('.nav.nav-tabs')).not.toBeNull();
    expect(tabs()[0].classList.contains('active')).toBe(true);
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs()[1].getAttribute('aria-selected')).toBe('false');
    expect(el.querySelector('[role="tabpanel"] .first')).not.toBeNull();
  });

  it('opens a tab when it is clicked, and builds only the open panel', () => {
    const { f, el, tabs } = render();
    tabs()[1].click();
    f.detectChanges();
    expect(tabs()[1].classList.contains('active')).toBe(true);
    expect(el.querySelector('.second')).not.toBeNull();
    expect(el.querySelector('.first')).toBeNull();
  });

  it('marks a tab with a dot when asked', () => {
    const { el, tabs } = render();
    expect(tabs()[2].querySelector('.dot')).not.toBeNull();
    expect(tabs()[0].querySelector('.dot')).toBeNull();
    expect(el.querySelectorAll('.dot').length).toBe(1);
  });

  it('moves between tabs with the arrow keys, Home and End, and stops at the ends', () => {
    const { f, tabs } = render();
    const press = (key: string, i: number) => {
      tabs()[i].dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      f.detectChanges();
    };
    press('ArrowRight', 0);
    expect(f.componentInstance.index()).toBe(1);
    press('End', 1);
    expect(f.componentInstance.index()).toBe(2);
    press('ArrowRight', 2);
    expect(f.componentInstance.index()).toBe(2);
    press('Home', 2);
    expect(f.componentInstance.index()).toBe(0);
    press('ArrowLeft', 0);
    expect(f.componentInstance.index()).toBe(0);
  });

  it('only the open tab can be reached with the Tab key', () => {
    const { tabs } = render();
    expect(tabs().map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  it('shows new tabs when the list changes', () => {
    const { f, tabs } = render();
    f.componentInstance.tabs.set([{ key: 'z', label: 'Only' }]);
    f.detectChanges();
    expect(tabs().map((t) => t.textContent!.trim())).toEqual(['Only']);
  });
});
