import { BreakpointObserver } from '@angular/cdk/layout';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { MatSidenav } from '@angular/material/sidenav';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifyService } from '../../../core/notify.service';
import { LanguageService } from '../../../shared/language';
import { AttemptState } from '../student.models';
import { StudentService } from '../student.service';
import { AttemptPage } from './attempt';

const T0 = new Date('2026-01-01T10:00:00Z').getTime();

function state(over: Partial<AttemptState> = {}): AttemptState {
  return {
    id: 'att5', status: 'in_progress', attempt_number: 1,
    exam: { id: 'ex1', title: 'Mock', duration_minutes: 1, total_marks: '2', negative_marking_enabled: true },
    server_now: new Date(T0).toISOString(), deadline: new Date(T0 + 60_000).toISOString(), remaining_seconds: 60,
    sections: [{
      name: 'Section A',
      questions: [
        { id: 11, number: 1, text: 'First?', image_url: null, marks: '1', negative_marks: '0.25', selected_option: null, marked_for_review: false, visited: false, time_spent: 0, options: [{ id: 1, text: 'a' }, { id: 2, text: 'b' }] },
        { id: 12, number: 2, text: 'Second?', image_url: null, marks: '1', negative_marks: '0.25', selected_option: null, marked_for_review: false, visited: false, time_spent: 0, options: [{ id: 3, text: 'c' }, { id: 4, text: 'd' }] },
      ],
    }],
    ...over,
  };
}

const ok = { saved: 1, server_now: new Date(T0).toISOString(), deadline: new Date(T0 + 60_000).toISOString(), remaining_seconds: 60 };
/** A real server replies with its current time; a frozen reply would keep resetting the countdown. */
const okNow = () => ({ saved: 1, server_now: new Date(Date.now()).toISOString(), deadline: new Date(T0 + 60_000).toISOString(), remaining_seconds: 60 });
const submitted = { id: 'att5', status: 'submitted', submitted_at: '', auto_submitted: false, result_available: false, result: null };

describe('AttemptPage (exam screen)', () => {
  let api: { attempt: ReturnType<typeof vi.fn>; saveAnswers: ReturnType<typeof vi.fn>; submit: ReturnType<typeof vi.fn> };
  let fixture: ComponentFixture<AttemptPage>;

  async function open(initial: AttemptState = state()) {
    api.attempt.mockReturnValue(of(initial));
    fixture = TestBed.createComponent(AttemptPage);
    fixture.componentRef.setInput('id', 'att5');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const settle = async (ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] });
    vi.setSystemTime(T0);
    api = { attempt: vi.fn(), saveAnswers: vi.fn(() => of(okNow())), submit: vi.fn(() => of(submitted)) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StudentService, useValue: api }] });
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
  });

  it('shows the first question and the server-based countdown', async () => {
    const c = await open();
    expect(c.questions().length).toBe(2);
    expect(c.q()?.q.text).toBe('First?');
    expect(c.clock()).toBe('01:00');
    await settle(10_000);
    expect(c.clock()).toBe('00:50');
  });

  it('uses the server clock, not the browser clock, for the remaining time', async () => {
    // The browser thinks it is 10:00 but the server says only 20 seconds remain.
    const c = await open(state({ deadline: new Date(T0 + 20_000).toISOString() }));
    expect(c.remaining()).toBe(20);
  });

  it('warns at five minutes and at one minute, once each', async () => {
    const warn = vi.spyOn(TestBed.inject(NotifyService), 'warning').mockImplementation(() => undefined);
    const deadline = new Date(T0 + 600_000).toISOString();
    api.saveAnswers.mockImplementation(() => of({ ...okNow(), deadline, remaining_seconds: 600 }));
    await open(state({ deadline, remaining_seconds: 600 }));
    await settle(299_000);
    expect(warn.mock.calls).toEqual([]);
    await settle(2_000); // 299 s left
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('5 minutes');
    await settle(100_000);
    expect(warn).toHaveBeenCalledTimes(1);
    await settle(150_000); // under a minute left
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[1][0]).toContain('1 minute');
    await settle(20_000);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('counts questions the student never opened for the submit summary', async () => {
    const c = await open();
    expect(c.notVisited()).toBe(1); // question 1 is on screen, question 2 was never opened
    c.go(1);
    await settle(0);
    expect(c.notVisited()).toBe(0);
  });

  it('saves a chosen answer shortly after, with the question marked visited', async () => {
    const c = await open();
    c.select(2);
    expect(c.questions()[0].selected_option).toBe(2); // instant, local
    expect(c.saveState()).toBe('saving');
    await settle(300);
    expect(api.saveAnswers).toHaveBeenCalledTimes(1);
    const [id, answers] = api.saveAnswers.mock.calls[0];
    expect(id).toBe('att5');
    expect(answers).toEqual([{ question: 11, visited: true, selected_option: 2 }]);
    expect(c.saveState()).toBe('saved');
  });

  it('batches rapid changes into one request and keeps only the latest choice', async () => {
    const c = await open();
    c.select(1);
    c.select(2);
    c.toggleMark();
    await settle(300);
    expect(api.saveAnswers).toHaveBeenCalledTimes(1);
    expect(api.saveAnswers.mock.calls[0][1]).toEqual([{ question: 11, visited: true, selected_option: 2, marked_for_review: true }]);
  });

  it('clearing a response sends null', async () => {
    const c = await open();
    c.select(1);
    await settle(300);
    c.clear();
    await settle(300);
    expect(api.saveAnswers.mock.calls.at(-1)![1]).toEqual([{ question: 11, selected_option: null }]);
    expect(c.questions()[0].selected_option).toBeNull();
  });

  it('keeps answers queued while offline and retries until they are saved', async () => {
    const c = await open();
    api.saveAnswers.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    c.select(1);
    await settle(300);
    expect(c.saveState()).toBe('offline');
    expect(c.questions()[0].selected_option).toBe(1); // the student still sees their answer

    await settle(4000);
    expect(api.saveAnswers).toHaveBeenCalledTimes(2);
    expect(api.saveAnswers.mock.calls[1][1]).toEqual(api.saveAnswers.mock.calls[0][1]); // nothing was lost
    expect(c.saveState()).toBe('saved');
  });

  it('moves between questions, tracks palette states and counts', async () => {
    const c = await open();
    c.select(1);
    c.go(1);
    expect(c.q()?.q.text).toBe('Second?');
    c.toggleMark();
    const states = c.groups()[0].items.map((i) => i.state);
    expect(states).toEqual(['answered', 'marked']);
    expect(c.counts()).toEqual({ answered: 1, unanswered: 1, marked: 1 });
    c.go(5); // out of range is ignored
    c.go(-1);
    expect(c.index()).toBe(1);
  });

  it('reloads from the server when a save is rejected because the attempt already ended', async () => {
    const c = await open();
    api.saveAnswers.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409, error: { status: 'submitted' } })));
    api.attempt.mockReturnValue(of(state({ status: 'submitted', result_available: false, result: null, auto_submitted: true })));
    c.select(1);
    await settle(300);
    expect(api.attempt).toHaveBeenCalledTimes(2);
    expect(c.finished()).toEqual({ result: null, autoSubmitted: true });
  });

  it('submits automatically when the timer reaches zero', async () => {
    const c = await open();
    c.select(1);
    await settle(61_000);
    await settle(0);
    expect(api.submit).toHaveBeenCalledWith('att5');
    expect(c.finished()).toBeTruthy();
    expect(api.saveAnswers).toHaveBeenCalled(); // the pending answer went out before submitting
  });

  it('keeps retrying the submission at the deadline if the network is down', async () => {
    const c = await open();
    api.submit.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 }))).mockReturnValue(of(submitted));
    await settle(61_000);
    await settle(3100);
    expect(api.submit).toHaveBeenCalledTimes(2);
    expect(c.finished()).toBeTruthy();
  });

  it('opens an already submitted attempt as finished and allows no answering', async () => {
    const c = await open(state({ status: 'submitted', sections: undefined, result_available: true, result: {
      score: '2.00', total_marks: '2.00', passing_marks: '1.00', passed: true, correct: 2, incorrect: 0, unanswered: 0, accuracy: '100.00', time_taken_seconds: 30,
    } }));
    expect(c.finished()?.result?.score).toBe('2.00');
    c.select(1);
    await settle(500);
    expect(api.saveAnswers).not.toHaveBeenCalled();
  });

  it('resumes at the first unanswered question after a refresh', async () => {
    const s = state();
    s.sections![0].questions[0].selected_option = 1;
    s.sections![0].questions[0].visited = true;
    const c = await open(s);
    expect(c.index()).toBe(1);
  });
});


