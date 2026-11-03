import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { NotifyService } from '../../core/notify.service';
import { DailyQuizCard } from './daily-quiz-card';
import { DailyQuizStatus } from './student.models';
import { StudentService } from './student.service';

function render(status: unknown, start: unknown = of({ attempt_id: 'a1' })) {
  const api = { dailyQuiz: vi.fn(() => status), startDailyQuiz: vi.fn(() => start) };
  const notify = { error: vi.fn() };
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StudentService, useValue: api }, { provide: NotifyService, useValue: notify }] });
  const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const f = TestBed.createComponent(DailyQuizCard);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  return { f, el, api, notify, nav, button: () => el.querySelector('button') as HTMLButtonElement };
}

const state = (over: Partial<DailyQuizStatus>): DailyQuizStatus => ({ available: true, done: false, in_progress: false, size: 10, ...over });

describe('DailyQuizCard', () => {
  it('is a Bootstrap card without Material components', () => {
    const { el } = render(of(state({})));
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('.card .card-body')).not.toBeNull();
    expect(el.querySelector('mat-card, mat-icon, [mat-flat-button], [mat-stroked-button]')).toBeNull();
  });

  it('offers to start a quiz of the day', () => {
    const { el, button } = render(of(state({ size: 10 })));
    expect(el.textContent).toContain('10 recent questions, the same for the whole day.');
    expect(button().textContent).toContain('Start quiz');
    expect(button().classList.contains('btn-primary')).toBe(true);
  });

  it('offers to continue one that was begun', () => {
    expect(render(of(state({ in_progress: true }))).button().textContent).toContain('Continue quiz');
  });

  it('says it is done for today, with a disabled button', () => {
    const { el, button } = render(of(state({ done: true })));
    expect(el.textContent).toContain("You finished today's quiz");
    expect(button().disabled).toBe(true);
    expect(button().textContent).toContain('Done for today');
  });

  it('says it is not ready when there are too few recent questions, and also when the server cannot be asked', () => {
    const none = render(of(state({ available: false })));
    expect(none.el.textContent).toContain('will be ready once enough recent questions');
    expect(none.button().disabled).toBe(true);
    TestBed.resetTestingModule();
    const failed = render(throwError(() => ({ status: 500 })));
    expect(failed.button().textContent).toContain('Not ready yet');
  });

  it('starts the quiz and opens the exam screen', () => {
    const { button, api, nav } = render(of(state({})));
    button().click();
    expect(api.startDailyQuiz).toHaveBeenCalled();
    expect(nav).toHaveBeenCalledWith(['/student/attempt', 'a1']);
  });

  it('tells the student why a quiz could not start and lets them try again', () => {
    const { f, button, notify } = render(of(state({})), throwError(() => ({ error: { detail: 'Not enough questions.' } })));
    button().click();
    f.detectChanges();
    expect(notify.error).toHaveBeenCalledWith('Not enough questions.');
    expect(button().disabled).toBe(false);
  });
});
