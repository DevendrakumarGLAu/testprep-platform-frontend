import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CoachService } from '../coach.service';
import { PlanData, PlanTask } from '../coach.models';
import { StudyPlanCard } from './study-plan-card';

const task = (id: number, done = false): PlanTask => ({ id, date: '2026-11-03', kind: 'test', title: `Task ${id}`, minutes: 20, done, link: '/student/tests/x', overdue: false });

const plan = (today: PlanTask[], overdue = 0): PlanData => ({
  plan: { target_name: 'SSC CGL', exam_date: '2026-12-01', daily_minutes: 60, category: null, days_left: 28, total: 10, done: 2, percent: 20, overdue_count: overdue, finished: false },
  today, overdue: [], upcoming: [],
});

function render(result: unknown) {
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: CoachService, useValue: { plan: () => result } }] });
  const f = TestBed.createComponent(StudyPlanCard);
  f.detectChanges();
  return f.nativeElement.textContent as string;
}

describe('StudyPlanCard', () => {
  it('shows what is left to do today', () => {
    const text = render(of(plan([task(1), task(2), task(3), task(4), task(5, true)])));
    expect(text).toContain('28 days to SSC CGL');
    expect(text).toContain('Task 1');
    expect(text).toContain('Task 3');
    expect(text).not.toContain('Task 4'); // only the first three
    expect(text).not.toContain('Task 5');
  });

  it('congratulates when today is finished', () => {
    expect(render(of(plan([task(1, true), task(2, true)])))).toContain('All 2 tasks done today');
  });

  it('warns about missed tasks', () => {
    expect(render(of(plan([task(1)], 3)))).toContain('3 missed tasks');
  });

  it('invites the student to make a plan when there is none', () => {
    expect(render(of({ plan: null, today: [], overdue: [], upcoming: [] }))).toContain('Make a study plan');
  });

  it('shows nothing at all when the server does not know about plans', () => {
    expect(render(throwError(() => ({ status: 404 }))).trim()).toBe('');
  });
});
