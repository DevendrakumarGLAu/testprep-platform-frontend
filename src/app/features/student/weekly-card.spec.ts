import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { WeeklySummary } from './student.models';
import { StudentService } from './student.service';
import { WeeklyCard } from './weekly-card';

const week = (over: Partial<WeeklySummary> = {}): WeeklySummary => ({
  from: '2026-01-01', to: '2026-01-07', questions: 40, questions_before: 25, tests: 2, tests_before: 1, active_days: 4,
  accuracy: 72.5, accuracy_before: 70, accuracy_change: 2.5, best_subject: { name: 'History', accuracy: 90 }, weakest_subject: { name: 'Maths', accuracy: 40 }, ...over,
});

function render(result: unknown) {
  TestBed.configureTestingModule({ providers: [{ provide: StudentService, useValue: { weeklySummary: () => result } }] });
  const f = TestBed.createComponent(WeeklyCard);
  f.detectChanges();
  return f;
}

describe('WeeklyCard', () => {
  it('shows the week with the change from the week before', () => {
    const text = render(of(week())).nativeElement.textContent as string;
    expect(text).toContain('40');
    expect(text).toContain('15 more than last week');
    expect(text).toContain('72.5%');
    expect(text).toContain('+2.5 points');
    expect(text).toContain('History');
    expect(text).toContain('Maths');
  });

  it('says so when nothing was done', () => {
    const text = render(of(week({ questions: 0, tests: 0, accuracy: null, accuracy_change: null, best_subject: null, weakest_subject: null }))).nativeElement.textContent as string;
    expect(text).toContain('Nothing yet in the last 7 days');
  });

  it('shows nothing when it cannot be loaded', () => {
    expect(render(throwError(() => new Error('x'))).nativeElement.textContent.trim()).toBe('');
  });

  it('words the change in either direction', () => {
    const c = render(of(week())).componentInstance;
    expect(c.trend(5, 0)).toBe('');
    expect(c.trend(5, 5)).toBe('(same as last week)');
    expect(c.trend(3, 5)).toBe('(2 fewer than last week)');
  });
});
