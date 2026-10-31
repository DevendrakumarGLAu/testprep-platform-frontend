import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { FamiliesDialog, CatalogueDialog } from './exam-catalogue';
import { ExamCategory, ExamGroup, STANDARD_TABS } from './exam.models';
import { ExamService } from './exam.service';

const group = (id: number, name: string, order: number, over: Partial<ExamGroup> = {}): ExamGroup => ({
  id, public_id: 'g' + id, name, description: '', order, is_active: true, exam_count: 0, ...over,
});

const category = (over: Partial<ExamCategory> = {}): ExamCategory => ({
  id: 3, name: 'SSC CGL', description: '', subjects: [], subject_names: [], group: null, group_name: null, pattern: {}, is_active: true, exam_count: 0, ...over,
});

describe('Exam dialog: family and pattern', () => {
  let api: { saveCategory: ReturnType<typeof vi.fn>; saveGroup: ReturnType<typeof vi.fn> };

  function open(exam: ExamCategory | null, groups = [group(1, 'SSC Exams', 0)]) {
    api = { saveCategory: vi.fn(() => of(category())), saveGroup: vi.fn((b: { name?: string }) => of(group(9, b.name ?? 'New', 5))) };
    TestBed.configureTestingModule({
      providers: [
        { provide: ExamService, useValue: api },
        { provide: MAT_DIALOG_DATA, useValue: { exam, subjects: [], groups } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const f = TestBed.createComponent(CatalogueDialog);
    f.detectChanges();
    return { f, c: f.componentInstance, ref: TestBed.inject(MatDialogRef) as unknown as { close: ReturnType<typeof vi.fn> } };
  }
  const sent = () => api.saveCategory.mock.calls[0][0] as Record<string, unknown>;

  it('saves the family and only the settings that were filled in', () => {
    const { c } = open(null);
    c.form.patchValue({ name: 'SSC CGL', group: 1, p_duration: 60, p_marks: 2, p_neg: 'fixed', p_negvalue: 0.5, p_attempts: 0 });
    c.save();
    expect(sent()['group']).toBe(1);
    expect(sent()['pattern']).toEqual({ duration_minutes: 60, marks_per_question: 2, max_attempts: 0, negative_option: 'fixed', negative_value: 0.5 });
  });

  it('turns one section per line into sections, with optional minutes after a bar', () => {
    const { c } = open(null);
    c.form.patchValue({ name: 'SSC CGL', p_sectional: true, p_sections: 'General Intelligence | 15\n\n  English  \nMaths | x' });
    c.save();
    expect((sent()['pattern'] as { sections: unknown }).sections).toEqual([
      { name: 'General Intelligence', duration_minutes: 15 }, { name: 'English', duration_minutes: null }, { name: 'Maths', duration_minutes: null },
    ]);
    expect((sent()['pattern'] as { sectional_timing: boolean }).sectional_timing).toBe(true);
  });

  it('an empty pattern is sent as an empty pattern, which clears a saved one', () => {
    const { c } = open(category({ pattern: { duration_minutes: 60 } }));
    c.form.patchValue({ p_duration: null });
    c.save();
    expect(sent()['pattern']).toEqual({});
  });

  it('shows a saved pattern and family when an exam is edited', () => {
    const { c } = open(category({ group: 1, pattern: { duration_minutes: 45, negative_option: 'fraction', negative_value: 0.25, sections: [{ name: 'GK', duration_minutes: 10 }, { name: 'English', duration_minutes: null }] } }));
    const v = c.form.getRawValue();
    expect([v.group, v.p_duration, v.p_neg, v.p_negvalue]).toEqual([1, 45, 'fraction', 0.25]);
    expect(v.p_sections).toBe('GK | 10\nEnglish');
  });

  it('does not send a deduction when negative marking is off', () => {
    const { c } = open(null);
    c.form.patchValue({ name: 'X', p_neg: 'off', p_negvalue: 0.5 });
    c.save();
    expect(sent()['pattern']).toEqual({ negative_option: 'off' });
  });

  it('needs a name', () => {
    const { c } = open(null);
    c.save();
    expect(api.saveCategory).not.toHaveBeenCalled();
  });

  it('can create a family on the spot and picks it', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Railways');
    const { c } = open(null);
    c.addGroup(new Event('click'));
    expect(api.saveGroup).toHaveBeenCalledWith({ name: 'Railways' });
    expect(c.form.controls.group.value).toBe(9);
    expect(c.groups().map((g) => g.name)).toEqual(['SSC Exams', 'Railways']);
  });
});

describe('Families dialog', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  function open(list: ExamGroup[]) {
    api = {
      groups: vi.fn(() => of({ results: list })),
      saveGroup: vi.fn(() => of(group(1, 'x', 0))),
      deleteGroup: vi.fn(() => of(null)),
    };
    TestBed.configureTestingModule({ providers: [{ provide: ExamService, useValue: api }, { provide: MatDialogRef, useValue: { close: vi.fn() } }] });
    const f = TestBed.createComponent(FamiliesDialog);
    f.detectChanges();
    return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement };
  }

  it('lists the families with how many exams each holds', () => {
    const { el } = open([group(1, 'SSC Exams', 0, { exam_count: 3 }), group(2, 'Railways', 1, { exam_count: 1 })]);
    expect(el.textContent).toContain('SSC Exams');
    expect(el.textContent).toContain('3 exams');
    expect(el.textContent).toContain('1 exam');
  });

  it('moving a family down swaps the order of the two', () => {
    const { c } = open([group(1, 'SSC Exams', 0), group(2, 'Railways', 1)]);
    c.move(0, 1);
    const calls = api['saveGroup'].mock.calls.map((x) => x);
    expect(calls).toContainEqual([{ order: 0 }, 2]);
    expect(calls).toContainEqual([{ order: 1 }, 1]);
    expect(c.changed).toBe(true);
  });

  it('cannot move the first family up or the last one down', () => {
    const { c } = open([group(1, 'SSC Exams', 0), group(2, 'Railways', 1)]);
    c.move(0, -1);
    c.move(1, 1);
    expect(api['saveGroup']).not.toHaveBeenCalled();
  });

  it('adds a family after the existing ones', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('  Banking ');
    const { c } = open([group(1, 'SSC Exams', 0)]);
    c.add();
    expect(api['saveGroup']).toHaveBeenCalledWith({ name: 'Banking', order: 1 });
  });

  it('renames only when the name actually changed', () => {
    const prompt = vi.spyOn(window, 'prompt');
    const { c } = open([group(1, 'SSC Exams', 0)]);
    prompt.mockReturnValue('SSC Exams');
    c.rename(group(1, 'SSC Exams', 0));
    expect(api['saveGroup']).not.toHaveBeenCalled();
    prompt.mockReturnValue('SSC');
    c.rename(group(1, 'SSC Exams', 0));
    expect(api['saveGroup']).toHaveBeenCalledWith({ name: 'SSC' }, 1);
  });

  it('hides and shows a family', () => {
    const { c } = open([group(1, 'SSC Exams', 0)]);
    c.toggle(group(1, 'SSC Exams', 0));
    expect(api['saveGroup']).toHaveBeenCalledWith({ is_active: false }, 1);
  });

  it('deletes after confirmation only', () => {
    const { c } = open([group(1, 'Empty', 0)]);
    const dialog = (c as unknown as { dialog: MatDialog }).dialog; // the dialog service this component really uses
    const open$ = vi.spyOn(dialog, 'open');
    open$.mockReturnValue({ afterClosed: () => of(false) } as never);
    c.remove(group(1, 'Empty', 0));
    expect(api['deleteGroup']).not.toHaveBeenCalled();
    open$.mockReturnValue({ afterClosed: () => of(true) } as never);
    c.remove(group(1, 'Empty', 0));
    expect(api['deleteGroup']).toHaveBeenCalledWith(1);
  });
});

