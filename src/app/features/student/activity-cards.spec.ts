import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ActivityCards } from './activity-cards';
import { ActivitySummary } from './student.models';
import { StudentService } from './student.service';

const activity = (over: Partial<ActivitySummary> = {}): ActivitySummary => ({
  streak: 3, best_streak: 6, today: 5, goal: 20, goal_reached: false,
  last_7_days: [
    { date: '2026-03-01', questions: 0 }, { date: '2026-03-02', questions: 10 }, { date: '2026-03-03', questions: 20 },
    { date: '2026-03-04', questions: 0 }, { date: '2026-03-05', questions: 5 }, { date: '2026-03-06', questions: 0 }, { date: '2026-03-07', questions: 5 },
  ], ...over,
});

function render(a: ActivitySummary) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: StudentService, useValue: { dailyQuiz: () => of({ available: true, done: false, in_progress: false, size: 10 }) } }],
  });
  const f = TestBed.createComponent(ActivityCards);
  f.componentRef.setInput('activity', a);
  f.detectChanges();
  return f;
}

describe('ActivityCards', () => {
  it("shows the day's count against the goal, with a Bootstrap progress bar", () => {
    const el = render(activity()).nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.textContent).toContain('5');
    expect(el.textContent).toContain('/ 20 questions');
    expect(el.textContent).toContain('15 to go today');
    const bar = el.querySelector('.progress-bar') as HTMLElement;
    expect(bar.style.width).toBe('25%');
    expect(el.querySelector('.progress')!.getAttribute('aria-valuenow')).toBe('25');
    expect(el.querySelector('mat-card, mat-icon, mat-progress-bar, [mat-stroked-button]')).toBeNull();
  });

  it('congratulates when the goal is reached and never shows more than a full bar', () => {
    const el = render(activity({ today: 30, goal_reached: true })).nativeElement as HTMLElement;
    expect(el.textContent).toContain('Goal reached. Great work!');
    expect((el.querySelector('.progress-bar') as HTMLElement).style.width).toBe('100%');
  });

  it('draws one bar for each of the last seven days, scaled to the busiest day, with a small stub for an empty day', () => {
    const el = render(activity()).nativeElement as HTMLElement;
    const bars = Array.from(el.querySelectorAll('.week i')) as HTMLElement[];
    expect(bars.length).toBe(7);
    expect(bars[2].style.height).toBe('100%');
    expect(bars[1].style.height).toBe('50%');
    expect(bars[0].style.height).toBe('8%');
    expect(bars[0].classList.contains('none')).toBe(true);
    expect(bars[2].getAttribute('title')).toBe('2026-03-03: 20');
  });

  it("includes today's quiz and a link to practice", () => {
    const el = render(activity()).nativeElement as HTMLElement;
    expect(el.querySelector('app-daily-quiz-card')).not.toBeNull();
    expect(el.querySelector('a[href="/student/practice"].btn')).not.toBeNull();
  });
});
