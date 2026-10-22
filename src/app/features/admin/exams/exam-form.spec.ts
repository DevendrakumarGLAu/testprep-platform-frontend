import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { QuestionBankService } from '../question-bank/qb.service';
import { Exam } from './exam.models';
import { ExamForm } from './exam-form';
import { ExamService } from './exam.service';

const exam = (over: Partial<Exam> = {}): Exam => ({
  id: 7, public_id: 'abc', title: 'Mock', description: '', instructions: '', category: null, category_name: null,
  test_type: 'full_test', subject: null, subject_name: null, year: null, thumbnail_url: null, duration_minutes: 60,
  passing_marks: '0', marks_per_question: '2', negative_marking_enabled: true, negative_mode: 'question', negative_value: '0', unanswered_penalty: '0',
  shuffle_questions: false, shuffle_options: false, max_attempts: 1, start_at: null, end_at: null, access_type: 'public',
  assigned_student_ids: [], assigned_batch_ids: [], status: 'draft', published_at: null, version: 1, locked: false,
  result_release: 'immediate', result_release_at: null, results_released: false, solution_release: 'with_result',
  solutions_released: false, total_marks: '0.00', question_count: 0, created_at: '', updated_at: '', ...over,
} as unknown as Exam);

describe('ExamForm negative marking rule', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  async function open(e: Exam | null = null) {
    api = {
      categories: vi.fn(() => of({ results: [] })),
      batches: vi.fn(() => of({ results: [] })),
      get: vi.fn(() => of(e)),
      save: vi.fn((_body: unknown) => of(exam())),
      saveStructure: vi.fn((_id: number, _sections: unknown) => of(exam())),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'admin/tests/:id', children: [] }, { path: 'admin/tests', children: [] }]),
        { provide: ExamService, useValue: api },
        { provide: QuestionBankService, useValue: { subjects: () => of({ results: [] }) } },
      ],
    });
    const fixture = TestBed.createComponent(ExamForm);
    if (e) fixture.componentRef.setInput('id', String(e.id));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  const text = (el: HTMLElement) => el.querySelector('.neg-example')!.textContent!.replace(/\s+/g, ' ').trim();
  const choose = async (fixture: { detectChanges(): void; whenStable(): Promise<unknown> }, c: ExamForm, option: 'off' | 'question' | 'fraction' | 'fixed', value = 0) => {
    c.form.patchValue({ negative_option: option, negative_value: value });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('a new test starts with a 1/4 negative marking rule and 1 mark per question', async () => {
    const { c, el } = await open();
    expect(c.form.getRawValue().marks_per_question).toBe(1);
    expect(c.rule()).toEqual({ option: 'fraction', value: 0.25 });
    expect(text(el)).toContain('1/4 of the question');
  });

  it('a fraction rule shows presets and explains the effect on 2- and 4-mark questions', async () => {
    const { fixture, c, el } = await open();
    await choose(fixture, c, 'fraction', 0.25);
    expect(el.querySelectorAll('.presets button').length).toBe(4);
    expect(text(el)).toContain('1/4 of the question');
    expect(text(el)).toContain('2-mark question loses 0.5');
    expect(text(el)).toContain('4-mark question loses 1)');
  });

  it('clicking the 1/3 preset sets the value and highlights it', async () => {
    const { fixture, c, el } = await open();
    await choose(fixture, c, 'fraction', 0.25);
    const third = [...el.querySelectorAll<HTMLButtonElement>('.presets button')].find((b) => b.textContent!.trim() === '1/3')!;
    third.click();
    fixture.detectChanges();
    expect(c.form.value.negative_value).toBe(0.3333);
    expect(third.classList).toContain('on');
    expect(text(el)).toContain('1/3 of the question');
  });

  it('a custom fraction is described as a percentage', async () => {
    const { fixture, c, el } = await open();
    await choose(fixture, c, 'fraction', 0.45);
    expect(text(el)).toContain('45% of the question');
  });

  it('a fixed rule asks for marks per wrong answer', async () => {
    const { fixture, c, el } = await open();
    await choose(fixture, c, 'fixed', 0.45);
    expect(el.querySelector('.presets')).toBeNull();
    expect(text(el)).toContain('Every wrong answer loses 0.45 marks');
  });

  it('turning it off says wrong answers lose nothing', async () => {
    const { fixture, c, el } = await open();
    await choose(fixture, c, 'off');
    expect(text(el)).toContain('loses nothing');
  });

  it('saves the choice as enabled flag, mode and value', async () => {
    const { fixture, c } = await open();
    c.form.patchValue({ title: 'Mock' });
    for (const [option, value, expected] of [
      ['fraction', 0.3333, { negative_marking_enabled: true, negative_mode: 'fraction', negative_value: '0.3333' }],
      ['fixed', 0.45, { negative_marking_enabled: true, negative_mode: 'fixed', negative_value: '0.45' }],
      ['question', 0.9, { negative_marking_enabled: true, negative_mode: 'question', negative_value: '0' }],
      ['off', 0.5, { negative_marking_enabled: false, negative_mode: 'question', negative_value: '0' }],
    ] as const) {
      await choose(fixture, c, option, value);
      c.saveDetails();
      expect(api['save'].mock.calls.at(-1)![0]).toMatchObject(expected);
    }
  });

  it('loads a saved rule back into the form', async () => {
    const { c } = await open(exam({ negative_mode: 'fraction', negative_value: '0.2500' }));
    expect(c.form.value.negative_option).toBe('fraction');
    expect(c.form.value.negative_value).toBe(0.25);
  });

  it('loads "no negative marking" back as off', async () => {
    const { c } = await open(exam({ negative_marking_enabled: false }));
    expect(c.form.getRawValue().negative_option).toBe('off');
  });

  it('every question follows the test: marks per question and the negative rule', async () => {
    const { fixture, c } = await open(exam({
      negative_mode: 'fraction', negative_value: '0.25', marks_per_question: '2',
      sections: [{ name: 'S', questions: [{ question: 1, text: 'Q1', marks: '9', negative_marks: '9' }] }],
    } as unknown as Partial<Exam>));
    fixture.detectChanges();
    await fixture.whenStable();
    const item = () => c.sections()[0].questions[0];
    expect([item().marks, item().negative_marks]).toEqual(['2', '0.5']); // SSC: 2 marks, 1/4 off
    c.form.patchValue({ marks_per_question: 1 });
    await choose(fixture, c, 'fraction', 0.3333);
    expect([item().marks, item().negative_marks]).toEqual(['1', '0.3333']); // RRB: 1 mark, 1/3 off
    await choose(fixture, c, 'fixed', 0.45);
    expect(item().negative_marks).toBe('0.45');
    expect(c.totalMarks()).toBe('1.00');
  });

  it('sends the marks per question with the test', async () => {
    const { c } = await open(exam());
    expect(c.form.getRawValue().marks_per_question).toBe(2);
  });

  it('shows deductions without trailing zeros', async () => {
    const { c } = await open();
    expect(c.shown('0.5000')).toBe('0.5');
    expect(c.shown('0.6667')).toBe('0.6667');
    expect(c.shown('1.0000')).toBe('1');
  });

  it('the timed-sections switch explains the rules and makes the total duration read-only', async () => {
    const { fixture, c, el } = await open();
    expect(el.textContent).not.toContain('Sections open one after another');
    c.form.patchValue({ sectional_timing: true });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('Sections open one after another');
    expect(c.sectional()).toBe(true);
    expect(c.form.controls.duration_minutes.disabled).toBe(true);
    c.form.patchValue({ sectional_timing: false });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(c.form.controls.duration_minutes.enabled).toBe(true);
  });

  it('section time limits add up, stay within 1 to 600 and are sent with the questions', async () => {
    const { c } = await open(exam({
      sectional_timing: true,
      sections: [
        { name: 'Maths', duration_minutes: 20, questions: [{ question: 1, text: 'Q1', marks: '2', negative_marks: '0' }] },
        { name: 'GK', duration_minutes: 10, questions: [{ question: 2, text: 'Q2', marks: '2', negative_marks: '0' }] },
      ],
    } as unknown as Partial<Exam>));
    expect(c.sectional()).toBe(true);
    expect(c.sectionTotal()).toBe(30);
    c.setSectionMinutes(0, '25');
    expect(c.sectionTotal()).toBe(35);
    c.setSectionMinutes(1, '0');
    expect(c.sections()[1].duration_minutes).toBeNull(); // empty or invalid means "not set"
    c.setSectionMinutes(1, '999');
    expect(c.sections()[1].duration_minutes).toBe(600);
    c.setSectionMinutes(1, '15');
    c.saveStructure();
    const sent = api['saveStructure'].mock.calls.at(-1)![1] as { name: string; duration_minutes: number | null }[];
    expect(sent.map((x) => [x.name, x.duration_minutes])).toEqual([['Maths', 25], ['GK', 15]]);
  });

  it('loads the saved setting back into the form', async () => {
    const { c } = await open(exam({ sectional_timing: true, duration_minutes: 30 }));
    expect(c.form.getRawValue().sectional_timing).toBe(true);
    expect(c.form.controls.duration_minutes.disabled).toBe(true);
  });
});