describe('Exam dialog: student tabs', () => {
  function open(exam: ExamCategory | null) {
    const api = { saveCategory: vi.fn(() => of(category())), saveGroup: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: ExamService, useValue: api },
        { provide: MAT_DIALOG_DATA, useValue: { exam, subjects: [], groups: [] } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const f = TestBed.createComponent(CatalogueDialog);
    f.detectChanges();
    return { f, c: f.componentInstance, api };
  }
  const keys = (c: CatalogueDialog) => c.tabs().map((t) => t.key);

  it('starts with the four standard tabs, all showing', () => {
    const { c, f } = open(null);
    expect(keys(c)).toEqual(['full', 'mini', 'previous', 'subject']);
    expect(c.tabs().every((t) => t.visible)).toBe(true);
    expect(f.nativeElement.querySelectorAll('.tab-row').length).toBe(4);
  });

  it('shows the tabs the exam already has, in its order', () => {
    const { c } = open(category({ tabs: [{ key: 'subject', label: 'By subject', visible: true }, { key: 'full', label: 'Full tests', visible: false }, { key: 'mini', label: 'Mini mocks', visible: true }, { key: 'previous', label: 'Previous year', visible: true }] }));
    expect(keys(c)).toEqual(['subject', 'full', 'mini', 'previous']);
    expect(c.tabs()[0].label).toBe('By subject');
  });

  it('renames, hides and reorders, and saves exactly that', () => {
    const { c, api } = open(null);
    c.setTab(1, { label: ' Mock minis ', visible: false });
    c.moveTab(3, -1);
    c.form.patchValue({ name: 'SSC CGL' });
    c.save();
    const sent = (api.saveCategory.mock.calls[0] as unknown[])[0] as { tabs: { key: string; label: string; visible: boolean }[] };
    expect(sent.tabs.map((t) => t.key)).toEqual(['full', 'mini', 'subject', 'previous']);
    expect(sent.tabs[1]).toEqual({ key: 'mini', label: 'Mock minis', visible: false });
  });

  it('cannot move the first tab up or the last down past the edge, and the standard list is not changed', () => {
    const { c } = open(null);
    c.setTab(0, { label: 'Changed' });
    expect(STANDARD_TABS[0].label).toBe('Full tests');
  });

  it('refuses to save with every tab hidden', () => {
    const { c, api } = open(null);
    for (let i = 0; i < 4; i++) c.setTab(i, { visible: false });
    c.form.patchValue({ name: 'SSC CGL' });
    c.save();
    expect(api.saveCategory).not.toHaveBeenCalled();
    expect(c.error()).toBe('Show at least one tab.');
  });
});

describe('Exam dialog: adding tabs', () => {
  function open(exam: ExamCategory | null) {
    const api = { saveCategory: vi.fn(() => of(category())), saveGroup: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: ExamService, useValue: api },
        { provide: MAT_DIALOG_DATA, useValue: { exam, subjects: [], groups: [] } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const f = TestBed.createComponent(CatalogueDialog);
    f.detectChanges();
    return { f, c: f.componentInstance, api };
  }
  const body = (api: { saveCategory: ReturnType<typeof vi.fn> }) => (api.saveCategory.mock.calls[0] as unknown[])[0] as { tabs: { key: string; label: string; visible: boolean }[] };

  it('adds a tab of your own with a generated key, and saves it with the others', () => {
    const { c, api } = open(null);
    c.addTab('  Current affairs  ');
    expect(c.tabs().length).toBe(5);
    const added = c.tabs()[4];
    expect(added).toMatchObject({ label: 'Current affairs', visible: true, custom: true });
    expect(added.key).toMatch(/^c[a-z0-9]{6}$/);
    c.form.patchValue({ name: 'SSC CGL' });
    c.save();
    expect(body(api).tabs[4]).toEqual({ key: added.key, label: 'Current affairs', visible: true }); // no extra fields sent
  });

  it('ignores an empty name, and stops at 12 tabs', () => {
    const { c } = open(null);
    c.addTab('   ');
    expect(c.tabs().length).toBe(4);
    for (let i = 0; i < 12; i++) c.addTab('T' + i);
    expect(c.tabs().length).toBe(12);
    expect(c.error()).toContain('at most 12');
  });

  it('only your own tabs have a delete button, and deleting removes it', () => {
    const { c, f } = open(null);
    c.addTab('Typing');
    f.detectChanges();
    const buttons = (f.nativeElement as HTMLElement).querySelectorAll('[aria-label="Delete this tab"]');
    expect(buttons.length).toBe(1);
    c.removeTab(4);
    f.detectChanges();
    expect(c.tabs().length).toBe(4);
    expect(c.hasCustomTabs()).toBe(false);
  });

  it('shows saved custom tabs and keeps their keys when renamed', () => {
    const { c, api } = open(category({ tabs: [{ key: 'cabc12', label: 'CA', visible: true, custom: true }, { key: 'full', label: 'Full tests', visible: true }, { key: 'mini', label: 'Mini mocks', visible: true }, { key: 'previous', label: 'Previous year', visible: true }, { key: 'subject', label: 'Subject wise', visible: true }] }));
    c.setTab(0, { label: 'Daily CA' });
    c.save();
    expect(body(api).tabs[0]).toEqual({ key: 'cabc12', label: 'Daily CA', visible: true });
  });

  it('refuses a new tab whose name was cleared', () => {
    const { c, api } = open(null);
    c.addTab('Typing');
    c.setTab(4, { label: '  ' });
    c.form.patchValue({ name: 'SSC CGL' });
    c.save();
    expect(api.saveCategory).not.toHaveBeenCalled();
    expect(c.error()).toBe('Give every new tab a name.');
  });
});
