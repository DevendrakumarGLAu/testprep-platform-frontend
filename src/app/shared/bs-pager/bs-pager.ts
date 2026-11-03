import { Component, computed, input, output } from '@angular/core';

export interface PageChange {
  pageIndex: number;
  pageSize: number;
}

/**
 * Page buttons for a long list ("Showing 21–40 of 135", first, previous, next, last), with an optional choice of page size.
 * The list's page owns the page number: it passes it in and loads the page it is told about in (page).
 */
@Component({
  selector: 'app-bs-pager',
  templateUrl: './bs-pager.html',
  styleUrl: './bs-pager.scss',
  host: { class: 'bs' },
})
export class BsPager {
  length = input.required<number>();
  pageIndex = input(0);
  pageSize = input(20);
  /** When there is more than one, the person can choose how many rows a page shows. */
  pageSizeOptions = input<number[]>([]);
  page = output<PageChange>();

  pages = computed(() => Math.max(1, Math.ceil(this.length() / this.pageSize())));
  first = computed(() => (this.length() ? this.pageIndex() * this.pageSize() + 1 : 0));
  last = computed(() => Math.min(this.length(), (this.pageIndex() + 1) * this.pageSize()));
  atStart = computed(() => this.pageIndex() <= 0);
  atEnd = computed(() => this.pageIndex() >= this.pages() - 1);

  go(index: number) {
    const clamped = Math.min(Math.max(0, index), this.pages() - 1);
    if (clamped !== this.pageIndex()) this.page.emit({ pageIndex: clamped, pageSize: this.pageSize() });
  }

  size(value: string) {
    const pageSize = Number(value);
    // Keep the first row on screen when the size changes.
    this.page.emit({ pageIndex: Math.floor((this.pageIndex() * this.pageSize()) / pageSize), pageSize });
  }
}
