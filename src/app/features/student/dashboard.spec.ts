import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth.service';
import { StudentDashboard } from './dashboard';
import { Dashboard, StudentExam } from './student.models';
import { StudentService } from './student.service';

const exam = (id: string, title: string, over: Partial<StudentExam> = {}): StudentExam => ({
  id, title, description: '', category: 'cgl', category_name: 'SSC CGL', test_type: 'full_test', test_type_label: 'Full test',
  subject: null, subject_name: null, year: null, thumbnail_url: null, question_count: 100, total_marks: '200.00', duration_minutes: 60,
  start_at: null, end_at: null, max_attempts: 0, attempts_used: 0, negative_marking_enabled: true, sectional_timing: false,
  status: 'available', can_start: true, reason: '', active_attempt_id: null, ...over,
});

function data(over: Partial<Dashboard> = {}): Dashboard {
  return {
    preparing: [{ id: 'cgl', name: 'SSC CGL', total_tests: 10, attempted_tests: 4, group: { id: 'g1', name: 'SSC Exams' } }],
    counts: { available: 7, upcoming: 2, in_progress: 1, completed: 5 },
    average_score_percent: 62.5, accuracy_percent: 71,
    in_progress: [], upcoming: [], recommended: [],
    recent_results: [{ id: 'r1', exam_title: 'CGL Mock 1', score: '120.00', total_marks: '200.00', passed: true, submitted_at: '2026-03-01T10:00:00Z' }],
    trend: [
      { attempt: 'a1', title: 'Mock 1', percentage: 40, submitted_at: '' },
      { attempt: 'a2', title: 'Mock 2', percentage: 55, submitted_at: '' },
      { attempt: 'a3', title: 'Mock 3', percentage: 70, submitted_at: '' },
    ],
    subjects: [
      { subject: 'Maths', accuracy: 82, marks: '10', max_marks: '12' },
      { subject: 'Reasoning', accuracy: 35, marks: '4', max_marks: '12' },
      { subject: 'English', accuracy: 58, marks: '7', max_marks: '12' },
    ],
    activity: { streak: 4, best_streak: 9, today: 3, goal: 10, goal_reached: false, last_7_days: [] },
    ...over,
  } as Dashboard;
}

async function open(d: Dashboard, hour = 9) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 2, 1, hour, 0, 0));
  const api = {
    dashboard: vi.fn(() => of(d)),
    weeklySummary: vi.fn(() => of({ questions: 0, tests: 0 })),
    dailyQuiz: vi.fn(() => of({ available: false, done: false, in_progress: false, size: 10 })),
    exams: vi.fn(() => of([])),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: StudentService, useValue: api },
      { provide: AuthService, useValue: { user: signal({ first_name: 'Asha', username: 'asha' }) } },
    ],
  });
  const f = TestBed.createComponent(StudentDashboard);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement, api };
}

afterEach(() => vi.useRealTimers());

