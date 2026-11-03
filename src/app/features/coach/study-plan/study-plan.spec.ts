import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NotifyService } from '../../../core/notify.service';
import { StudentService } from '../../student/student.service';
import { CoachService } from '../coach.service';
import { PlanData, PlanSubject, PlanTask } from '../coach.models';
import { StudyPlanPage } from './study-plan';

const task = (id: number, over: Partial<PlanTask> = {}): PlanTask => ({ id, date: '2026-11-03', kind: 'test', title: `Task ${id}`, minutes: 20, done: false, link: '/x', overdue: false, ...over });
const subject = (over: Partial<PlanSubject>): PlanSubject => ({ id: 1, name: 'Maths', accuracy: 80, answered: 20, weak: false, tasks: 6, done: 2, tests: 3, tests_done: 1, next_date: '2026-11-05', ...over });

const data = (over: Partial<PlanData> = {}): PlanData => ({
  plan: { target_name: 'SSC CGL', exam_date: '2026-12-01', daily_minutes: 60, category: 1, days_left: 28, total: 10, done: 2, percent: 20, overdue_count: 0, finished: false },
  subjects: [subject({}), subject({ id: 2, name: 'GK', accuracy: 40, weak: true, tests: 0, tests_done: 0 }), subject({ id: 3, name: 'English', accuracy: null, answered: 0 })],
  today: [task(1, { subject: 'Maths', subject_id: 1, title: 'Maths: Take: Drill' })],
  overdue: [], upcoming: [{ date: '2026-11-04', tasks: [task(2, { kind: 'practice', subject: 'GK', subject_id: 2, title: 'Practise GK' })] }],
  ...over,
});

function render(d: PlanData, extra: Record<string, unknown> = {}) {
  const coach = { plan: () => of(d), refreshPlan: vi.fn(() => of({ ...d, replanned: 5, removed: 5 })), ...extra };
  const notify = { success: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CoachService, useValue: coach },
      { provide: StudentService, useValue: { filters: () => of({ categories: [] }) } },
      { provide: NotifyService, useValue: notify },
    ],
  });
  const f = TestBed.createComponent(StudyPlanPage);
  f.detectChanges();
  return { f, el: f.nativeElement as HTMLElement, coach, notify };
}

describe('Study plan by subject', () => {
  it('lists every subject with how the student is doing and how much of its work is done', () => {
    const { el } = render(data());
    const rows = Array.from(el.querySelectorAll('.subjects .subject'));
    expect(rows.map((r) => r.querySelector('strong')!.textContent)).toEqual(['Maths', 'GK', 'English']);
    expect(rows[0].textContent).toContain('80% right');
    expect(rows[0].textContent).toContain('2 of 6 tasks done');
    expect(rows[0].textContent).toContain('1 of 3 subject tests');
    expect(rows[1].textContent).toContain('Needs work');
    expect(rows[1].querySelector('.progress-bar')!.classList.contains('tone-weak')).toBe(true);
    expect(rows[2].textContent).toContain('No answers yet');
  });

  it('marks each task with its subject, today and coming up', () => {
    const { el } = render(data());
    const tags = Array.from(el.querySelectorAll('.subject-tag')).map((t) => t.textContent!.trim());
    expect(tags).toEqual(expect.arrayContaining(['Maths', 'GK']));
  });

  it('plans the coming days again when asked, and says so', () => {
    const { f, el, coach, notify } = render(data());
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes('Update with my latest results'))!.click();
    f.detectChanges();
    expect(coach.refreshPlan).toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalledWith(expect.stringContaining('planned again'));
  });

  it('shows no subjects card for a plan without subjects (an exam with none)', () => {
    const { el } = render(data({ subjects: [] }));
    expect(el.querySelector('.subjects')).toBeNull();
    expect(el.textContent).toContain('Today');
  });
});