describe('AttemptPage time per question', () => {
  let fixture: ComponentFixture<AttemptPage>;
  let api: { attempt: ReturnType<typeof vi.fn>; saveAnswers: ReturnType<typeof vi.fn>; submit: ReturnType<typeof vi.fn> };

  async function open(initial: AttemptState = state()) {
    api.attempt.mockReturnValue(of(initial));
    fixture = TestBed.createComponent(AttemptPage);
    fixture.componentRef.setInput('id', 'att5');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const settle = async (ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  };

  /** Every time value sent so far, in order: [question id, seconds]. */
  const timesSent = () =>
    api.saveAnswers.mock.calls.flatMap(([, answers]) =>
      (answers as { question: number; time_spent?: number }[]).filter((a) => a.time_spent !== undefined).map((a) => [a.question, a.time_spent]),
    );

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] });
    vi.setSystemTime(T0);
    api = { attempt: vi.fn(), saveAnswers: vi.fn(() => of(okNow())), submit: vi.fn(() => of(submitted)) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StudentService, useValue: api }] });
  });

  afterEach(() => {
    Reflect.deleteProperty(document, 'hidden');
    fixture?.destroy();
    vi.useRealTimers();
  });

  it('reports the time on the question on screen in the background, without a "Saving" flicker', async () => {
    const c = await open();
    await settle(12_000); // the 10 s tick queues the time, which is sent about 1.5 s later
    expect(c.saveState()).toBe('saved');
    expect(timesSent()).toEqual([[11, 10]]);
  });

  it('credits the time to the question being left when moving on', async () => {
    const c = await open();
    await settle(7_000);
    c.go(1);
    await settle(2_000);
    expect(timesSent()).toContainEqual([11, 7]);
    await settle(4_000);
    c.go(0);
    await settle(2_000);
    expect(timesSent()).toContainEqual([12, 6]); // 3 s credited by the 10 s tick, 3 s more when leaving
  });

  it('sends running totals, so a retry resends the same value instead of adding it twice', async () => {
    await open();
    await settle(1_000); // let the initial "visited" save go through first
    api.saveAnswers.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    await settle(11_000); // the 10 s tick queues 10 and the send (1.5 s later) fails
    await settle(4_000); // the retry
    expect(timesSent()).toEqual([[11, 10], [11, 10]]);
  });

  it('continues from the time already saved when the student comes back to the attempt', async () => {
    const s = state();
    s.sections![0].questions[0].time_spent = 30;
    await open(s);
    await settle(12_000);
    expect(timesSent()).toEqual([[11, 40]]);
  });

  it('does not count time while the tab is hidden', async () => {
    await open();
    await settle(3_000);
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await settle(60_000); // student is away for a minute
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await settle(12_000);
    const seconds = timesSent().map(([, t]) => t as number);
    expect(Math.max(...seconds)).toBeLessThan(20); // naive counting would give 75
    expect(Math.max(...seconds)).toBeGreaterThanOrEqual(3);
  });

  const clock = () => (fixture.nativeElement as HTMLElement).querySelector('.qtime')!.textContent!.replace(/\s+/g, ' ').trim();

  it('shows a live stopwatch for the question on screen', async () => {
    await open();
    expect(clock()).toContain('0:00');
    await settle(5_000);
    expect(clock()).toContain('0:05');
    await settle(61_000 - 5_000 - 1_000); // 55 s more, still before the 60 s deadline
    expect(clock()).toContain('1:00');
  });

  it('keeps a separate time for each question and picks up where it left off', async () => {
    const c = await open();
    await settle(5_000);
    c.go(1);
    await settle(0);
    expect(clock()).toContain('0:00');
    await settle(3_000);
    expect(clock()).toContain('0:03');
    c.go(0);
    await settle(0);
    expect(clock()).toContain('0:05'); // back on question 1 with its earlier time, not restarted
    await settle(2_000);
    expect(clock()).toContain('0:07');
  });

  it('starts from the time already saved when the student returns', async () => {
    const s = state();
    s.sections![0].questions[0].time_spent = 65;
    await open(s);
    expect(clock()).toContain('1:05');
  });

  it('stops the stopwatch while the tab is hidden', async () => {
    await open();
    await settle(4_000);
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await settle(30_000);
    expect(clock()).toContain('0:04');
  });

  it('includes the final seconds when the test is submitted', async () => {
    const c = await open();
    await settle(4_000);
    c.confirmSubmit = () => undefined;
    await (c as unknown as { submit(auto: boolean): Promise<void> }).submit(false);
    expect(timesSent()).toContainEqual([11, 4]);
    expect(api.submit).toHaveBeenCalled();
  });
});

