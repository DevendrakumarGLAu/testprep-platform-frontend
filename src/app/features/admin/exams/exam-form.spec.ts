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
  shuffle_questions: false, shuffle_options: false, also_in: [], is_live: false, late_join_minutes: 10, allow_pause: true, max_pauses: 3, pause_minutes: 10, max_attempts: 1, start_at: null, end_at: null, access_type: 'public',
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

describe('ExamForm exam pattern and shared exams', () => {
  const cgl = {
    id: 3, name: 'SSC CGL', description: '', subjects: [], subject_names: [], group: 1, group_name: 'SSC', is_active: true, exam_count: 0,
    pattern: {
      duration_minutes: 60, marks_per_question: 2, passing_marks: 0, negative_option: 'fixed', negative_value: 0.5, max_attempts: 0,
      sectional_timing: false,
      sections: [{ name: 'General Intelligence', duration_minutes: null }, { name: 'English', duration_minutes: null }],
    },
  };
  const mts = { id: 4, name: 'SSC MTS', description: '', subjects: [], subject_names: [], group: 1, group_name: 'SSC', is_active: true, exam_count: 0, pattern: {} };
  const chsl = { id: 5, name: 'SSC CHSL', description: '', subjects: [], subject_names: [], group: 1, group_name: 'SSC', is_active: true, exam_count: 0, pattern: {} };

  async function open(e: Exam | null = null) {
    const api = {
      categories: vi.fn(() => of({ results: [cgl, mts, chsl] })),
      batches: vi.fn(() => of({ results: [] })),
      get: vi.fn(() => of(e)),
      save: vi.fn((_body: unknown) => of(exam())),
      saveStructure: vi.fn(() => of(exam())),
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
    return { fixture, api, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }
  const settle = async (fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('a new test takes the usual settings of the exam that is picked', async () => {
    const { fixture, c, el } = await open();
    c.form.patchValue({ title: 'Mine', category: 3 });
    await settle(fixture);
    const v = c.form.getRawValue();
    expect([v.duration_minutes, v.marks_per_question, v.max_attempts, v.negative_option, v.negative_value]).toEqual([60, 2, 0, 'fixed', 0.5]);
    expect(v.title).toBe('Mine'); // only settings are filled in
    expect(c.sections().map((s) => s.name)).toEqual(['General Intelligence', 'English']);
    expect(el.querySelector('.pattern-bar')?.textContent).toContain('SSC CGL has a saved pattern');
    expect(el.querySelector('.pattern-bar')?.textContent).toContain('60 min');
  });

  it('an exam without a saved pattern changes nothing and shows no pattern bar', async () => {
    const { fixture, c, el } = await open();
    c.form.patchValue({ category: 4 });
    await settle(fixture);
    expect(c.form.getRawValue().duration_minutes).toBe(60);
    expect(c.form.getRawValue().marks_per_question).toBe(1);
    expect(el.querySelector('.pattern-bar')).toBeNull();
  });

  it('an existing test is only changed when the button is pressed', async () => {
    const { fixture, c, el } = await open(exam({ category: 3, duration_minutes: 30, marks_per_question: '1' }));
    expect(c.form.getRawValue().duration_minutes).toBe(30);
    (el.querySelector('.pattern-bar button') as HTMLButtonElement).click();
    await settle(fixture);
    expect(c.form.getRawValue().duration_minutes).toBe(60);
    expect(c.form.getRawValue().marks_per_question).toBe(2);
  });

  it('never replaces sections that already hold questions', async () => {
    const { fixture, c } = await open();
    c.sections.set([{ name: 'Mine', questions: [{ question: 1, text: 'Q', marks: '1', negative_marks: '0' }] }]);
    c.form.patchValue({ category: 3 });
    await settle(fixture);
    expect(c.sections().map((s) => s.name)).toEqual(['Mine']);
    expect(c.form.getRawValue().duration_minutes).toBe(60); // the settings still apply
  });

  it('does not touch a published test', async () => {
    const { fixture, c, el } = await open(exam({ category: 3, duration_minutes: 30, status: 'published', locked: true }));
    expect((el.querySelector('.pattern-bar button') as HTMLButtonElement).disabled).toBe(true);
    c.applyPattern();
    await settle(fixture);
    expect(c.form.getRawValue().duration_minutes).toBe(30);
  });

  it('offers every other exam under "Also show in" and sends the choice when saving', async () => {
    const { fixture, api, c } = await open(exam({ id: 9, category: 3 }));
    expect(c.otherCategories().map((x) => x.name)).toEqual(['SSC MTS', 'SSC CHSL']);
    c.form.patchValue({ also_in: [4, 5] });
    c.saveDetails();
    await settle(fixture);
    const body = api['save'].mock.calls[0][0] as Record<string, unknown>;
    expect(body['also_in']).toEqual([4, 5]);
  });

  it('loads the exams a test is already shared with', async () => {
    const { c } = await open(exam({ id: 9, category: 3, also_in: [5] }));
    expect(c.form.getRawValue().also_in).toEqual([5]);
  });
});

describe('ExamForm live test', () => {
  async function open(e: Exam | null = null) {
    const api = {
      categories: vi.fn(() => of({ results: [] })),
      batches: vi.fn(() => of({ results: [] })),
      get: vi.fn(() => of(e)),
      save: vi.fn((_body: unknown) => of(exam())),
      saveStructure: vi.fn(() => of(exam())),
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
    return { fixture, api, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }
  const settle = async (fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const text = (el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ');

  it('switching it on shows the live settings, a start-time label, and hides the end time and the pause option', async () => {
    const { fixture, c, el } = await open();
    expect(el.querySelector('.live-box .late')).toBeNull();
    expect(text(el)).toContain('Available until');
    c.form.patchValue({ is_live: true });
    await settle(fixture);
    expect(el.querySelector('.live-box .late')).not.toBeNull();
    expect(text(el)).toContain('Live test starts at');
    expect(text(el)).not.toContain('Available until');
    expect(text(el)).not.toContain('Let students pause the test');
    expect(text(el)).toContain('everyone finishes at the same moment');
  });

  it('switching it on turns pausing off', async () => {
    const { fixture, c } = await open();
    expect(c.form.getRawValue().allow_pause).toBe(true);
    c.form.patchValue({ is_live: true });
    await settle(fixture);
    expect(c.form.getRawValue().allow_pause).toBe(false);
  });

  it('a new live test says the link comes after saving', async () => {
    const { fixture, c, el } = await open();
    c.form.patchValue({ is_live: true });
    await settle(fixture);
    expect(text(el)).toContain('Save the test to get the link to share');
    expect(el.querySelector('.live-link')).toBeNull();
  });

  it('a saved live test shows its link inside the student area, and says who can open it', async () => {
    const { el, c } = await open(exam({ id: 9, public_id: 'abc123', is_live: true, status: 'draft' }));
    expect(c.liveLink()).toBe(`${window.location.origin}/student/live/abc123`);
    expect((el.querySelector('.live-link input') as HTMLInputElement).value).toBe(`${window.location.origin}/student/live/abc123`);
    expect(text(el)).toContain('Only registered students can open it');
  });

  it('copies the link', async () => {
    const write = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
    const { fixture, el } = await open(exam({ id: 9, public_id: 'abc123', is_live: true }));
    (el.querySelector('.live-link button') as HTMLButtonElement).click();
    await settle(fixture);
    expect(write).toHaveBeenCalledWith(`${window.location.origin}/student/live/abc123`);
  });

  it('refuses to save a live test without a start time, and does not call the server', async () => {
    const { fixture, api, c, el } = await open();
    c.form.patchValue({ title: 'Live one', is_live: true, start_at: '' });
    c.saveDetails();
    await settle(fixture);
    expect(api.save).not.toHaveBeenCalled();
    expect(text(el)).toContain('A live test needs a start time.');
  });

  it('saves the live settings with the start time', async () => {
    const { fixture, api, c } = await open();
    c.form.patchValue({ title: 'Live one', is_live: true, late_join_minutes: 15, start_at: '2026-12-01T10:00' });
    c.saveDetails();
    await settle(fixture);
    const body = api.save.mock.calls[0][0] as Record<string, unknown>;
    expect(body['is_live']).toBe(true);
    expect(body['late_join_minutes']).toBe(15);
    expect(typeof body['start_at']).toBe('string');
  });

  it('a normal test is saved as not live', async () => {
    const { fixture, api, c } = await open();
    c.form.patchValue({ title: 'Plain' });
    c.saveDetails();
    await settle(fixture);
    expect((api.save.mock.calls[0][0] as Record<string, unknown>)['is_live']).toBe(false);
  });

  it('cannot be switched on or off once the test is published', async () => {
    const { c } = await open(exam({ id: 9, is_live: true, status: 'published', locked: true }));
    expect(c.form.controls.is_live.disabled).toBe(true);
    expect(c.form.controls.late_join_minutes.disabled).toBe(true);
  });

  it('the late-join window must be between 0 and 180 minutes', async () => {
    const { c } = await open();
    c.form.patchValue({ late_join_minutes: 181 });
    expect(c.form.controls.late_join_minutes.valid).toBe(false);
    c.form.patchValue({ late_join_minutes: 0 });
    expect(c.form.controls.late_join_minutes.valid).toBe(true);
  });
});

describe('ExamForm tab of the exam', () => {
  const cat = (id: number, name: string, tabs: unknown[] = []) => ({
    id, name, description: '', subjects: [], subject_names: [], group: null, group_name: null, is_active: true, exam_count: 0, pattern: {}, tabs,
  });
  const ca = { key: 'cabc12', label: 'Current affairs', visible: true, custom: true };
  const std = [{ key: 'full', label: 'Full tests', visible: true, custom: false }];
  const cats = [cat(3, 'SSC CGL', [ca, ...std]), cat(4, 'SSC MTS', std)];

  async function open(e: Exam | null = null) {
    const api = {
      categories: vi.fn(() => of({ results: cats })), batches: vi.fn(() => of({ results: [] })), get: vi.fn(() => of(e)),
      save: vi.fn((_b: unknown) => of(exam())), saveStructure: vi.fn(() => of(exam())),
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
    return { fixture, api, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }
  const settle = async (fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const hasTabField = (el: HTMLElement) => el.textContent!.includes('Show in tab');

  it('offers the exam\'s own tabs, and only when it has some', async () => {
    const { fixture, c, el } = await open();
    expect(hasTabField(el)).toBe(false);
    c.form.patchValue({ category: 3 });
    await settle(fixture);
    expect(c.customTabs().map((t) => t.key)).toEqual(['cabc12']);
    expect(hasTabField(el)).toBe(true);
    c.form.patchValue({ category: 4 });
    await settle(fixture);
    expect(hasTabField(el)).toBe(false);
  });

  it('sends the chosen tab, and starts empty (by type)', async () => {
    const { fixture, c, api } = await open();
    expect(c.form.getRawValue().tab_key).toBe('');
    c.form.patchValue({ title: 'Weekly', category: 3, tab_key: 'cabc12' });
    await settle(fixture);
    c.saveDetails();
    expect((api.save.mock.calls[0][0] as { tab_key: string }).tab_key).toBe('cabc12');
  });

  it('forgets the tab when the exam is changed, because a tab belongs to one exam', async () => {
    const { fixture, c } = await open();
    c.form.patchValue({ category: 3 });
    await settle(fixture);
    c.form.patchValue({ tab_key: 'cabc12' });
    c.form.patchValue({ category: 4 });
    await settle(fixture);
    expect(c.form.getRawValue().tab_key).toBe('');
  });

  it('shows the tab a saved test is in', async () => {
    const { c } = await open(exam({ category: 3, tab_key: 'cabc12' }));
    expect(c.form.getRawValue().tab_key).toBe('cabc12');
  });
});
