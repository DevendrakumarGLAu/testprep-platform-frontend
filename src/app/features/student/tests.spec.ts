import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { PrepExam, PrepResponse, StudentExam } from './student.models';
import { StudentService } from './student.service';
import { StudentTests } from './tests';

const prepExam = (id: string, name: string, total: number, group: PrepExam['group'] = null): PrepExam => ({
  id, name, description: '', group, subjects: [], preparing: false,
  counts: { full_test: total, mini_mock: 0, sectional: 0, previous_year: 0, total },
});

const test = (id: string, title: string): StudentExam => ({
  id, title, description: '', category: null, category_name: null, test_type: 'full_test', test_type_label: 'Full test',
  subject: null, subject_name: null, year: null, thumbnail_url: null, question_count: 5, total_marks: '10.00', duration_minutes: 10,
  start_at: null, end_at: null, max_attempts: 0, attempts_used: 0, negative_marking_enabled: true, sectional_timing: false, status: 'available',
  can_start: true, reason: '', active_attempt_id: null,
});

const ssc = { id: 'g1', name: 'SSC Exams' };
const rail = { id: 'g2', name: 'Railways' };

describe('Student tests page: pick an exam first', () => {
  let api: { prep: ReturnType<typeof vi.fn>; exams: ReturnType<typeof vi.fn> };
  let fixture: ReturnType<typeof TestBed.createComponent<StudentTests>>;

  async function open(r: PrepResponse) {
    api = { prep: vi.fn(() => of(r)), exams: vi.fn(() => of([test('t1', 'Maths mock')])) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StudentService, useValue: api }] });
    fixture = TestBed.createComponent(StudentTests);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  const base: PrepResponse = {
    preparing: [],
    families: [
      { id: 'g1', name: 'SSC Exams', description: 'Staff Selection Commission', order: 1 },
      { id: 'g2', name: 'Railways', description: '', order: 2 },
    ],
    exams: [
      prepExam('cgl', 'SSC CGL', 12, ssc), prepExam('chsl', 'SSC CHSL', 5, ssc), prepExam('mts', 'SSC MTS', 1, ssc),
      prepExam('ntpc', 'RRB NTPC', 3, rail), prepExam('bank', 'Banking', 2),
    ],
  };

  const names = (el: HTMLElement) => [...el.querySelectorAll('mat-card h2')].map((h) => h.textContent!.trim());

  it('shows a card per family, in the instructor order, then exams that are in no family', async () => {
    const { el } = await open(base);
    expect(names(el)).toEqual(['SSC Exams', 'Railways', 'Banking']);
    expect(el.querySelector('mat-card.family')?.textContent).toContain('Staff Selection Commission');
  });

  it('lists the exams of a family on its card with how many tests each has', async () => {
    const { el } = await open(base);
    const links = [...el.querySelectorAll('mat-card.family')[0].querySelectorAll('a.exam-link')].map(
      (a) => `${a.querySelector('strong')!.textContent!.trim()} ${a.querySelector('span')!.textContent!.trim()}`,
    );
    expect(links).toEqual(['SSC CGL 12 tests', 'SSC CHSL 5 tests', 'SSC MTS 1 test']);
  });

  it('opens the family on the exam that was clicked', async () => {
    const { el } = await open(base);
    const link = el.querySelectorAll('mat-card.family')[0].querySelectorAll('a.exam-link')[1] as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/student/tests/family/g1?exam=chsl');
    const openLink = el.querySelectorAll('mat-card.family')[0].querySelector('mat-card-actions a') as HTMLAnchorElement;
    expect(openLink.getAttribute('href')).toBe('/student/tests/family/g1');
    expect(openLink.textContent).toContain('Open SSC Exams');
  });

  it('an exam that is in no family opens straight to its tests', async () => {
    const { el } = await open(base);
    const a = el.querySelector('mat-card.single mat-card-actions a') as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe('/student/tests/exam/bank');
    expect(el.querySelector('mat-card.single')?.textContent).toContain('2 tests');
  });

  it('does not show a family that has no exams to offer', async () => {
    const { el } = await open({ ...base, exams: [prepExam('bank', 'Banking', 2)] });
    expect(names(el)).toEqual(['Banking']);
  });

  it('treats an exam whose family is not listed as a single exam', async () => {
    const { el } = await open({ preparing: [], families: [], exams: [prepExam('cgl', 'SSC CGL', 4, ssc)] });
    expect(names(el)).toEqual(['SSC CGL']);
  });

  it('says so when there is nothing to show', async () => {
    const { el } = await open({ preparing: [], families: [], exams: [] });
    expect(el.textContent).toContain('No tests are available yet');
  });

  it('does not load every test just to show the exams: it only asks for the live ones', async () => {
    await open(base);
    expect(api.exams.mock.calls.every((c) => c[0].live === 1)).toBe(true);
  });

  it('searching looks across every test and hides the exam cards until the box is cleared', async () => {
    const { c, el } = await open(base);
    c.search.setValue('maths');
    await new Promise((r) => setTimeout(r, 400));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.exams).toHaveBeenCalledWith({ search: 'maths' });
    expect(el.textContent).toContain('Search results');
    expect(el.querySelectorAll('app-test-card').length).toBe(1);
    expect(el.querySelector('mat-card.family')).toBeNull();
    c.search.setValue('');
    await new Promise((r) => setTimeout(r, 400));
    fixture.detectChanges();
    expect(names(el)).toEqual(['SSC Exams', 'Railways', 'Banking']);
  });

  it('says so when a search finds nothing', async () => {
    const { c, el } = await open(base);
    api.exams.mockReturnValue(of([]));
    c.search.setValue('zzz');
    await new Promise((r) => setTimeout(r, 400));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('No tests match "zzz"');
  });
});

