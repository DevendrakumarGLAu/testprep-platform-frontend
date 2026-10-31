import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Prepare } from './prepare';
import { PrepExam, PrepResponse } from './student.models';
import { StudentService } from './student.service';

const exam = (id: string, name: string, group: PrepExam['group'] = null): PrepExam => ({
  id, name, description: '', group, subjects: [], counts: { full_test: 1, sectional: 0, previous_year: 0, total: 1 }, preparing: false,
});
const ssc = { id: 'g1', name: 'SSC Exams' };
const rail = { id: 'g2', name: 'Railways' };

async function render(r: PrepResponse) {
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StudentService, useValue: { prep: vi.fn(() => of(r)), setPrep: vi.fn() } }] });
  const f = TestBed.createComponent(Prepare);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

const heads = (el: HTMLElement) => [...el.querySelectorAll('h2.family')].map((h) => h.textContent!.trim());
const cardNames = (el: HTMLElement) => [...el.querySelectorAll('mat-card h2')].map((h) => h.textContent!.trim());

describe('Prepare page families', () => {
  it('shows each family as a heading with its exams under it, in the instructor order', async () => {
    const el = await render({
      preparing: [],
      families: [
        { id: 'g1', name: 'SSC Exams', description: 'Staff Selection Commission', order: 1 },
        { id: 'g2', name: 'Railways', description: '', order: 2 },
      ],
      exams: [exam('a', 'SSC CGL', ssc), exam('b', 'SSC CHSL', ssc), exam('c', 'RRB NTPC', rail)],
    });
    expect(heads(el)).toEqual(['SSC Exams', 'Railways']);
    expect(el.textContent).toContain('Staff Selection Commission');
    expect(cardNames(el)).toEqual(['SSC CGL', 'SSC CHSL', 'RRB NTPC']);
  });

  it('puts exams that belong to no family under "Other exams" at the end', async () => {
    const el = await render({
      preparing: [],
      families: [{ id: 'g1', name: 'SSC Exams', description: '', order: 1 }],
      exams: [exam('z', 'Banking'), exam('a', 'SSC CGL', ssc)],
    });
    expect(heads(el)).toEqual(['SSC Exams', 'Other exams']);
    expect(cardNames(el)).toEqual(['SSC CGL', 'Banking']);
  });

  it('is one plain list, with no headings, when there are no families', async () => {
    const el = await render({ preparing: [], families: [], exams: [exam('a', 'SSC'), exam('b', 'Banking')] });
    expect(heads(el)).toEqual([]);
    expect(cardNames(el)).toEqual(['SSC', 'Banking']);
  });

  it('treats an exam whose family is not in the list as a loose exam', async () => {
    const el = await render({ preparing: [], families: [], exams: [exam('a', 'SSC CGL', ssc)] });
    expect(heads(el)).toEqual([]);
    expect(cardNames(el)).toEqual(['SSC CGL']);
  });

  it('says so when no exams are available', async () => {
    const el = await render({ preparing: [], families: [], exams: [] });
    expect(el.textContent).toContain('No exams are available yet');
  });
});
