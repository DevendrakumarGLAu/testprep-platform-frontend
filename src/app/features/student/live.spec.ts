import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { defer, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { NotifyService } from '../../core/notify.service';
import { LivePage } from './live-page';
import { LiveStrip } from './live-strip';
import { LiveExam, StudentExam } from './student.models';
import { StudentService } from './student.service';
import { TestCard } from './test-card';
import { TestInstructions } from './test-instructions';

const T0 = new Date('2026-03-01T10:00:00Z').getTime();
const at = (minutes: number) => new Date(T0 + minutes * 60_000).toISOString();

function exam(over: Partial<StudentExam> = {}): StudentExam {
  return {
    id: 'live1', title: 'Sunday live mock', description: '', category: 'cgl', category_name: 'SSC CGL', test_type: 'full_test', test_type_label: 'Full test',
    subject: null, subject_name: null, year: null, thumbnail_url: null, question_count: 100, total_marks: '200.00', duration_minutes: 60,
    start_at: at(60), end_at: at(120), max_attempts: 1, attempts_used: 0, negative_marking_enabled: true, sectional_timing: false,
    status: 'upcoming', can_start: false, reason: 'This live test has not started yet.', active_attempt_id: null,
    is_live: true, join_closes_at: at(70), ...over,
  };
}

function live(over: Partial<LiveExam> = {}): LiveExam {
  return { ...exam(), family: 'SSC Exams', ends_at: at(120), late_join_minutes: 10, state: 'upcoming', server_now: at(0), ...over } as LiveExam;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] });
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

async function settle(f: { detectChanges(): void }, ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
  f.detectChanges();
}

describe('Live test page (share link)', () => {
  let api: { live: ReturnType<typeof vi.fn> };

  async function open(data: LiveExam | HttpErrorResponse = live()) {
    api = { live: vi.fn(() => (data instanceof HttpErrorResponse ? throwError(() => data) : of(data))) };
    const error = vi.fn();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StudentService, useValue: api }, { provide: NotifyService, useValue: { error } }] });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const f = TestBed.createComponent(LivePage);
    f.componentRef.setInput('id', 'live1');
    f.detectChanges();
    await settle(f);
    return { f, el: f.nativeElement as HTMLElement, error, navigate };
  }
  const text = (el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ');
  const clock = (el: HTMLElement) => el.querySelector('.clock .big')!.textContent!.trim();

  it('shows the test, its exam and family, and counts down to the start', async () => {
    const { f, el } = await open();
    expect(el.querySelector('h1')!.textContent).toContain('Sunday live mock');
    expect(text(el)).toContain('SSC Exams › SSC CGL');
    expect(text(el)).toContain('LIVE TEST');
    expect(clock(el)).toBe('1:00:00');
    await settle(f, 10_000);
    expect(clock(el)).toBe('59:50');
  });

  it('counts by the server clock, not the browser clock', async () => {
    const { el } = await open(live({ server_now: at(30) })); // the browser thinks it is earlier than the server does
    expect(clock(el)).toBe('30:00');
  });

  it('turns live by itself at the start time, with a countdown to when joining closes', async () => {
    const { f, el } = await open(live({ can_start: true }));
    await settle(f, 60 * 60_000 + 5_000);
    expect(text(el)).toContain('LIVE NOW');
    expect(text(el)).toContain('You can still join for');
    expect(clock(el)).toBe('09:55');
    expect([...el.querySelectorAll('a')].some((a) => a.textContent!.includes('Join now'))).toBe(true);
    expect(api.live).toHaveBeenCalledTimes(1); // no need to ask the server again
  });

  it('says joining has closed, then that the test has ended', async () => {
    const { f, el } = await open();
    await settle(f, 72 * 60_000);
    expect(text(el)).toContain('Joining has closed');
    expect(text(el)).toContain('LIVE TEST OVER');
    await settle(f, 50 * 60_000);
    expect(text(el)).toContain('This live test has ended');
  });

  it('before the start it offers the test page, where the start button opens by itself', async () => {
    const { el } = await open();
    const link = [...el.querySelectorAll('a')].find((a) => a.textContent!.includes('Open the test page'))!;
    expect(link.getAttribute('href')).toBe('/student/tests/live1');
  });

  it('a student already inside gets Resume, and one who finished gets the result', async () => {
    const { el } = await open(live({ status: 'in_progress', can_start: true, active_attempt_id: 'a1' }));
    expect(text(el)).toContain('Resume your attempt');
    TestBed.resetTestingModule();
    const done = await open(live({ status: 'completed', last_attempt_id: 'att9', result_available: true }));
    const a = [...done.el.querySelectorAll('a')].find((x) => x.textContent!.includes('View your result'))!;
    expect(a.getAttribute('href')).toBe('/student/results/att9');
  });

  it('has no sign-up or log-in prompts: only signed-in students ever get here', async () => {
    const { el } = await open();
    expect(text(el)).not.toContain('Create a free account');
    expect(text(el)).not.toContain('Log in');
  });

  it('never shows questions, only the facts about the test', async () => {
    const { el } = await open();
    expect(text(el)).toContain('100');
    expect(text(el)).toContain('200.00');
    expect(el.querySelector('mat-radio-button')).toBeNull();
  });

  it('explains the late-join rule', async () => {
    const { el } = await open();
    expect(text(el)).toContain('you can join up to 10 minutes late');
  });

  it('a test the student may not see sends them back to the tests page with a message', async () => {
    const { error, navigate } = await open(new HttpErrorResponse({ status: 404 }));
    expect(error).toHaveBeenCalledWith('This live test is not available to you.');
    expect(navigate).toHaveBeenCalledWith('/student/tests');
  });
});