describe('AttemptPage subject tabs', () => {
  let fixture: ComponentFixture<AttemptPage>;
  const api = { attempt: vi.fn(), saveAnswers: vi.fn(() => of(okNow())), submit: vi.fn(() => of(submitted)) };

  function q(id: number, number: number) {
    return {
      id, number, text: `Question ${number}`, image_url: null, marks: '1', negative_marks: '0', selected_option: null as number | null,
      marked_for_review: false, visited: false, time_spent: 0, options: [{ id: id * 10, text: 'a' }, { id: id * 10 + 1, text: 'b' }],
    };
  }

  const subjects = () =>
    state({ sections: [{ name: 'Maths', questions: [q(1, 1), q(2, 2)] }, { name: 'GK', questions: [q(3, 3), q(4, 4)] }, { name: 'English', questions: [q(5, 5)] }] });

  async function open(data: AttemptState = subjects()) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: StudentService, useValue: api },
        { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false, breakpoints: {} }) } },
      ],
    });
    api.attempt.mockReturnValue(of(data));
    fixture = TestBed.createComponent(AttemptPage);
    fixture.componentRef.setInput('id', 'att5');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  const tabs = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('nav.sections [role="tab"]')];
  const text = (t: HTMLElement) => t.textContent!.replace(/\s+/g, ' ').trim();
  const refresh = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => fixture?.destroy());

  it('shows a tab for every subject with progress, the current one highlighted and the rest upcoming', async () => {
    const { el } = await open();
    expect(tabs(el).map(text)).toEqual(['Maths 0/2 answered', 'GK Upcoming', 'English Upcoming']);
    expect(tabs(el).map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(tabs(el)[0].classList).toContain('active');
  });

  it('marks a subject done once all its questions are answered', async () => {
    const { c, el } = await open();
    c.select(10);
    c.go(1);
    c.select(20);
    await refresh();
    expect(text(tabs(el)[0])).toContain('2/2 answered');
    expect(tabs(el)[0].classList).toContain('closed');
  });

  it('clicking a subject jumps to its first unanswered question and makes it current', async () => {
    const { c, el } = await open();
    tabs(el)[1].click();
    await refresh();
    expect(c.index()).toBe(2);
    expect(el.textContent).toContain('Question 3');
    expect(tabs(el)[1].getAttribute('aria-selected')).toBe('true');
    expect(text(tabs(el)[0])).toContain('0/2 answered'); // left, not "upcoming" any more
    expect(text(tabs(el)[2])).toContain('Upcoming'); // English is still ahead
  });

  it('jumps to the first unanswered question inside a partly done subject', async () => {
    const { c, el } = await open();
    c.select(10); // answer Maths Q1 only
    tabs(el)[2].click(); // go to English
    await refresh();
    tabs(el)[0].click(); // and back to Maths
    await refresh();
    expect(c.index()).toBe(1); // Q2, the first still unanswered
  });

  it('goes to the first question when everything in the subject is answered', async () => {
    const { c, el } = await open();
    c.select(10);
    c.go(1);
    c.select(20);
    tabs(el)[2].click();
    await refresh();
    tabs(el)[0].click();
    await refresh();
    expect(c.index()).toBe(0);
  });

  it('is not shown when a test has a single section', async () => {
    const { el } = await open(state());
    expect(el.querySelector('nav.sections')).toBeNull();
  });
});

