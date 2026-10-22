import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NotifyService } from '../../../core/notify.service';
import { PickedQuestion, Question } from '../question-bank/qb.models';
import { QuestionBankService } from '../question-bank/qb.service';
import { QuestionPicker } from './question-picker';

const q = (id: number): Question =>
  ({ id, text: `Question ${id}`, subject_name: 'Maths', topic_name: null, difficulty: 'easy', marks: '2.00', negative_marks: '0.50', version: 1 }) as unknown as Question;

const rows = Array.from({ length: 10 }, (_, i) => q(i + 1));

describe('QuestionPicker bulk selection', () => {
  let api: { subjects: ReturnType<typeof vi.fn>; questions: ReturnType<typeof vi.fn>; pick: ReturnType<typeof vi.fn> };
  let notify: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };

  async function open(excludeIds: number[] = []) {
    api = {
      subjects: vi.fn(() => of({ results: [] })),
      questions: vi.fn(() => of({ count: 45, results: rows })),
      pick: vi.fn(() => of({ available: 45, questions: [] as PickedQuestion[] })),
    };
    notify = { error: vi.fn(), success: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: QuestionBankService, useValue: api },
        { provide: NotifyService, useValue: notify },
        { provide: MAT_DIALOG_DATA, useValue: { excludeIds } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(QuestionPicker);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  const picked = (from: number, n: number): PickedQuestion[] => Array.from({ length: n }, (_, i) => q(from + i));

  it('selects and clears every question on the page', async () => {
    const { c } = await open();
    c.togglePage(true);
    expect(c.selected().size).toBe(10);
    expect(c.pageAllSelected()).toBe(true);
    c.togglePage(false);
    expect(c.selected().size).toBe(0);
    c.toggle(rows[0], true);
    expect(c.pageSomeSelected()).toBe(true);
  });

  it('"select all matching" fetches every match with the current filters and skips questions already used', async () => {
    const { c } = await open([900, 901]);
    api.pick.mockReturnValue(of({ available: 45, questions: picked(100, 45) }));
    c.selectAllMatching();
    const body = api.pick.mock.calls[0][0];
    expect(body).toMatchObject({ count: 45, mode: 'newest' });
    expect(body.exclude_ids).toEqual([900, 901]);
    expect(c.selected().size).toBe(45);
  });

  it('adds a random number of matching questions and does not pick ones already selected', async () => {
    const { c } = await open();
    c.toggle(rows[0], true);
    api.pick.mockReturnValue(of({ available: 44, questions: picked(200, 25) }));
    c.randomCount.setValue(25);
    c.addRandom();
    expect(api.pick.mock.calls[0][0]).toMatchObject({ count: 25, mode: 'random', exclude_ids: [1] });
    expect(c.selected().size).toBe(26);
  });

  it('passes the subject, difficulty and search filters to the server', async () => {
    const { c } = await open();
    c.subject.set(3);
    c.difficulty.set('hard');
    c.addRandom();
    expect(api.pick.mock.calls[0][0]).toMatchObject({ subject: 3, difficulty: 'hard', mode: 'random' });
  });

  it('never goes past the 300 question limit, counting what the test already has', async () => {
    const { c } = await open(Array.from({ length: 290 }, (_, i) => 1000 + i));
    expect(c.remaining()).toBe(10);
    api.pick.mockReturnValue(of({ available: 100, questions: picked(2000, 10) }));
    c.randomCount.setValue(50);
    c.addRandom();
    expect(api.pick.mock.calls[0][0].count).toBe(10); // asks only for what fits
    expect(c.selected().size).toBe(10);
    expect(c.remaining()).toBe(0);
    c.addRandom();
    expect(api.pick).toHaveBeenCalledTimes(1);
    expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('maximum of 300'));
  });

  it('truncates and explains when a server answer would overshoot the limit', async () => {
    const { c } = await open(Array.from({ length: 295 }, (_, i) => 1000 + i));
    c.togglePage(true); // 10 on this page, room for 5
    expect(c.selected().size).toBe(5);
    expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('only 5 were added'));
  });

  it('reports when nothing more matches and ignores an empty or zero random count', async () => {
    const { c } = await open();
    c.addRandom();
    expect(notify.error).toHaveBeenCalledWith('No more questions match these filters.');
    c.randomCount.setValue(0);
    c.addRandom();
    expect(notify.error).toHaveBeenCalledWith('Enter how many questions to add.');
    expect(api.pick).toHaveBeenCalledTimes(1);
  });

  it('shows the running count in the dialog', async () => {
    const { fixture, c, el } = await open([901, 902, 903]);
    c.togglePage(true);
    fixture.detectChanges();
    expect(el.querySelector('.count')!.textContent).toContain('10 selected');
    expect(el.querySelector('.count')!.textContent).toContain('287 more allowed');
  });
});
