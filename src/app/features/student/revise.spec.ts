import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LanguageService } from '../../shared/language-state';
import { Revise } from './revise';
import { ReviseCard, ReviseData } from './student.models';
import { StudentService } from './student.service';

const card = (n: number, over: Partial<ReviseCard> = {}): ReviseCard => ({
  key: `m${n}`, subject: 'Geo', exam_title: 'Mock', text: `Question ${n}`, text_hi: `प्रश्न ${n}`,
  options: [
    { id: 1, text: 'right', text_hi: 'सही', is_correct: true },
    { id: 2, text: 'wrong', text_hi: 'गलत', is_correct: false },
  ],
  your_option: 2, explanation: 'because', explanation_hi: 'क्योंकि', ...over,
});

function render(data: ReviseData | Error) {
  const revise = vi.fn(() => (data instanceof Error ? throwError(() => data) : of(data)));
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StudentService, useValue: { revise } }] });
  const f = TestBed.createComponent(Revise);
  f.detectChanges();
  return { f, c: f.componentInstance, revise, text: () => (f.nativeElement as HTMLElement).textContent ?? '' };
}

const data = (n: number, total = n): ReviseData => ({ source: 'mistakes', total, cards: Array.from({ length: n }, (_, i) => card(i + 1)) });

describe('Revise (flash cards)', () => {
  it('shows the question first and hides the answer until asked', () => {
    const { f, text } = render(data(2));
    expect(text()).toContain('Question 1');
    expect(text()).toContain('Card 1 of 2');
    expect(text()).not.toContain('Correct answer');
    expect(text()).not.toContain('because');
    (f.nativeElement.querySelector('button.mdc-button--unelevated, button[mat-flat-button]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(text()).toContain('Correct answer');
    expect(text()).toContain('Your answer');
    expect(text()).toContain('because');
  });

  it('Got it retires the card and moves on; finishing shows the round summary', () => {
    const { f, c, text } = render(data(2, 5));
    c.shown.set(true);
    c.gotIt();
    f.detectChanges();
    expect(text()).toContain('Question 2');
    expect(c.shown()).toBe(false);
    c.gotIt();
    f.detectChanges();
    expect(text()).toContain('Round complete');
    expect(text()).toContain('3 more waiting');
  });

  it('Again puts the card at the bottom of the pile', () => {
    const { c } = render(data(3));
    c.again();
    expect(c.pile().map((x) => x.key)).toEqual(['m2', 'm3', 'm1']);
    expect(c.done()).toBe(0);
  });

  it('says so when there is nothing to revise', () => {
    const { text } = render({ source: 'mistakes', total: 0, cards: [] });
    expect(text()).toContain('No mistakes to revise');
  });

  it('switching to saved questions loads them', () => {
    const { c, revise, f, text } = render({ source: 'mistakes', total: 0, cards: [] });
    revise.mockReturnValue(of({ source: 'saved', total: 0, cards: [] }));
    c.choose('saved');
    f.detectChanges();
    expect(revise).toHaveBeenLastCalledWith('saved');
    expect(text()).toContain('not saved any questions');
  });

  it('reads in Hindi when that is the chosen language', () => {
    const { f, text } = render(data(1));
    TestBed.inject(LanguageService).apply('hi');
    f.detectChanges();
    expect(text()).toContain('प्रश्न 1');
    TestBed.inject(LanguageService).apply('en');
  });

  it('shows nothing and an error when it cannot load', () => {
    const { c } = render(Object.assign(new Error('x'), { status: 500 }));
    expect(c.total()).toBe(0);
    expect(c.loading()).toBe(false);
  });
});
