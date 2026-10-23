import { TestBed } from '@angular/core/testing';
import { UsageRef, UsageTags } from './usage-tags';

const ref = (id: number, title: string): UsageRef => ({ id, title, status: 'draft' });

describe('UsageTags', () => {
  function render(inputs: { usedIn?: UsageRef[]; currentId?: number | null; inCurrent?: boolean }) {
    const fixture = TestBed.createComponent(UsageTags);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ').trim();
  }

  it('says a question has not been used yet', () => {
    expect(render({ usedIn: [] })).toBe('Not used in any test yet');
  });

  it('lists the other tests by name', () => {
    expect(render({ usedIn: [ref(1, 'Mock 1'), ref(2, 'Mock 2')] })).toBe('Also in Mock 1, Mock 2');
  });

  it('shortens a long list', () => {
    expect(render({ usedIn: [ref(1, 'A'), ref(2, 'B'), ref(3, 'C'), ref(4, 'D')] })).toBe('Also in A +3 more');
  });

  it('tells the current test apart from the others', () => {
    expect(render({ usedIn: [ref(7, 'This one'), ref(2, 'Mock 2')], currentId: 7 })).toBe('In this testAlso in Mock 2');
    expect(render({ usedIn: [ref(7, 'This one')], currentId: 7 })).toBe('In this test');
  });

  it('can be told a question is in the current test before it is saved', () => {
    expect(render({ usedIn: [], currentId: 7, inCurrent: true })).toBe('In this test');
  });
});