describe('AttemptPage timed sections', () => {
  let fixture: ComponentFixture<AttemptPage>;
  let api: { attempt: ReturnType<typeof vi.fn>; saveAnswers: ReturnType<typeof vi.fn>; submit: ReturnType<typeof vi.fn>; submitSection: ReturnType<typeof vi.fn> };
  let notify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };

  const q = (id: number, number: number) => ({
    id, number, text: `Question ${number}`, image_url: null, marks: '1', negative_marks: '0', selected_option: null as number | null,
    marked_for_review: false, visited: false, time_spent: 0, options: [{ id: id * 10, text: 'a' }, { id: id * 10 + 1, text: 'b' }],
  });
  type Meta = NonNullable<AttemptState['sections']>[number];
  const done = (name: string, order: number, closed: 'submitted' | 'expired' = 'submitted'): Meta =>
    ({ name, order, status: 'done', duration_seconds: 600, question_count: 2, answered_count: 1, closed_by: closed, questions: [] });
  const active = (name: string, order: number, questions: ReturnType<typeof q>[], remaining = 20): Meta =>
    ({ name, order, status: 'active', duration_seconds: 600, remaining_seconds: remaining, question_count: questions.length, answered_count: 0, closed_by: null, questions });
  const upcoming = (name: string, order: number): Meta =>
    ({ name, order, status: 'upcoming', duration_seconds: 300, question_count: 2, answered_count: 0, closed_by: null, questions: [] });

  /** Maths open (20 s left of its section; 60 s left in the whole test), GK and English still to come. */
  const inMaths = () =>
    state({ sectional: true, active_section: 0, sections: [active('Maths', 0, [q(1, 1), q(2, 2)]), upcoming('GK', 1), upcoming('English', 2)] });
  const inGk = () =>
    state({ sectional: true, active_section: 1, sections: [done('Maths', 0, 'expired'), active('GK', 1, [q(3, 3), q(4, 4)], 300), upcoming('English', 2)] });
  const inEnglish = () =>
    state({ sectional: true, active_section: 2, sections: [done('Maths', 0), done('GK', 1), active('English', 2, [q(5, 5)], 20)] });

  async function open(first: AttemptState) {
    api = { attempt: vi.fn(), saveAnswers: vi.fn(() => of(okNow())), submit: vi.fn(() => of(submitted)), submitSection: vi.fn() };
    notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: StudentService, useValue: api },
        { provide: NotifyService, useValue: notify },
        { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false, breakpoints: {} }) } },
      ],
    });
    api.attempt.mockReturnValue(of(first));
    fixture = TestBed.createComponent(AttemptPage);
    fixture.componentRef.setInput('id', 'att5');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    return { c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  const settle = async (ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  };
  const tabs = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('nav.sections button')];
  const txt = (e: Element) => e.textContent!.replace(/\s+/g, ' ').trim();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] });
    vi.setSystemTime(T0);
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
  });

  it('shows the section timer first and the whole-test timer beside it', async () => {
    const { el } = await open(inMaths());
    expect(txt(el.querySelector('.timer')!)).toContain('00:20');
    expect(txt(el.querySelector('.total')!)).toBe('Test 01:00');
    await settle(5_000);
    expect(txt(el.querySelector('.timer')!)).toContain('00:15');
    expect(txt(el.querySelector('.total')!)).toBe('Test 00:55');
  });

  it('only the open section is available: others are locked and their questions are not loaded', async () => {
    const { c, el } = await open(inMaths());
    expect(c.questions().map((x) => x.number)).toEqual([1, 2]);
    expect(el.querySelectorAll('.palette button.num').length).toBe(2);
    expect(tabs(el).map((t) => t.disabled)).toEqual([false, true, true]);
    expect(tabs(el).map(txt)).toEqual(['Maths 0/2 answered', 'GK Upcoming · 5 min', 'English Upcoming · 5 min']);
    tabs(el)[1].click();
    c.openSection('GK');
    fixture.detectChanges();
    expect(c.index()).toBe(0);
    expect(el.textContent).toContain('Question 1');
  });

  it('the main button submits the section, and in the last section it submits the test', async () => {
    const maths = await open(inMaths());
    expect(txt(maths.el.querySelector('header .right button')!)).toBe('Submit section');
    fixture.destroy();
    TestBed.resetTestingModule();
    const last = await open(inEnglish());
    expect(txt(last.el.querySelector('header .right button')!)).toBe('Submit test');
  });

  it('when the section timer runs out the next section opens by itself and the student is told', async () => {
    const { c, el } = await open(inMaths());
    c.select(10);
    // a real server answers with its current time
    api.attempt.mockImplementation(() => of({ ...inGk(), server_now: new Date(Date.now()).toISOString() }));
    await settle(21_000);
    await settle(0);
    expect(api.attempt).toHaveBeenCalledTimes(2);
    expect(c.questions().map((x) => x.number)).toEqual([3, 4]);
    expect(txt(tabs(el)[0])).toContain('Time over'); // finished: locked, with a tick
    expect(tabs(el)[0].disabled).toBe(true);
    expect(tabs(el).slice(1).map(txt)).toEqual(['GK 0/2 answered', 'English Upcoming · 5 min']);
    expect(tabs(el)[1].classList).toContain('active');
    expect(notify.success).toHaveBeenCalledWith('Time for Maths is over. You are now in GK.');
    expect(txt(el.querySelector('.timer')!)).toMatch(/05:00|04:5\d/); // GK's own 5 minutes, already ticking
    // The answer given in Maths was saved before moving on.
    expect(api.saveAnswers.mock.calls.flatMap((x) => x[1]).some((a: { selected_option?: number }) => a.selected_option === 10)).toBe(true);
  });

  it('keeps looking again if the server says the section is still open (clocks a little apart)', async () => {
    const { c } = await open(inMaths());
    api.attempt.mockReturnValue(of(inMaths())); // the server thinks there is still time
    await settle(21_000);
    await settle(0);
    const calls = api.attempt.mock.calls.length;
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(c.questions().map((x) => x.number)).toEqual([1, 2]);
    await settle(10_000); // not hammering the server every second
    expect(api.attempt.mock.calls.length).toBeLessThan(calls + 6);
  });

  it('submitting a section saves first, then moves to the next one', async () => {
    const { c, el } = await open(inMaths());
    c.select(10);
    api.submitSection.mockReturnValue(of({ ...inGk(), moved: true }));
    await (c as unknown as { submitSection(): Promise<void> }).submitSection();
    await settle(0);
    expect(api.submitSection).toHaveBeenCalledWith('att5', 0);
    expect(c.questions().map((x) => x.number)).toEqual([3, 4]);
    expect(notify.success).toHaveBeenCalledWith(expect.stringContaining('GK'));
    expect(tabs(el)[0].disabled).toBe(true);
    // the answer was sent before the section was submitted
    const saveOrder = api.saveAnswers.mock.invocationCallOrder.at(-1)!;
    expect(saveOrder).toBeLessThan(api.submitSection.mock.invocationCallOrder[0]);
  });

  it('does not submit the section if the latest answers cannot be saved', async () => {
    const { c } = await open(inMaths());
    api.saveAnswers.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    c.select(10);
    const submitting = (c as unknown as { submitSection(): Promise<void> }).submitSection();
    await vi.advanceTimersByTimeAsync(5_000);
    await submitting;
    expect(api.submitSection).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('Cannot reach the server'));
  });

  it('the last section hands over to the normal submit when the whole test ends', async () => {
    const { c } = await open(inEnglish());
    await settle(61_000);
    await settle(0);
    expect(api.submit).toHaveBeenCalledWith('att5');
    expect(c.finished()).toBeTruthy();
    expect(api.attempt).toHaveBeenCalledTimes(1); // no pointless reload: nothing is left to open
  });

  it('reloads when the server reports answers it ignored because a section had just closed', async () => {
    const { c } = await open(inMaths());
    api.saveAnswers.mockReturnValueOnce(of({ ...okNow(), ignored: 1 }));
    api.attempt.mockReturnValue(of(inGk()));
    c.select(10);
    await settle(400);
    await settle(0);
    expect(api.attempt).toHaveBeenCalledTimes(2);
    expect(c.questions().map((x) => x.number)).toEqual([3, 4]);
  });
});

