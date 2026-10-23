import { Component, computed, input } from '@angular/core';

export interface UsageRef {
  id: number;
  title: string;
  status: string;
}

/**
 * Small tags that say where a question is used: "In this test", "Also in Mock 2, Mock 3", or "Not used in any test yet".
 * `currentId` is the test being edited (if any); that one is reported as "In this test", the others by name.
 */
@Component({
  selector: 'app-usage-tags',
  styles: `
    :host { display: inline-flex; flex-wrap: wrap; gap: 4px; vertical-align: middle; }
    .tag { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 0.78em; line-height: 1.6; white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
    .here { background: var(--mat-sys-primary); color: var(--mat-sys-on-primary); }
    .other { background: var(--mat-sys-secondary-container); color: var(--mat-sys-on-secondary-container); }
    .none { border: 1px solid var(--mat-sys-outline-variant); color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    @if (here()) { <span class="tag here" title="This question is already part of the test you are editing">In this test</span> }
    @if (others().length) {
      <span class="tag other" [attr.title]="'Also in: ' + names()">Also in {{ summary() }}</span>
    }
    @if (!here() && !others().length) { <span class="tag none">Not used in any test yet</span> }
  `,
})
export class UsageTags {
  usedIn = input<UsageRef[] | undefined | null>([]);
  currentId = input<number | null | undefined>(null);
  /** Treat the question as part of the current test even before it is saved (it is in the builder's list). */
  inCurrent = input(false);

  private list = computed(() => this.usedIn() ?? []);
  here = computed(() => this.inCurrent() || (this.currentId() != null && this.list().some((u) => u.id === this.currentId())));
  others = computed(() => this.list().filter((u) => u.id !== this.currentId()));
  names = computed(() => this.others().map((u) => u.title).join(', '));
  summary = computed(() => {
    const o = this.others();
    return o.length <= 2 ? o.map((u) => u.title).join(', ') : `${o[0].title} +${o.length - 1} more`;
  });
}
