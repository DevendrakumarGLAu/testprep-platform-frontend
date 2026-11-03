import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { formatDuration, formatSeconds } from '../features/student/student.models';
import { fromLocalInput, toLocalInput } from '../features/admin/exams/exam.models';
import { ResultView } from './result-view';
import { ResultData } from './result.models';

function data(solutions: boolean): ResultData {
  const base = {
    number: 1, section: 'S', subject: 'Geo', text: 'Capital of France?', image_url: null, marks: '2.00',
    options: [{ id: 1, text: 'Paris' }, { id: 2, text: 'Rome' }], selected_option: 2, time_spent_seconds: 95,
  };
  return {
    attempt: { id: 1, attempt_number: 2, submitted_at: '2026-01-01T10:00:00Z', auto_submitted: false },
    exam: { id: 1, title: 'Capitals' },
    summary: { score: '1.00', total_marks: '4.00', passing_marks: '2.00', passed: false, percentage: 25, correct: 1, incorrect: 1, unanswered: 0, accuracy: '50.00', time_taken_seconds: 125 },
    sections: [{ name: 'S', marks: '1.00', max_marks: '4.00', correct: 1, incorrect: 1, unanswered: 0, time_seconds: 125 }],
    timing: { total_seconds: 125, average_seconds: 63, slowest: { number: 1, seconds: 95 } },
    subjects: [{ subject: 'Geo', marks: '1.00', max_marks: '4.00', accuracy: 50 }],
    comparison: { attempts_count: 3, average_percentage: 40 },
    solutions_available: solutions,
    questions: [
      solutions
        ? {
            ...base, options: [{ id: 1, text: 'Paris', is_correct: true }, { id: 2, text: 'Rome', is_correct: false }],
            correct_option: 1, status: 'incorrect' as const, marks_awarded: '-1.00', explanation: 'Paris is the capital.',
          }
        : base,
    ],
  };
}

function render(d: ResultData) {
  const fixture = TestBed.createComponent(ResultView);
  fixture.componentRef.setInput('data', d);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ResultView', () => {
  it('shows score, pass/fail, section marks and the comparison', () => {
    const el = render(data(true));
    const text = el.textContent!;
    expect(text).toContain('Capitals');
    expect(text).toContain('1.00');
    expect(text).toContain('Not passed');
    expect(text).toContain('2m 05s');
    expect(text).toContain('Average across 3 attempts: 40%');
    expect(text).toContain('below average');
    expect(el.querySelectorAll('table.plain tbody tr').length).toBe(1);
  });

  it('reveals correct answers and explanations when solutions are released', () => {
    const text = render(data(true)).textContent!;
    expect(text).toContain('Correct answer');
    expect(text).toContain('Your answer');
    expect(text).toContain('Paris is the capital.');
    expect(text).toContain('incorrect');
  });

  it('hides correct answers, per-question marks and explanations until released', () => {
    const el = render(data(false));
    const text = el.textContent!;
    expect(text).toContain('will appear when solutions are released');
    expect(text).toContain('Your answer');
    expect(el.querySelector('.mark.good')).toBeNull(); // the "Correct answer" badge
    expect(el.querySelector('li.correct')).toBeNull();
    expect(el.querySelector('.expl')).toBeNull();
    expect(el.querySelector('.tag')).toBeNull();
    expect(el.querySelector('.filters')).toBeNull(); // no filtering by correctness either
  });
});