describe('AttemptPage question palette layout', () => {
  let fixture: ComponentFixture<AttemptPage>;
  const api = { attempt: vi.fn(), saveAnswers: vi.fn(() => of(okNow())), submit: vi.fn(() => of(submitted)) };

  async function open(phone: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: StudentService, useValue: api },
        { provide: BreakpointObserver, useValue: { observe: () => of({ matches: phone, breakpoints: {} }) } },
      ],
    });
    api.attempt.mockReturnValue(of(state()));
    fixture = TestBed.createComponent(AttemptPage);
    fixture.componentRef.setInput('id', 'att5');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const drawer = () => fixture.debugElement.query(By.directive(MatSidenav)).componentInstance as MatSidenav;
  const burger = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('button[aria-label="Open question palette"]');

  afterEach(() => fixture?.destroy());

  it('on a phone: no palette under the question, a burger button instead', async () => {
    const el = await open(true);
    expect(el.querySelector('aside.palette')).toBeNull();
    expect(burger(el)).not.toBeNull();
    expect(drawer().opened).toBe(false);
  });

  it('on a phone: the burger opens a drawer containing every question number', async () => {
    const el = await open(true);
    burger(el)!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(drawer().opened).toBe(true);
    const drawerEl = el.querySelector('mat-sidenav')!;
    const buttons = drawerEl.querySelectorAll('button.num');
    expect(buttons.length).toBe(2);
    expect(drawerEl.textContent).toContain('Section A');
    expect(drawerEl.textContent).toContain('0 answered');
  });

  it('on a phone: picking a question from the drawer jumps to it and closes the drawer', async () => {
    const el = await open(true);
    burger(el)!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    el.querySelectorAll<HTMLButtonElement>('mat-sidenav button.num')[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.index()).toBe(1);
    expect(el.textContent).toContain('Second?');
    expect(drawer().opened).toBe(false);
  });

  it('on a phone: the close button inside the drawer works', async () => {
    const el = await open(true);
    burger(el)!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('button[aria-label="Close question palette"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(drawer().opened).toBe(false);
  });

  it('on a wide screen: the palette stays beside the question and there is no burger', async () => {
    const el = await open(false);
    expect(el.querySelector('aside.palette')).not.toBeNull();
    expect(el.querySelectorAll('aside.palette button.num').length).toBe(2);
    expect(burger(el)).toBeNull();
    expect(el.querySelectorAll('button.num').length).toBe(2); // not duplicated into the hidden drawer
  });
});

