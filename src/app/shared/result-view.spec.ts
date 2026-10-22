import { TestBed } from '@angular/core/testing';
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
    expect(el.querySelector('mat-button-toggle-group')).toBeNull(); // no filtering by correctness either
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