describe('ResultView time per question', () => {
  it('shows the time on each question, per section and in the time chart', () => {
    const el = render(data(true));
    const text = el.textContent!;
    expect(text).toContain('Time spent on each question');
    expect(text).toContain('2m 05s on questions');
    expect(text).toContain('average 1m 03s per question');
    expect(text).toContain('longest on Q1 (1m 35s)');
    expect(el.querySelectorAll('.timing .time-row').length).toBe(1);
    expect(el.querySelector('.q-head')!.textContent).toContain('1m 35s');
    expect(el.querySelector('table.plain tbody tr')!.textContent).toContain('2m 05s');
  });

  it('still shows the time per question when solutions are hidden', () => {
    const el = render(data(false));
    expect(el.querySelector('.q-head')!.textContent).toContain('1m 35s');
    expect(el.textContent).toContain('Time spent on each question');
  });

  it('leaves out the chart when no time was recorded', () => {
    const d = data(true);
    d.timing = { total_seconds: 0, average_seconds: 0, slowest: null };
    d.questions[0].time_spent_seconds = 0;
    expect(render(d).querySelector('.timing')).toBeNull();
  });

  it('formats seconds compactly', () => {
    expect(formatSeconds(0)).toBe('0s');
    expect(formatSeconds(45)).toBe('45s');
    expect(formatSeconds(60)).toBe('1m');
    expect(formatSeconds(125)).toBe('2m 05s');
  });
});

describe('formatting helpers', () => {
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0m 00s');
    expect(formatDuration(59)).toBe('0m 59s');
    expect(formatDuration(3725)).toBe('62m 05s');
  });

  it('round-trips local date-time input values', () => {
    const iso = '2026-03-04T05:06:00.000Z';
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    expect(toLocalInput(null)).toBe('');
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput(null)).toBeNull();
  });
});


describe('ResultView as a Bootstrap page', () => {
  it('is built with Bootstrap and has no Material component', () => {
    const el = render(data(true));
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelectorAll('.card').length).toBeGreaterThan(3);
    expect(el.querySelector('mat-card, mat-icon, mat-button-toggle-group, [mat-button]')).toBeNull();
  });

  it('shows the verdict, with a class for passed and not passed', () => {
    expect(render(data(true)).querySelector('.verdict.fail')!.textContent).toContain('Not passed');
  });

  it('filters the questions with a Bootstrap button group', () => {
    const fixture = TestBed.createComponent(ResultView);
    fixture.componentRef.setInput('data', data(true));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const filter = (label: string) => Array.from(el.querySelectorAll<HTMLButtonElement>('.filters button')).find((b) => b.textContent!.includes(label))!;
    expect(Array.from(el.querySelectorAll('.filters button')).map((b) => b.textContent!.trim())).toEqual(['All (1)', 'Correct (1)', 'Incorrect (1)', 'Unanswered (0)']);
    expect(el.querySelectorAll('.card.q').length).toBe(1);
    filter('Correct').click();
    fixture.detectChanges();
    expect(el.querySelectorAll('.card.q').length).toBe(0);
    expect(filter('Correct').classList.contains('active')).toBe(true);
    filter('Incorrect').click();
    fixture.detectChanges();
    expect(el.querySelectorAll('.card.q').length).toBe(1);
    expect(el.querySelector('.card.q')!.classList.contains('incorrect')).toBe(true);
  });

  it('offers a language dropdown only when the test has both languages', () => {
    const d = data(true);
    expect(render(d).querySelector('app-lang-switch select')).toBeNull();
    const both = { ...d, questions: [{ ...d.questions[0], text_hi: 'फ्रांस की राजधानी?' }] };
    TestBed.resetTestingModule();
    expect(render(both).querySelector('app-lang-switch select.form-select')).not.toBeNull();
  });
});

describe('ResultView question picture', () => {
  const withPicture = () => {
    const d = data(false);
    d.questions[0] = { ...d.questions[0], image_url: 'https://cdn.example/storage/questions/fig.png' };
    return d;
  };

  it('shows the picture the student saw, from the storage address', () => {
    const img = render(withPicture()).querySelector('img.zoomable') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://cdn.example/storage/questions/fig.png');
    expect(img.getAttribute('title')).toBe('Tap to enlarge');
  });

  it('opens it at full size when tapped or when Enter is pressed', () => {
    const fixture = TestBed.createComponent(ResultView);
    fixture.componentRef.setInput('data', withPicture());
    fixture.detectChanges();
    const zoom = vi.spyOn(fixture.componentInstance, 'zoom').mockImplementation(() => undefined);
    const img = (fixture.nativeElement as HTMLElement).querySelector('img.zoomable') as HTMLImageElement;
    img.click();
    img.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(zoom).toHaveBeenCalledTimes(2);
    expect(zoom).toHaveBeenCalledWith('https://cdn.example/storage/questions/fig.png');
  });

  it('a question without a picture has no image element', () => {
    expect(render(data(false)).querySelector('img')).toBeNull();
  });
});