describe('AttemptPage question language', () => {
  const bilingual = () => {
    const s = state({ languages: ['en', 'hi'] });
    const [q1, q2] = s.sections![0].questions;
    q1.text_hi = 'पहला?';
    q1.options[0].text_hi = 'क';
    q1.options[1].text_hi = 'ख';
    q2.text = '';
    q2.text_hi = 'दूसरा?'; // a question that exists only in Hindi
    q2.options.forEach((o, i) => ((o.text = ''), (o.text_hi = i ? 'घ' : 'ग')));
    return s;
  };

  async function open(first: AttemptState) {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: StudentService, useValue: { attempt: vi.fn(() => of(first)), saveAnswers: vi.fn(() => of(okNow())), submit: vi.fn(() => of(submitted)) } },
        { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false, breakpoints: {} }) } },
      ],
    });
    const fixture = TestBed.createComponent(AttemptPage);
    fixture.componentRef.setInput('id', 'att5');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  const dropdown = (el: HTMLElement) => el.querySelector('app-lang-switch mat-select');
  const stem = (el: HTMLElement) => el.querySelector('.q-text')!.textContent!.trim();

  it('shows the language dropdown and starts in English', async () => {
    const { el } = await open(bilingual());
    expect(dropdown(el)!.textContent).toContain('English');
    expect(stem(el)).toBe('First?');
  });

  it('switches question and options to Hindi, and the choice is kept for the next question', async () => {
    const { fixture, c, el } = await open(bilingual());
    TestBed.inject(LanguageService).set('hi'); // what the dropdown does when Hindi is picked
    fixture.detectChanges();
    expect(dropdown(el)!.textContent).toContain('हिन्दी');
    expect(stem(el)).toBe('पहला?');
    expect([...el.querySelectorAll('.opt')].map((o) => o.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['A. क', 'B. ख']);
    c.go(1);
    fixture.detectChanges();
    expect(stem(el)).toBe('दूसरा?');
    expect(localStorage.getItem('tp_lang')).toBe('hi');
  });

  it('a question missing in the chosen language is shown in the other one', async () => {
    const { fixture, c, el } = await open(bilingual());
    c.go(1);
    fixture.detectChanges();
    expect(stem(el)).toBe('दूसरा?'); // English chosen, but only Hindi exists
    expect(el.querySelectorAll('.opt').length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('ग');
  });

  it('has no dropdown for a one-language test', async () => {
    const { el } = await open(state({ languages: ['en'] }));
    expect(dropdown(el)).toBeNull();
  });
});

describe('AttemptPage pausing', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let fixture: ComponentFixture<AttemptPage>;
  const pauseInfo = (over: Record<string, unknown> = {}) => ({
    allowed: true, paused: false, paused_at: null, auto_resume_at: null, max_minutes: 10, pauses_used: 0, pauses_left: 3, ...over,
  });
  const pausedState = (over: Partial<AttemptState> = {}) =>
    state({
      paused: true, sections: [], remaining_seconds: 45, // the stored deadline is stale while paused
      deadline: new Date(T0 - 3600_000).toISOString(),
      pause: pauseInfo({ paused: true, paused_at: new Date(T0).toISOString(), auto_resume_at: new Date(T0 + 600_000).toISOString(), pauses_used: 1, pauses_left: 2 }),
      ...over,
    });

  async function open(initial: AttemptState) {
    api['attempt'].mockReturnValue(of(initial));
    fixture = TestBed.createComponent(AttemptPage);
    fixture.componentRef.setInput('id', 'att5');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    return fixture.componentInstance;
  }
  const settle = async (ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  };
  const html = () => fixture.nativeElement as HTMLElement;
  const button = (cls: string) => html().querySelector(cls) as HTMLButtonElement | null;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] });
    vi.setSystemTime(T0);
    api = { attempt: vi.fn(), saveAnswers: vi.fn(() => of(okNow())), submit: vi.fn(() => of(submitted)), pause: vi.fn(), resume: vi.fn() };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StudentService, useValue: api }] });
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
  });

  it('shows a Pause button when the test allows it', async () => {
    await open(state({ pause: pauseInfo() }));
    expect(button('.pause-btn')).not.toBeNull();
    expect(button('.pause-btn')!.disabled).toBe(false);
    expect(button('.pause-btn')!.getAttribute('title')).toContain('3 pauses left');
  });

  it('with no pause limit the Pause button says the student can come back any time', async () => {
    await open(state({ pause: pauseInfo({ max_minutes: 0, pauses_left: null }) }));
    const title = button('.pause-btn')!.getAttribute('title')!;
    expect(title).toContain('come back whenever you like');
    expect(title).toContain('Unlimited pauses');
    expect(title).not.toContain('minutes');
  });

  it('has no Pause button when the test does not allow pausing', async () => {
    await open(state({ pause: pauseInfo({ allowed: false }) }));
    expect(button('.pause-btn')).toBeNull();
    fixture.destroy();
    await open(state());
    expect(button('.pause-btn')).toBeNull();
  });

  it('disables Pause once every pause has been used', async () => {
    await open(state({ pause: pauseInfo({ pauses_left: 0, pauses_used: 3 }) }));
    expect(button('.pause-btn')!.disabled).toBe(true);
    expect(button('.pause-btn')!.getAttribute('title')).toContain('used all');
  });

  it('pausing saves the latest answers first, then hides the questions and shows the frozen time', async () => {
    const c = await open(state({ pause: pauseInfo() }));
    c.select(1);
    api['pause'].mockReturnValue(of(pausedState()));
    await c.pauseTest();
    await settle(0);
    expect(api['saveAnswers']).toHaveBeenCalled();
    expect(api['saveAnswers'].mock.invocationCallOrder[0]).toBeLessThan(api['pause'].mock.invocationCallOrder[0]);
    expect(c.paused()).toBe(true);
    expect(c.questions().length).toBe(0);
    expect(html().textContent).toContain('Test paused');
    expect(html().textContent).toContain('00:45');
    expect(html().querySelector('.q-text')).toBeNull();
    // the frozen time does not move
    await settle(20_000);
    expect(html().textContent).toContain('00:45');
  });

  it('does not pause when the answers cannot be saved', async () => {
    const c = await open(state({ pause: pauseInfo() }));
    c.select(1);
    api['saveAnswers'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    const p = c.pauseTest();
    await settle(30_000);
    await p;
    expect(api['pause']).not.toHaveBeenCalled();
    expect(c.paused()).toBe(false);
  });

  it('Resume restarts the test and brings the questions back', async () => {
    const c = await open(pausedState());
    expect(c.paused()).toBe(true);
    expect(c.questions().length).toBe(0);
    api['resume'].mockReturnValue(of(state({ pause: pauseInfo({ pauses_used: 1, pauses_left: 2 }) })));
    await c.resumeTest();
    await settle(0);
    expect(api['resume']).toHaveBeenCalledWith('att5');
    expect(c.paused()).toBe(false);
    expect(c.questions().length).toBe(2);
    expect(c.clock()).toBe('01:00');
    expect(html().textContent).toContain('First?');
  });

  it('an attempt opened while paused stays paused and is not auto-submitted although the stored deadline has passed', async () => {
    const c = await open(pausedState());
    await settle(5_000);
    expect(c.paused()).toBe(true);
    expect(api['submit']).not.toHaveBeenCalled();
    expect(html().textContent).toContain('Test paused');
  });

  it('counts down to the automatic restart and reloads the test when it arrives', async () => {
    const autoAt = new Date(T0 + 5_000).toISOString();
    const c = await open(pausedState({ pause: pauseInfo({ paused: true, paused_at: new Date(T0).toISOString(), auto_resume_at: autoAt, pauses_used: 1, pauses_left: 2 }) }));
    expect(c.autoResumeIn()).toBe(5);
    api['attempt'].mockReturnValue(of(state({ pause: pauseInfo({ pauses_used: 1, pauses_left: 2 }) })));
    await settle(6_000);
    expect(c.paused()).toBe(false);
    expect(c.questions().length).toBe(2);
  });

  it('shows the server message and the real state when a pause is refused', async () => {
    const notify = vi.spyOn(TestBed.inject(NotifyService), 'error').mockImplementation(() => undefined);
    const c = await open(state({ pause: pauseInfo() }));
    api['pause'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'You have used all 3 pauses for this test.' } })));
    await c.pauseTest();
    await settle(0);
    expect(notify).toHaveBeenCalledWith('You have used all 3 pauses for this test.');
    expect(c.paused()).toBe(false);
  });

  it('a save refused because the test is paused reloads into the paused screen', async () => {
    const c = await open(state({ pause: pauseInfo() }));
    api['saveAnswers'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'The test is paused.', paused: true } })));
    api['attempt'].mockReturnValue(of(pausedState()));
    c.select(1);
    await settle(1_000);
    expect(c.paused()).toBe(true);
  });
});


