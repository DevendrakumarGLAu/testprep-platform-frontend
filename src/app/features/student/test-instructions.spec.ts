import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NotifyService } from '../../core/notify.service';
import { LanguageService } from '../../shared/language';
import { StudentExam } from './student.models';
import { StudentService } from './student.service';
import { TestInstructions } from './test-instructions';

function exam(languages: ('en' | 'hi')[]): StudentExam {
  return {
    id: 'ex1', title: 'Mock', description: '', category: null, category_name: null, test_type: 'full_test', test_type_label: 'Full test',
    subject: null, subject_name: null, year: null, thumbnail_url: null, question_count: 2, total_marks: '2.00', duration_minutes: 10,
    start_at: null, end_at: null, max_attempts: 0, attempts_used: 0, negative_marking_enabled: false, sectional_timing: false,
    status: 'available', can_start: true, reason: '', active_attempt_id: null, instructions: '', languages,
  } as unknown as StudentExam;
}

describe('TestInstructions language choice', () => {
  let api: { exam: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn> };

  async function open(languages: ('en' | 'hi')[]) {
    localStorage.clear();
    api = { exam: vi.fn(() => of(exam(languages))), start: vi.fn(() => of({ attempt_id: 'a1', created: true })) };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: StudentService, useValue: api }, { provide: NotifyService, useValue: { error: vi.fn() } }],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(TestInstructions);
    fixture.componentRef.setInput('id', 'ex1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLInputElement>('.agree input')!.click();
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el };
  }

  const startButton = (el: HTMLElement) => [...el.querySelectorAll('button')].find((b) => b.textContent!.includes('Start test'))!;

  it('has no language selected by default and refuses to start until one is chosen', async () => {
    const { fixture, c, el } = await open(['en', 'hi']);
    expect(el.querySelector('select.form-select')).not.toBeNull();
    expect(c.chosen()).toBeNull();
    startButton(el).click();
    fixture.detectChanges();
    expect(api.start).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('Select a language');
  });

  it('starts with the chosen language and remembers it', async () => {
    const { fixture, c, el } = await open(['en', 'hi']);
    c.choose('hi');
    fixture.detectChanges();
    startButton(el).click();
    expect(api.start).toHaveBeenCalledWith('ex1');
    expect(TestBed.inject(LanguageService).lang()).toBe('hi');
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('asks nothing when the test has only one language', async () => {
    const { el } = await open(['hi']);
    expect(el.querySelector('select.form-select')).toBeNull();
    startButton(el).click();
    expect(api.start).toHaveBeenCalled();
    expect(TestBed.inject(LanguageService).lang()).toBe('hi');
  });
});

describe('TestInstructions pause rule', () => {
  async function text(over: Record<string, unknown>) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: StudentService, useValue: { exam: vi.fn(() => of({ ...exam(['en']), allow_pause: true, ...over })), start: vi.fn() } },
        { provide: NotifyService, useValue: { error: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(TestInstructions);
    fixture.componentRef.setInput('id', 'ex1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('.pause-rule')?.textContent?.replace(/\s+/g, ' ') ?? '';
  }

  it('with no limit says the student can resume whenever they like', async () => {
    const t = await text({ max_pauses: 0, pause_minutes: 0 });
    expect(t).toContain('whenever you like');
    expect(t).not.toContain('at most');
    expect(t).not.toContain('restarts by itself');
  });

  it('with a limit still explains it', async () => {
    const t = await text({ max_pauses: 3, pause_minutes: 10 });
    expect(t).toContain('up to 3 times');
    expect(t).toContain('at most 10 minutes');
    expect(t).toContain('restarts by itself');
  });
});

describe('TestInstructions as a Bootstrap page', () => {
  async function render(over: Record<string, unknown> = {}, languages: ('en' | 'hi')[] = ['en', 'hi']) {
    localStorage.clear();
    const api = { exam: vi.fn(() => of({ ...exam(languages), ...over })), start: vi.fn(() => of({ attempt_id: 'a1', created: true })) };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: StudentService, useValue: api }, { provide: NotifyService, useValue: { error: vi.fn() } }],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const f = TestBed.createComponent(TestInstructions);
    f.componentRef.setInput('id', 'ex1');
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    return { f, api, el: f.nativeElement as HTMLElement };
  }

  it('is built with Bootstrap and has no Material component', async () => {
    const { el } = await render();
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('.card.block .card-body')).not.toBeNull();
    expect(el.querySelector('mat-card, mat-icon, mat-checkbox, mat-select, [mat-flat-button], [mat-button], mat-progress-bar')).toBeNull();
  });

  it('lists the facts of the test', async () => {
    const { el } = await render({ duration_minutes: 90, question_count: 100, total_marks: '200.00', negative_marking_enabled: true, attempts_used: 1, max_attempts: 3 });
    const facts = Array.from(el.querySelectorAll('.fact')).map((f) => f.textContent!.replace(/\s+/g, ' ').trim());
    expect(facts).toContain('Duration90 minutes');
    expect(facts).toContain('Questions100');
    expect(facts).toContain('Total marks200.00');
    expect(facts).toContain('Negative markingYes, per question');
    expect(facts).toContain('Attempts1 used of 3');
    expect(facts).toContain('Available Anytime');
  });

  it('keeps Start disabled until the student has agreed, then starts', async () => {
    const { f, api, el } = await render({}, ['en']);
    const start = () => Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes('Start test')) as HTMLButtonElement;
    expect(start().disabled).toBe(true);
    (el.querySelector('.agree input') as HTMLInputElement).click();
    f.detectChanges();
    expect(start().disabled).toBe(false);
    start().click();
    expect(api.start).toHaveBeenCalledWith('ex1');
  });

  it('offers the languages of the test in a select, and remembers the one that is picked', async () => {
    const { f, el } = await render();
    const select = el.querySelector('select.form-select') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent!.trim())).toEqual(['Select a language', 'English', 'हिन्दी']);
    select.value = 'hi';
    select.dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(f.componentInstance.chosen()).toBe('hi');
    expect(select.classList.contains('is-invalid')).toBe(false);
  });

  it('shows Resume for an attempt in progress, and the reason when the test cannot be started', async () => {
    const running = await render({ status: 'in_progress', can_start: true }, ['en']);
    expect(running.el.textContent).toContain('Resume attempt');
    expect(running.el.querySelector('.agree')).toBeNull();
    TestBed.resetTestingModule();
    const closed = await render({ can_start: false, reason: 'The test has ended.' }, ['en']);
    expect(closed.el.textContent).toContain('The test has ended.');
    expect(closed.el.textContent).toContain('Back to tests');
  });

  it('shows the sections, the instructions and a warning about timed sections', async () => {
    const { el } = await render({ instructions: 'No phones.', sectional_timing: true, sections: [{ name: 'Maths', question_count: 25, duration_minutes: 20 }] });
    expect(el.textContent).toContain('Maths: 25 questions · 20 minutes');
    expect(el.textContent).toContain('No phones.');
    expect(el.textContent).toContain('This test has timed sections');
  });

  it('links to the result when the student has one', async () => {
    const { el } = await render({ last_attempt_id: 'att9', result_available: true });
    expect((el.querySelector('a.view-result') as HTMLAnchorElement).getAttribute('href')).toBe('/student/results/att9');
  });
});