describe('ResultView re-attempt', () => {
  function open(canAct = true, solutions = true) {
    const fixture = TestBed.createComponent(ResultView);
    fixture.componentRef.setInput('data', data(solutions));
    fixture.componentRef.setInput('canAct', canAct);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = () => el.textContent!.replace(/\s+/g, ' ');
    const button = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes(label));
    const opt = (i: number) => el.querySelectorAll<HTMLLIElement>('ol.retry li')[i];
    return { fixture, c: fixture.componentInstance, el, text, button, opt };
  }

  it('offers Re-attempt on a student review once solutions are out, and not otherwise', () => {
    expect(open().button('Re-attempt')).toBeTruthy();
    expect(open(false).button('Re-attempt')).toBeUndefined();
    expect(open(true, false).button('Re-attempt')).toBeUndefined();
  });

  it('is on when the server does not say, and off when the server setting turns it off', () => {
    const on = open();
    expect(on.button('Re-attempt')).toBeTruthy();
    const fixture = TestBed.createComponent(ResultView);
    fixture.componentRef.setInput('data', { ...data(true), reattempt_enabled: false });
    fixture.componentRef.setInput('canAct', true);
    fixture.detectChanges();
    const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].map((b) => b.textContent);
    expect(buttons.some((t) => t!.includes('Re-attempt'))).toBe(false);
    expect(buttons.some((t) => t!.includes('Save'))).toBe(true);
  });

  it('hides the answers and explanation while choosing again', () => {
    const { fixture, button, text, el } = open();
    button('Re-attempt')!.click();
    fixture.detectChanges();
    expect(text()).toContain('choose the answer again');
    expect(text()).not.toContain('Correct answer');
    expect(text()).not.toContain('Your answer');
    expect(text()).not.toContain('Paris is the capital.');
    expect(el.querySelectorAll('ol.retry li.correct').length).toBe(0);
  });

  it('a right pick says so and shows the explanation', () => {
    const { fixture, button, text, opt } = open();
    button('Re-attempt')!.click();
    fixture.detectChanges();
    opt(0).click();
    fixture.detectChanges();
    expect(text()).toContain('Correct! Well done.');
    expect(text()).toContain('Paris is the capital.');
    expect(opt(0).classList).toContain('correct');
  });

  it('a wrong pick marks it and highlights the right answer', () => {
    const { fixture, button, text, opt } = open();
    button('Re-attempt')!.click();
    fixture.detectChanges();
    opt(1).click();
    fixture.detectChanges();
    expect(text()).toContain('Not quite');
    expect(opt(1).classList).toContain('wrong');
    expect(opt(0).classList).toContain('correct');
  });

  it('the first pick stands until Try again, which starts over', () => {
    const { fixture, c, button, opt } = open();
    button('Re-attempt')!.click();
    fixture.detectChanges();
    opt(1).click();
    opt(0).click();
    expect(c.retry()[1].picked).toBe(2);
    fixture.detectChanges();
    button('Try again')!.click();
    expect(c.retry()[1].picked).toBeNull();
  });

  it('Back to my result returns to the normal review and does not change the score', () => {
    const { fixture, c, button, text } = open();
    button('Re-attempt')!.click();
    fixture.detectChanges();
    button('Back to my result')!.click();
    fixture.detectChanges();
    expect(c.retry()).toEqual({});
    expect(text()).toContain('Your answer');
    expect(text()).toContain('incorrect');
  });
});