describe('AttemptPage question picture', () => {
  let fixture: ComponentFixture<AttemptPage>;
  let api: Record<string, ReturnType<typeof vi.fn>>;

  async function open(imageUrl: string | null) {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] });
    vi.setSystemTime(T0);
    const s = state();
    s.sections![0].questions[0] = { ...s.sections![0].questions[0], image_url: imageUrl };
    api = { attempt: vi.fn(() => of(s)), saveAnswers: vi.fn(() => of(okNow())), submit: vi.fn(() => of(submitted)) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StudentService, useValue: api }] });
    fixture = TestBed.createComponent(AttemptPage);
    fixture.componentRef.setInput('id', 'att5');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    return { c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
  });

  it('shows the picture of the question from its storage address', async () => {
    const { el } = await open('https://cdn.example/storage/questions/fig.png');
    const img = el.querySelector('img.zoomable') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://cdn.example/storage/questions/fig.png');
    expect(img.getAttribute('alt')).toBe('Question image');
    expect(img.getAttribute('title')).toBe('Tap to enlarge');
  });

  it('a question without a picture shows none', async () => {
    const { el } = await open(null);
    expect(el.querySelector('img.zoomable')).toBeNull();
  });

  it('tapping the picture, or pressing Enter on it, opens it at full size', async () => {
    const { c, el } = await open('https://cdn.example/storage/questions/fig.png');
    const zoom = vi.spyOn(c, 'zoom').mockImplementation(() => undefined);
    const img = el.querySelector('img.zoomable') as HTMLImageElement;
    img.click();
    img.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(zoom).toHaveBeenCalledTimes(2);
    expect(zoom).toHaveBeenCalledWith('https://cdn.example/storage/questions/fig.png');
  });

  it('the picture can be reached with the keyboard', async () => {
    const { el } = await open('https://cdn.example/storage/questions/fig.png');
    const img = el.querySelector('img.zoomable') as HTMLImageElement;
    expect(img.getAttribute('tabindex')).toBe('0');
    expect(img.getAttribute('role')).toBe('button');
  });
});

