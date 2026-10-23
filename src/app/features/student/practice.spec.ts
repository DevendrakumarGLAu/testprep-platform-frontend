import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifyService } from '../../core/notify.service';
import { ActivityCards } from './activity-cards';
import { DailyQuizCard } from './daily-quiz-card';
import { Practice } from './practice';
import { ResultExtras } from './result-extras';
import { ActivitySummary, DailyQuizStatus, LeaderboardData, WeakTopicsData } from './student.models';
import { StudentService } from './student.service';

const topic = (id: number, name: string, answered: number, correct: number) => ({
  subject_id: 1, subject: 'Geo', topic_id: id, topic: name, answered, correct, accuracy: Math.round((correct * 100) / answered),
});
const WEAK: WeakTopicsData = {
  weak: [topic(2, 'Rivers', 5, 1)],
  all: [topic(2, 'Rivers', 5, 1), topic(3, 'Algebra', 5, 5)],
  rule: 'A topic counts as weak with at least 3 answers and under 60% correct.',
};

function setup(api: Record<string, unknown>) {
  const notify = { error: vi.fn(), success: vi.fn() };
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StudentService, useValue: api }, { provide: NotifyService, useValue: notify }] });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  return { notify, navigate };
}

const text = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent!.replace(/\s+/g, ' ');

describe('DailyQuizCard', () => {
  const quiz = (s: Partial<DailyQuizStatus>): DailyQuizStatus => ({ available: true, done: false, in_progress: false, size: 10, ...s });

  it('starts the quiz and opens the exam screen', async () => {
    const api = { dailyQuiz: vi.fn(() => of(quiz({}))), startDailyQuiz: vi.fn(() => of({ attempt_id: 'a1', exam_id: 'e1', questions: 10, created: true })) };
    const { navigate } = setup(api);
    const f = TestBed.createComponent(DailyQuizCard);
    f.detectChanges();
    expect(text(f)).toContain('Start quiz');
    f.nativeElement.querySelector('button').click();
    expect(navigate).toHaveBeenCalledWith(['/student/attempt', 'a1']);
  });

  it('offers to continue a running quiz, and says when it is done or not ready', () => {
    for (const [s, label] of [[{ in_progress: true }, 'Continue quiz'], [{ done: true }, 'Done for today'], [{ available: false }, 'Not ready yet']] as const) {
      TestBed.resetTestingModule();
      setup({ dailyQuiz: vi.fn(() => of(quiz(s))) });
      const f = TestBed.createComponent(DailyQuizCard);
      f.detectChanges();
      expect(text(f)).toContain(label);
    }
  });

  it('shows the server message when it cannot start', () => {
    const api = { dailyQuiz: vi.fn(() => of(quiz({}))), startDailyQuiz: vi.fn(() => throwError(() => ({ error: { detail: 'Not ready.' }, status: 404 }))) };
    const { notify } = setup(api);
    const f = TestBed.createComponent(DailyQuizCard);
    f.detectChanges();
    f.nativeElement.querySelector('button').click();
    expect(notify.error).toHaveBeenCalledWith('Not ready.');
  });
});