describe('Live tests strip', () => {
  async function open(list: StudentExam[], category?: string) {
    const api = { exams: vi.fn(() => of(list)) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StudentService, useValue: api }] });
    const f = TestBed.createComponent(LiveStrip);
    if (category) f.componentRef.setInput('category', category);
    f.detectChanges();
    await settle(f);
    return { f, el: f.nativeElement as HTMLElement, api };
  }
  const text = (el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ');

  it('shows nothing when there is no live test', async () => {
    const { el } = await open([]);
    expect(el.querySelector('section')).toBeNull();
  });

  it('asks only for live tests, and for one exam when told to', async () => {
    const { api } = await open([exam()], 'cgl');
    expect(api.exams).toHaveBeenCalledWith({ live: 1, category: 'cgl' });
    TestBed.resetTestingModule();
    const all = await open([exam()]);
    expect(all.api.exams).toHaveBeenCalledWith({ live: 1, category: null });
  });

  it('lists each live test with a countdown and the way in', async () => {
    const { f, el } = await open([exam()]);
    expect(text(el)).toContain('Sunday live mock');
    expect(text(el)).toContain('SSC CGL');
    expect(text(el)).toContain('Starts in 1:00:00');
    expect(el.querySelector('a')!.getAttribute('href')).toBe('/student/tests/live1');
    expect(el.querySelector('a')!.textContent).toContain('Open');
    await settle(f, 61 * 60_000);
    expect(text(el)).toContain('Live now');
    expect(el.querySelector('a')!.textContent).toContain('Join now');
  });

  it('says joining is closed once the window has passed', async () => {
    const { f, el } = await open([exam()]);
    await settle(f, 75 * 60_000);
    expect(text(el)).toContain('Joining closed');
  });

  it('tells someone already inside that they are in the test', async () => {
    const { el } = await open([exam({ status: 'in_progress', active_attempt_id: 'a1' })]);
    expect(text(el)).toContain('You are in this test');
    expect(el.querySelector('a')!.textContent).toContain('Resume');
  });

  it('shows a finished test as done', async () => {
    const { el } = await open([exam({ status: 'completed' })]);
    expect(text(el)).toContain('Done');
  });
});

describe('Live badge on a test card', () => {
  function render(e: StudentExam) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(TestCard);
    f.componentRef.setInput('exam', e);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it('marks a live test and offers to join it', () => {
    const el = render(exam({ status: 'available', can_start: true }));
    expect(el.querySelector('.live')!.textContent).toContain('LIVE TEST');
    expect(el.textContent).toContain('Join live test');
  });

  it('a normal test has no live badge', () => {
    const el = render(exam({ is_live: false, status: 'available', can_start: true }));
    expect(el.querySelector('.live')).toBeNull();
    expect(el.textContent).toContain('Start');
  });
});

describe('Test page for a live test', () => {
  async function open(initial: StudentExam, later?: StudentExam) {
    // The server answers with its clock as it is when the question is asked.
    let asked = 0;
    const api = {
      exam: vi.fn(() => defer(() => of({ ...(asked++ === 0 ? initial : (later ?? initial)), server_now: new Date(Date.now()).toISOString() }))),
      start: vi.fn(),
    };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StudentService, useValue: api }, { provide: NotifyService, useValue: { error: vi.fn() } }] });
    const f = TestBed.createComponent(TestInstructions);
    f.componentRef.setInput('id', 'live1');
    f.detectChanges();
    await settle(f);
    return { f, el: f.nativeElement as HTMLElement, api };
  }
  const text = (el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ');

  it('counts down to the start and keeps the start button closed', async () => {
    const { f, el } = await open(exam());
    expect(el.querySelector('.live-wait')!.textContent).toContain('Starts in');
    expect(el.querySelector('.live-wait .clock')!.textContent).toContain('1:00:00');
    expect([...el.querySelectorAll('button')].some((b) => b.textContent!.includes('Start test'))).toBe(false);
    expect(text(el)).toContain('This live test has not started yet.');
    await settle(f, 5_000);
    expect(el.querySelector('.live-wait .clock')!.textContent).toContain('59:5');
  });

  it('opens the start button by itself when the time comes, without a refresh', async () => {
    const started = exam({ status: 'available', can_start: true, reason: '' });
    const { f, el, api } = await open(exam(), started);
    await settle(f, 60 * 60_000 + 4_000);
    expect(api.exam.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(text(el)).toContain('The test is on');
    expect([...el.querySelectorAll('button')].some((b) => b.textContent!.includes('Start test'))).toBe(true);
  });

  it('does not keep asking the server every second if the start has not registered yet', async () => {
    const { f, api } = await open(exam());
    await settle(f, 60 * 60_000 + 1_000); // the server still says upcoming (clocks a little apart)
    await settle(f, 9_000);
    expect(api.exam.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it('a normal test shows no countdown', async () => {
    const { el } = await open(exam({ is_live: false, status: 'available', can_start: true, start_at: null, end_at: null }));
    expect(el.querySelector('.live-wait')).toBeNull();
  });
});