describe('AttemptPage back arrow', () => {
  let fixture: ComponentFixture<AttemptPage>;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let back: ReturnType<typeof vi.fn>;

  const pauseInfo = (over: Record<string, unknown> = {}) => ({ allowed: true, paused: false, paused_at: null, auto_resume_at: null, max_minutes: 0, pauses_used: 0, pauses_left: null, ...over });
  const pausedReply = (): AttemptState => state({ paused: true, sections: [], remaining_seconds: 45, pause: pauseInfo({ paused: true, paused_at: new Date(T0).toISOString() }) } as Partial<AttemptState>);

  async function open(pause: Record<string, unknown> | undefined, dialogAnswer = true) {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] });
    vi.setSystemTime(T0);
    api = {
      attempt: vi.fn(() => of(state({ pause: pause as never }))), saveAnswers: vi.fn(() => of(okNow())), submit: vi.fn(() => of(submitted)),
      pause: vi.fn(() => of(pausedReply())),
    };
    back = vi.fn();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StudentService, useValue: api }, { provide: Location, useValue: { back } }] });
    fixture = TestBed.createComponent(AttemptPage);
    fixture.componentRef.setInput('id', 'att5');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    const dialog = (c as unknown as { dialog: { open: (...a: unknown[]) => unknown } }).dialog;
    const opened = vi.spyOn(dialog, 'open').mockReturnValue({ afterClosed: () => of(dialogAnswer) } as never);
    window.history.pushState({}, '', '/somewhere'); // there is a page to go back to
    return { c, opened, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
  });

  it('shows a back arrow in the top bar', async () => {
    const { el } = await open(pauseInfo());
    const b = el.querySelector('button.back') as HTMLButtonElement;
    expect(b.textContent).toContain('arrow_back');
    expect(b.getAttribute('aria-label')).toContain('Go back');
  });

  describe('when the test allows pausing', () => {
    it('pauses the test and goes back, without asking and without submitting', async () => {
      const { c, opened } = await open(pauseInfo());
      await c.leave();
      expect(api['pause']).toHaveBeenCalledTimes(1);
      expect(opened).not.toHaveBeenCalled();
      expect(back).toHaveBeenCalled();
      expect(api['submit']).not.toHaveBeenCalled();
      expect(c.paused()).toBe(true);
    });

    it('stays on the test and says why when the pause did not happen', async () => {
      const { c } = await open(pauseInfo());
      api['pause'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403, error: { detail: 'Not allowed.' } })));
      await c.leave();
      expect(back).not.toHaveBeenCalled();
      expect(c.paused()).toBe(false);
    });

    it('leaving the page any other way (the phone back button) pauses it too', async () => {
      const { c } = await open(pauseInfo());
      fixture.destroy();
      await vi.advanceTimersByTimeAsync(0);
      expect(api['pause']).toHaveBeenCalledTimes(1);
      expect(c).toBeTruthy();
    });

    it('does not pause a second time after the arrow already did, or once the test is submitted', async () => {
      const first = await open(pauseInfo());
      await first.c.leave();
      fixture.destroy();
      await vi.advanceTimersByTimeAsync(0);
      expect(api['pause']).toHaveBeenCalledTimes(1);
      TestBed.resetTestingModule();
      const second = await open(pauseInfo());
      second.c.finished.set({ result: null, autoSubmitted: false } as never);
      fixture.destroy();
      await vi.advanceTimersByTimeAsync(0);
      expect(api['pause']).not.toHaveBeenCalled();
    });
  });

  describe('when the test cannot be paused (a live test, or no pauses left)', () => {
    it('asks first, then saves and goes back without submitting', async () => {
      const { c, opened } = await open(pauseInfo({ allowed: false }));
      const flush = vi.spyOn(c, 'flush').mockResolvedValue(true);
      await c.leave();
      expect(opened).toHaveBeenCalledTimes(1);
      expect(((opened.mock.calls[0][1]) as { data: { message: string } }).data.message).toContain('timer keeps running');
      expect(flush).toHaveBeenCalled();
      expect(back).toHaveBeenCalled();
      expect(api['pause']).not.toHaveBeenCalled();
      expect(api['submit']).not.toHaveBeenCalled();
    });

    it('stays on the test when the student cancels', async () => {
      const { c } = await open(pauseInfo({ allowed: false }), false);
      const flush = vi.spyOn(c, 'flush');
      await c.leave();
      expect(flush).not.toHaveBeenCalled();
      expect(back).not.toHaveBeenCalled();
    });

    it('does not try to pause when the page is left by another route', async () => {
      await open(pauseInfo({ allowed: false }));
      fixture.destroy();
      await vi.advanceTimersByTimeAsync(0);
      expect(api['pause']).not.toHaveBeenCalled();
    });

    it('a test with every pause used counts as unpausable', async () => {
      const { c } = await open(pauseInfo({ pauses_left: 0 }));
      expect(c.canAutoPause()).toBe(false);
    });
  });
});

describe('AttemptPage paused screen', () => {
  it('offers the dashboard and My tests as well as Resume', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] });
    vi.setSystemTime(T0);
    const paused = state({ paused: true, sections: [], remaining_seconds: 45, pause: { allowed: true, paused: true, paused_at: new Date(T0).toISOString(), auto_resume_at: null, max_minutes: 0, pauses_used: 1, pauses_left: null } } as Partial<AttemptState>);
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StudentService, useValue: { attempt: vi.fn(() => of(paused)), pause: vi.fn(), resume: vi.fn() } }] });
    const fixture = TestBed.createComponent(AttemptPage);
    fixture.componentRef.setInput('id', 'att5');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const links = [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toContain('/student/dashboard');
    expect(links).toContain('/student/tests');
    expect(el.textContent).toContain('Resume test');
    fixture.destroy();
    vi.useRealTimers();
  });
});