describe('Student tests page: live tests have their own tab', () => {
  const liveTest = (id: string, title: string): StudentExam => ({ ...test(id, title), is_live: true, start_at: '2026-12-01T10:00:00Z' } as StudentExam);

  async function open(live: StudentExam[]) {
    const api = {
      prep: vi.fn(() => of({ preparing: [], families: [], exams: [prepExam('bank', 'Banking', 2)] } as PrepResponse)),
      exams: vi.fn((f: Record<string, unknown> = {}) => of(f['live'] ? live : [])),
    };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StudentService, useValue: api }] });
    const fixture = TestBed.createComponent(StudentTests);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, api, el: fixture.nativeElement as HTMLElement };
  }
  const tabs = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[role="tab"]')].map((t) => t.textContent!.replace(/\s+/g, ' ').trim());

  it('has an Exams tab first and a Live tests tab with the count, so many live tests never push the exams down', async () => {
    const { el } = await open([liveTest('l1', 'Live A'), liveTest('l2', 'Live B'), liveTest('l3', 'Live C')]);
    expect(tabs(el)).toEqual(['Exams', 'Live tests (3)']);
    expect(el.querySelector('mat-card.single')?.textContent).toContain('Banking'); // exams are on the tab that opens first
  });

  it('shows the live tests inside their tab', async () => {
    const { fixture, el } = await open([liveTest('l1', 'Live A'), liveTest('l2', 'Live B')]);
    (el.querySelectorAll<HTMLElement>('[role="tab"]')[1]).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const cards = el.querySelectorAll('mat-card.live-card');
    expect(cards.length).toBe(2);
    expect(el.textContent).toContain('Live A');
  });

  it('says so when there is no live test, and asks the server only once', async () => {
    const { fixture, el, api } = await open([]);
    expect(tabs(el)).toEqual(['Exams', 'Live tests (0)']);
    (el.querySelectorAll<HTMLElement>('[role="tab"]')[1]).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('No live tests right now');
    expect(api.exams.mock.calls.filter((c) => (c[0] as Record<string, unknown>)?.['live']).length).toBe(1);
  });
});