describe('ActivityCards', () => {
  const activity = (a: Partial<ActivitySummary>): ActivitySummary => ({
    streak: 3, best_streak: 7, today: 12, goal: 20, goal_reached: false,
    last_7_days: Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-${17 + i}`, questions: i })), ...a,
  });

  it('shows the streak, the goal progress and a week chart', () => {
    setup({ dailyQuiz: vi.fn(() => of({ available: true, done: false, in_progress: false, size: 10 })) });
    const f = TestBed.createComponent(ActivityCards);
    f.componentRef.setInput('activity', activity({}));
    f.detectChanges();
    const t = text(f);
    expect(t).toContain('3 days');
    expect(t).toContain('Best streak: 7');
    expect(t).toContain('12 / 20 questions');
    expect(t).toContain('8 to go today');
    expect(f.nativeElement.querySelectorAll('.week i').length).toBe(7);
    expect(f.componentInstance.goalPercent()).toBe(60);
  });

  it('encourages a first day and congratulates a reached goal', () => {
    setup({ dailyQuiz: vi.fn(() => of({ available: false, done: false, in_progress: false, size: 10 })) });
    const f = TestBed.createComponent(ActivityCards);
    f.componentRef.setInput('activity', activity({ streak: 0, today: 20, goal_reached: true }));
    f.detectChanges();
    expect(text(f)).toContain('Answer a question today to start a streak.');
    expect(text(f)).toContain('Goal reached');
    expect(f.componentInstance.goalPercent()).toBe(100);
  });
});

describe('Practice page', () => {
  it('lists topics with their accuracy and starts a set from the chosen ones', () => {
    const api = {
      weakTopics: vi.fn(() => of(WEAK)),
      dailyQuiz: vi.fn(() => of({ available: false, done: false, in_progress: false, size: 10 })),
      practiceWeak: vi.fn(() => of({ attempt_id: 'p1', exam_id: 'e', questions: 15, created: true })),
    };
    const { navigate } = setup(api);
    const f = TestBed.createComponent(Practice);
    f.detectChanges();
    const t = text(f);
    expect(t).toContain('Rivers');
    expect(t).toContain('20%');
    expect(t).toContain('Algebra');
    expect(t).toContain('weakest 3');
    f.componentInstance.toggle(WEAK.all[0], true);
    f.detectChanges();
    expect(text(f)).toContain('1 topic');
    f.componentInstance.start();
    expect(api.practiceWeak).toHaveBeenCalledWith([{ topic_id: 2, subject_id: 1 }], 15);
    expect(navigate).toHaveBeenCalledWith(['/student/attempt', 'p1']);
  });

  it('with no history it points to the tests', () => {
    setup({ weakTopics: vi.fn(() => of({ weak: [], all: [], rule: '' })), dailyQuiz: vi.fn(() => of({ available: false, done: false, in_progress: false, size: 10 })) });
    const f = TestBed.createComponent(Practice);
    f.detectChanges();
    expect(text(f)).toContain('Take a test first');
  });
});

describe('ResultExtras', () => {
  const board = (me: LeaderboardData['me']): LeaderboardData => ({
    exam: 'Mock', participants: 3, me,
    top: [
      { rank: 1, name: 'Tara S.', score: '9.00', total_marks: '10.00', percent: 90, time_taken_seconds: 300, is_me: false },
      { rank: 2, name: 'Dan', score: '7.00', total_marks: '10.00', percent: 70, time_taken_seconds: 400, is_me: true },
    ],
  });
  const me = { rank: 2, name: 'Dan', score: '7.00', total_marks: '10.00', percent: 70, time_taken_seconds: 400, is_me: true, better_than_percent: 33.3 };

  function render(api: Record<string, unknown>, wrong = 3) {
    const ctx = setup(api);
    const f = TestBed.createComponent(ResultExtras);
    f.componentRef.setInput('attemptId', 'att1');
    f.componentRef.setInput('examId', 'ex1');
    f.componentRef.setInput('wrong', wrong);
    f.detectChanges();
    return { f, ...ctx };
  }

  it('shows the rank and leaderboard and marks the student', async () => {
    const { f } = render({ leaderboard: vi.fn(() => of(board(me))) });
    await Promise.resolve();
    f.detectChanges();
    const t = text(f);
    expect(t).toContain('#2');
    expect(t).toContain('Better than 33.3% of students');
    expect(t).toContain('Tara S.');
    expect(t).toContain('Dan (you)');
    expect(f.nativeElement.querySelector('tr.me')).not.toBeNull();
  });

  it('starts a practice set from the mistakes', () => {
    const api = { leaderboard: vi.fn(() => throwError(() => ({ status: 403 }))), practiceMistakes: vi.fn(() => of({ attempt_id: 'r1', exam_id: 'e', questions: 3, created: true })) };
    const { f, navigate } = render(api);
    expect(text(f)).toContain('You missed 3 questions');
    f.componentInstance.redo();
    expect(api.practiceMistakes).toHaveBeenCalledWith('att1');
    expect(navigate).toHaveBeenCalledWith(['/student/attempt', 'r1']);
  });

  it('hides the redo button when nothing was missed and leaves out an unavailable board', async () => {
    const { f } = render({ leaderboard: vi.fn(() => throwError(() => ({ status: 403 }))) }, 0);
    await Promise.resolve();
    f.detectChanges();
    expect(text(f)).not.toContain('Redo my mistakes');
    expect(text(f)).not.toContain('Leaderboard');
  });
});
