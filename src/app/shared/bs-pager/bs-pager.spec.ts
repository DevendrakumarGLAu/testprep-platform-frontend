import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { BsPager, PageChange } from './bs-pager';

function render(inputs: { length: number; pageIndex?: number; pageSize?: number; pageSizeOptions?: number[] }) {
  const f = TestBed.createComponent(BsPager);
  for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
  const pages: PageChange[] = [];
  f.componentInstance.page.subscribe((p) => pages.push(p));
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const btn = (label: string) => el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  return { f, el, pages, btn };
}

describe('BsPager', () => {
  it('says which rows are shown and has no Material component', () => {
    const { el } = render({ length: 135, pageIndex: 1, pageSize: 20 });
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('.range')!.textContent).toContain('21–40 of 135');
    expect(el.querySelector('.pagination')).not.toBeNull();
    expect(el.querySelector('mat-paginator, mat-select')).toBeNull();
  });

  it('shows 0–0 of 0 for an empty list and keeps every button off', () => {
    const { el, btn } = render({ length: 0 });
    expect(el.querySelector('.range')!.textContent).toContain('0–0 of 0');
    for (const l of ['First page', 'Previous page', 'Next page', 'Last page']) expect(btn(l).disabled).toBe(true);
  });

  it('moves to the next, previous, first and last page', () => {
    const { btn, pages } = render({ length: 100, pageIndex: 2, pageSize: 20 });
    btn('Next page').click();
    btn('Previous page').click();
    btn('First page').click();
    btn('Last page').click();
    expect(pages.map((p) => p.pageIndex)).toEqual([3, 1, 0, 4]);
  });

  it('cannot go back from the first page or forward from the last', () => {
    const a = render({ length: 100, pageIndex: 0 });
    expect(a.btn('Previous page').disabled).toBe(true);
    expect(a.btn('First page').disabled).toBe(true);
    TestBed.resetTestingModule();
    const b = render({ length: 100, pageIndex: 4 });
    expect(b.btn('Next page').disabled).toBe(true);
    expect(b.btn('Last page').disabled).toBe(true);
  });

  it('offers page sizes only when there is a choice, and keeps the first row in view when it changes', () => {
    expect(render({ length: 100 }).el.querySelector('select')).toBeNull();
    TestBed.resetTestingModule();
    const { el, pages } = render({ length: 200, pageIndex: 3, pageSize: 10, pageSizeOptions: [10, 20, 50] });
    const select = el.querySelector('select') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['10', '20', '50']);
    select.value = '20';
    select.dispatchEvent(new Event('change'));
    expect(pages).toEqual([{ pageIndex: 1, pageSize: 20 }]);
  });

  it('ignores a request for the page it is already on', () => {
    const { f, pages } = render({ length: 100, pageIndex: 1 });
    f.componentInstance.go(1);
    f.componentInstance.go(-5);
    f.componentInstance.go(99);
    expect(pages.map((p) => p.pageIndex)).toEqual([0, 4]);
    void vi;
  });
});
