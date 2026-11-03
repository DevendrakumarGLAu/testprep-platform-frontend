import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NotifyService } from '../../core/notify.service';
import { ExamBrowser, FamilyBrowser } from './exam-browser';
import { PrepExam, PrepHubData, PrepResponse } from './student.models';
import { StudentService } from './student.service';

const prepExam = (id: string, name: string, total: number, group: PrepExam['group'] = null): PrepExam => ({
  id, name, description: '', group, subjects: [], preparing: false,
  counts: { full_test: total, mini_mock: 0, sectional: 0, previous_year: 0, total },
});

const ssc = { id: 'g1', name: 'SSC Exams' };
const rail = { id: 'g2', name: 'Railways' };

const prep: PrepResponse = {
  preparing: [],
  families: [
    { id: 'g1', name: 'SSC Exams', description: 'Staff Selection Commission', order: 1 },
    { id: 'g2', name: 'Railways', description: '', order: 2 },
  ],
  exams: [prepExam('cgl', 'SSC CGL', 12, ssc), prepExam('chsl', 'SSC CHSL', 5, ssc), prepExam('mts', 'SSC MTS', 1, ssc), prepExam('ntpc', 'RRB NTPC', 3, rail)],
};

const hubFor = (id: string): PrepHubData => ({
  exam: { id, name: id.toUpperCase(), description: '', group: ssc, subjects: [] },
  preparing: false, full_tests: [], mini_mocks: [], subject_tests: [], previous_year: [], progress: { total: 0, attempted: 0 },
});

describe('Exam family page: exam tabs', () => {
  let api: { prep: ReturnType<typeof vi.fn>; hub: ReturnType<typeof vi.fn>; setPrep: ReturnType<typeof vi.fn>; exams: ReturnType<typeof vi.fn> };

  async function open(id = 'g1', exam?: string, response = prep) {
    api = { prep: vi.fn(() => of(response)), hub: vi.fn((i: string) => of(hubFor(i))), setPrep: vi.fn(), exams: vi.fn(() => of([])) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StudentService, useValue: api }] });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));
    const byUrl = vi.spyOn(router, 'navigateByUrl').mockImplementation(() => Promise.resolve(true));
    const fixture = TestBed.createComponent(FamilyBrowser);
    fixture.componentRef.setInput('id', id);
    if (exam) fixture.componentRef.setInput('exam', exam);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, navigate, byUrl };
  }

  const tabs = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('.exam-tabs > .bs-tabs-strip [role="tab"]')];
  const label = (t: HTMLElement) => t.textContent!.replace(/\s+/g, ' ').trim();
  const selected = (el: HTMLElement) => label(tabs(el).find((t) => t.getAttribute('aria-selected') === 'true')!);

  it('shows the family name and one tab per exam of that family, with its test count', async () => {
    const { el } = await open();
    expect(el.querySelector('h1')?.textContent).toContain('SSC Exams');
    expect(el.textContent).toContain('Staff Selection Commission');
    expect(tabs(el).map(label)).toEqual(['SSC CGL (12)', 'SSC CHSL (5)', 'SSC MTS (1)']);
  });

  it('leaves out the exams of other families', async () => {
    const { el } = await open('g2');
    expect(tabs(el).map(label)).toEqual(['RRB NTPC (3)']);
  });

  it('opens the first exam by default and shows its four tabs inside', async () => {
    const { el } = await open();
    expect(selected(el)).toBe('SSC CGL (12)');
    expect(api.hub).toHaveBeenCalledWith('cgl');
    const inner = [...el.querySelectorAll<HTMLElement>('app-prep-hub [role="tab"]')].map(label);
    expect(inner).toEqual(['Full tests (0)', 'Mini mocks (0)', 'Previous year (0)', 'Subject wise (0)']);
  });

  it('opens the exam named in the address', async () => {
    const { el } = await open('g1', 'mts');
    expect(selected(el)).toBe('SSC MTS (1)');
    expect(api.hub).toHaveBeenCalledWith('mts');
  });

  it('falls back to the first exam when the address names one that is not in the family', async () => {
    const { el } = await open('g1', 'ntpc');
    expect(selected(el)).toBe('SSC CGL (12)');
  });

  it('only loads the exam that is open', async () => {
    await open();
    expect(api.hub).toHaveBeenCalledTimes(1);
  });

  it('choosing another exam puts it in the address and starts that exam on its first tab', async () => {
    const { el, fixture, navigate } = await open();
    tabs(el)[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith([], { queryParams: { exam: 'chsl', type: null }, queryParamsHandling: 'merge', replaceUrl: true });
  });

  it('sends the student back to the tests page when the family does not exist', async () => {
    const error = vi.fn();
    const { byUrl } = await (async () => {
      api = { prep: vi.fn(() => of(prep)), hub: vi.fn(), setPrep: vi.fn(), exams: vi.fn(() => of([])) };
      TestBed.configureTestingModule({
        providers: [provideRouter([]), { provide: StudentService, useValue: api }, { provide: NotifyService, useValue: { error } }],
      });
      const byUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockImplementation(() => Promise.resolve(true));
      const f = TestBed.createComponent(FamilyBrowser);
      f.componentRef.setInput('id', 'nope');
      f.detectChanges();
      await f.whenStable();
      return { byUrl };
    })();
    expect(error).toHaveBeenCalledWith('This exam family is not available.');
    expect(byUrl).toHaveBeenCalledWith('/student/tests');
  });

  it('says so when a family has no exams with tests yet', async () => {
    const { el } = await open('g1', undefined, { ...prep, exams: [prepExam('ntpc', 'RRB NTPC', 3, rail)] });
    expect(tabs(el).length).toBe(0);
    expect(el.textContent).toContain('No tests in SSC Exams yet');
  });

  it('has a link back to all exams', async () => {
    const { el } = await open();
    expect(el.querySelector('a[href="/student/tests"]')).not.toBeNull();
  });
});

describe('Single exam page', () => {
  it('shows the four tabs of the exam with a back link to the tests page', async () => {
    const api = { hub: vi.fn((i: string) => of({ ...hubFor(i), exam: { ...hubFor(i).exam, group: null } })), prep: vi.fn(), setPrep: vi.fn(), exams: vi.fn(() => of([])) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StudentService, useValue: api }] });
    const f = TestBed.createComponent(ExamBrowser);
    f.componentRef.setInput('id', 'bank');
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(api.hub).toHaveBeenCalledWith('bank');
    expect(el.querySelector('h1')?.textContent).toContain('BANK');
    expect(el.querySelector('a[href="/student/tests"]')).not.toBeNull();
    expect([...el.querySelectorAll('[role="tab"]')].length).toBe(4);
  });
});
