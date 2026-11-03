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
    (f.nativeElement.querySelector('button.btn-primary') as HTMLButtonElement).click();
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
    expect(revise).toHaveBeenLastCalledWith('saved', 20, '');
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

describe('Revise by exam', () => {
  const exams = [
    { id: 'cgl', name: 'SSC CGL', group: 'SSC Exams', count: 3 }, { id: 'mts', name: 'SSC MTS', group: 'SSC Exams', count: 1 },
    { id: 'bank', name: 'Banking', group: null, count: 2 }, { id: 'none', name: 'Other tests', group: null, count: 1 },
  ];
  const withExams = (n = 2): ReviseData => ({ ...data(n), exams });

  it('offers the exams the student has cards for, under their family, with counts', () => {
    const { f, c, text } = render(withExams());
    expect(c.allCount()).toBe(7);
    expect(c.examGroups().map((g) => [g.name, g.exams.map((e) => e.name)])).toEqual([['SSC Exams', ['SSC CGL', 'SSC MTS']], ['Other', ['Banking', 'Other tests']]]);
    expect((f.nativeElement as HTMLElement).querySelector('.exam select')).not.toBeNull();
    expect(text()).toContain('Exam');
  });

  it('shows no filter when the server sent no exams (an older server) or there are none', () => {
    const { f } = render(data(1));
    expect((f.nativeElement as HTMLElement).querySelector('.exam select')).toBeNull();
  });

  it('choosing an exam loads only its cards', () => {
    const { c, revise } = render(withExams());
    c.pickExam('cgl');
    expect(c.exam()).toBe('cgl');
    expect(revise).toHaveBeenLastCalledWith('mistakes', 20, 'cgl');
  });

  it('switching between mistakes and saved goes back to all exams', () => {
    const { c, revise } = render(withExams());
    c.pickExam('cgl');
    c.choose('saved');
    expect(c.exam()).toBe('');
    expect(revise).toHaveBeenLastCalledWith('saved', 20, '');
  });

  it('says which exam has nothing when the chosen exam has no cards', () => {
    const { c, revise, f, text } = render(withExams());
    revise.mockReturnValue(of({ source: 'mistakes', total: 0, cards: [], exams }));
    c.pickExam('mts');
    f.detectChanges();
    expect(text()).toContain('No cards from this exam in your mistakes');
  });
});

describe('Revise (Bootstrap)', () => {
  it('is a Bootstrap page: toggle buttons, a card and no Material component', () => {
    const { f } = render(data(1));
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelectorAll('.btn-group button').length).toBe(2);
    expect(el.querySelector('.card .q')).not.toBeNull();
    expect(el.querySelector('mat-card, mat-button-toggle-group, mat-select, mat-icon, [mat-flat-button]')).toBeNull();
  });

  it('the toggle shows which list is chosen and switches it', () => {
    const { f, c } = render(data(1));
    const el = f.nativeElement as HTMLElement;
    const [mistakes, saved] = Array.from(el.querySelectorAll<HTMLButtonElement>('.btn-group button'));
    expect(mistakes.classList.contains('active')).toBe(true);
    saved.click();
    f.detectChanges();
    expect(c.source()).toBe('saved');
    expect(el.querySelectorAll<HTMLButtonElement>('.btn-group button')[1].classList.contains('active')).toBe(true);
  });
});