const text = (el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ');

describe('Student dashboard header', () => {
  it('greets by the time of day and by first name', async () => {
    expect((await open(data(), 9)).el.querySelector('h1')!.textContent).toContain('Good morning, Asha');
    TestBed.resetTestingModule();
    expect((await open(data(), 14)).el.querySelector('h1')!.textContent).toContain('Good afternoon');
    TestBed.resetTestingModule();
    expect((await open(data(), 20)).el.querySelector('h1')!.textContent).toContain('Good evening');
  });

  it('shows the daily goal ring and the streak', async () => {
    const { el } = await open(data());
    expect(el.querySelector('.ring-text')!.textContent).toContain('3');
    expect(el.querySelector('.ring-text')!.textContent).toContain('of 10');
    expect(text(el)).toContain('4-day streak');
  });

  it('invites a student with no streak to start one', async () => {
    const { el } = await open(data({ activity: { streak: 0, best_streak: 0, today: 0, goal: 10, goal_reached: false, last_7_days: [] } }));
    expect(text(el)).toContain('Start a streak today');
    expect(text(el)).not.toContain('0-day streak');
  });

  it('the ring is 30 percent drawn at 3 of 10', async () => {
    const { c } = await open(data());
    const circumference = 2 * Math.PI * 52;
    expect(c.goalOffset()).toBeCloseTo(circumference * 0.7, 1);
  });

  it('says how many questions are left to reach the goal, then that it was reached', async () => {
    expect(text((await open(data())).el)).toContain('7 more questions to reach today');
    TestBed.resetTestingModule();
    const done = await open(data({ activity: { streak: 4, best_streak: 9, today: 10, goal: 10, goal_reached: true, last_7_days: [] } }));
    expect(text(done.el)).toContain('reached today');
    expect(text(done.el)).toContain('Goal reached');
  });

  it('the main button resumes a test that is in progress', async () => {
    const { el, c } = await open(data({ in_progress: [exam('t1', 'CGL Mock 3', { status: 'in_progress' })] }));
    expect(c.primary().label).toBe('Resume CGL Mock 3');
    expect(el.querySelector('.hero-actions a')!.getAttribute('href')).toBe('/student/tests/t1');
    expect(text(el)).toContain('You have a test in progress');
  });

  it('otherwise it opens the student’s exam, inside its family when it has one', async () => {
    const { el } = await open(data());
    const a = el.querySelector('.hero-actions a')!;
    expect(a.textContent).toContain('Open SSC CGL');
    expect(a.getAttribute('href')).toBe('/student/tests/family/g1?exam=cgl');
  });

  it('an exam that is in no family opens straight to its tests', async () => {
    const { el } = await open(data({ preparing: [{ id: 'bank', name: 'Banking', total_tests: 3, attempted_tests: 0, group: null }] }));
    expect(el.querySelector('.hero-actions a')!.getAttribute('href')).toBe('/student/tests/exam/bank');
  });

  it('a new student is pointed to the tests page', async () => {
    const { el } = await open(data({ preparing: [] }));
    expect(el.querySelector('.hero-actions a')!.textContent).toContain('Browse tests');
    expect(el.querySelector('.hero-actions a')!.getAttribute('href')).toBe('/student/tests');
  });

  it('always offers practice on weak topics', async () => {
    const { el } = await open(data());
    expect([...el.querySelectorAll('.hero-actions a')].some((a) => a.getAttribute('href') === '/student/practice')).toBe(true);
  });
});

describe('Student dashboard sections', () => {
  it('lists tests in progress right under the header, each with a resume link', async () => {
    const { el } = await open(data({ in_progress: [exam('t1', 'CGL Mock 3', { status: 'in_progress' }), exam('t2', 'CHSL Mock', { status: 'in_progress' })] }));
    const rows = [...el.querySelectorAll('a.resume')];
    expect(rows.map((r) => r.getAttribute('href'))).toEqual(['/student/tests/t1', '/student/tests/t2']);
    expect(text(el)).toContain('Continue where you left off');
    expect(el.querySelector('.hero')!.nextElementSibling).not.toBeNull();
  });

  it('shows no resume section when nothing is in progress', async () => {
    const { el } = await open(data());
    expect(el.querySelector('a.resume')).toBeNull();
    expect(text(el)).not.toContain('Continue where you left off');
  });

  it('shows four key numbers, with in-progress and upcoming counts under the available tests', async () => {
    const { el } = await open(data());
    const kpis = [...el.querySelectorAll('.kpi')].map((k) => text(k as HTMLElement));
    expect(kpis.length).toBe(4);
    expect(kpis[0]).toContain('5');
    expect(kpis[0]).toContain('Tests completed');
    expect(kpis[1]).toContain('62.5%');
    expect(kpis[2]).toContain('71%');
    expect(kpis[3]).toContain('7');
    expect(kpis[3]).toContain('1 in progress · 2 upcoming');
  });

  it('shows a dash for scores before the first result', async () => {
    const { el } = await open(data({ average_score_percent: null, accuracy_percent: null }));
    const kpis = [...el.querySelectorAll('.kpi')].map((k) => text(k as HTMLElement));
    expect(kpis[1]).toContain('—');
    expect(kpis[2]).toContain('—');
  });

  it('shows each exam with its family, a progress ring and a link into the tests flow', async () => {
    const { el, c } = await open(data());
    const card = el.querySelector('.exam')!;
    expect(text(card as HTMLElement)).toContain('SSC Exams');
    expect(text(card as HTMLElement)).toContain('SSC CGL');
    expect(text(card as HTMLElement)).toContain('4 of 10 tests attempted');
    expect(card.querySelector('.mini-ring')!.textContent).toContain('40%');
    expect(card.querySelector('mat-card-actions a')!.getAttribute('href')).toBe('/student/tests/family/g1?exam=cgl');
    expect(c.percent({ id: 'x', name: 'x', total_tests: 0, attempted_tests: 0 })).toBe(0);
  });

  it('asks a student with no exam to pick one', async () => {
    const { el } = await open(data({ preparing: [] }));
    expect(el.querySelector('.exam')).toBeNull();
    expect(text(el)).toContain('Pick your exam to get started');
    expect(el.querySelector('.onboard a')!.getAttribute('href')).toBe('/student/prepare');
  });

  it('puts the weakest subject first and colours the bars by level', async () => {
    const { el, c } = await open(data());
    expect(c.subjects().map((s) => s.subject)).toEqual(['Reasoning', 'English', 'Maths']);
    const fills = [...el.querySelectorAll('.bar-row .fill')].map((f) => f.className);
    expect(fills[0]).toContain('low');
    expect(fills[1]).toContain('mid');
    expect(fills[2]).toContain('high');
    expect(text(el)).toContain('Weakest first');
    expect(text(el)).toContain('Practise Reasoning');
  });

  it('draws the trend with a filled area and says how the latest result changed', async () => {
    const { el, c } = await open(data());
    expect(el.querySelectorAll('svg.trend circle').length).toBe(3);
    expect(el.querySelector('svg.trend polygon')).not.toBeNull();
    expect(c.change()).toBe(15);
    expect(text(el)).toContain('Latest: 70%');
    expect(text(el)).toContain('(+15 points)');
  });

  it('asks for a first result instead of drawing an empty chart', async () => {
    const { el } = await open(data({ trend: [], subjects: [] }));
    expect(el.querySelector('svg.trend')).toBeNull();
    expect(text(el)).toContain('Your trend appears after your first released result');
    expect(text(el)).toContain('No released results yet.');
  });

  it('lists recent results as links with a pass or fail pill', async () => {
    const { el } = await open(data());
    const row = el.querySelector('a.result-row')!;
    expect(row.getAttribute('href')).toBe('/student/results/r1');
    expect(text(row as HTMLElement)).toContain('CGL Mock 1');
    expect(text(row as HTMLElement)).toContain('120.00');
    expect(row.querySelector('.pill')!.className).toContain('pass');
    expect(text(el)).toContain('All attempts');
  });

  it('shows upcoming and suggested tests only when there are some', async () => {
    const none = await open(data());
    expect(text(none.el)).not.toContain('Upcoming tests');
    expect(text(none.el)).not.toContain('Suggested for you');
    TestBed.resetTestingModule();
    const some = await open(data({ upcoming: [exam('u1', 'Later mock', { status: 'upcoming' })], recommended: [exam('s1', 'Try this mock')] }));
    expect(text(some.el)).toContain('Upcoming tests');
    expect(text(some.el)).toContain('Later mock');
    expect(text(some.el)).toContain('Suggested for you');
    expect(text(some.el)).toContain('Try this mock');
  });

  it('shows the live tests strip and the today and week cards', async () => {
    const { api, el } = await open(data());
    expect(api.exams).toHaveBeenCalledWith({ live: 1, category: null });
    expect(text(el)).toContain('Daily goal');
    expect(text(el)).not.toContain('Best streak'); // the streak lives in the header now
  });
});
