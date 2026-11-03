import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NotifyService } from '../../core/notify.service';
import { Batches } from './exams/batches';
import { CatalogueDialog, ExamCatalogue } from './exams/exam-catalogue';
import { ExamForm } from './exams/exam-form';
import { ExamList } from './exams/exam-list';
import { ExamService } from './exams/exam.service';
import { QuestionPicker } from './exams/question-picker';
import { QuestionBankService } from './question-bank/qb.service';
import { ImportWizard } from './imports/import-wizard';
import { ImportService } from './imports/import.service';
import { RowFixDialog } from './imports/row-fix-dialog';

const MATERIAL = 'mat-card, mat-icon, mat-table, mat-paginator, mat-form-field, mat-select, mat-checkbox, mat-radio-group, mat-tab-group, mat-menu, mat-slide-toggle, mat-button-toggle-group, mat-progress-bar, [mat-flat-button], [mat-button], [mat-icon-button], [mat-stroked-button]';
const notify = () => ({ provide: NotifyService, useValue: { success: vi.fn(), error: vi.fn() } });
const button = (el: HTMLElement, label: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === label)!;

const examRow = (id: number, status: string, over: Record<string, unknown> = {}) => ({
  id, public_id: `p${id}`, title: `Test ${id}`, category_name: 'SSC', test_type: 'full_test', question_count: 10, total_marks: '20', duration_minutes: 30,
  start_at: null, end_at: null, status, is_live: false, ...over,
});

describe('Exam list (Bootstrap)', () => {
  function open(rows = [examRow(1, 'draft'), examRow(2, 'published', { is_live: true })]) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), notify(), { provide: ExamService, useValue: { list: () => of({ count: rows.length, results: rows }) } }],
    });
    const f = TestBed.createComponent(ExamList);
    f.detectChanges();
    TestBed.tick();
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement };
  }

  it('lists tests in a Bootstrap table, with a LIVE mark and a pager', () => {
    const { el } = open();
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.querySelector('.live-chip')!.textContent).toContain('LIVE');
    expect(el.querySelector('app-bs-pager .range')!.textContent).toContain('1–2 of 2');
    expect(el.querySelector(MATERIAL)).toBeNull();
  });

  it('a row menu opens with the actions that fit the status, and closes on a click elsewhere', () => {
    const { f, el } = open();
    el.querySelectorAll<HTMLButtonElement>('button[aria-label="Actions"]')[0].click();
    f.detectChanges();
    const items = Array.from(el.querySelectorAll('.dropdown-item')).map((i) => i.textContent!.trim());
    expect(items).toContain('Publish');
    expect(items).toContain('Delete draft');
    expect(items).not.toContain('Unpublish');
    expect(el.querySelectorAll('.dropdown-menu').length).toBe(1);
    el.querySelectorAll<HTMLButtonElement>('button[aria-label="Actions"]')[1].click();
    f.detectChanges();
    expect(el.querySelectorAll('.dropdown-menu').length).toBe(1);
    expect(Array.from(el.querySelectorAll('.dropdown-item')).map((i) => i.textContent!.trim())).toContain('Unpublish');
    document.body.click();
    f.detectChanges();
    expect(el.querySelector('.dropdown-menu')).toBeNull();
  });
});

describe('Batches and exam catalogue (Bootstrap)', () => {
  it('lists batches in a Bootstrap table', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), notify(), { provide: ExamService, useValue: { batches: () => of({ results: [{ id: 1, name: 'Evening', member_count: 4, is_active: true }] }) } }],
    });
    const f = TestBed.createComponent(Batches);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('tbody tr')!.textContent).toContain('Evening');
    expect(el.querySelector('button[aria-label="Manage members"]')).not.toBeNull();
    expect(el.querySelector(MATERIAL)).toBeNull();
  });

  it('lists exams with their section chips', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), notify(),
        { provide: ExamService, useValue: { categories: () => of({ results: [{ id: 1, name: 'SSC CGL', description: 'Combined', group_name: 'SSC', subject_names: ['Maths', 'GK'], exam_count: 3, is_active: true }] }), groups: () => of({ results: [] }) } },
        { provide: QuestionBankService, useValue: { subjects: () => of({ results: [] }) } },
      ],
    });
    const f = TestBed.createComponent(ExamCatalogue);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('tbody .chip').length).toBe(2);
    expect(el.querySelector(MATERIAL)).toBeNull();
  });

  it('the exam pop-up ticks sections from a list and moves its tabs', () => {
    const close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        notify(),
        { provide: ExamService, useValue: {} },
        { provide: MAT_DIALOG_DATA, useValue: { exam: null, groups: [], subjects: [{ id: 1, name: 'Maths' }, { id: 2, name: 'GK' }] } },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    const f = TestBed.createComponent(CatalogueDialog);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector(MATERIAL)).toBeNull();
    el.querySelector<HTMLInputElement>('#cd-sub-2')!.click();
    expect(f.componentInstance.form.controls.subjects.value).toEqual([2]);
    el.querySelector<HTMLInputElement>('#cd-sub-2')!.click();
    expect(f.componentInstance.form.controls.subjects.value).toEqual([]);
    const names = () => Array.from(el.querySelectorAll<HTMLInputElement>('.tab-row input.form-control')).map((i) => i.value);
    const before = names();
    el.querySelectorAll<HTMLButtonElement>('button[aria-label="Move tab down"]')[0].click();
    f.detectChanges();
    expect(names()[1]).toBe(before[0]);
    button(el, 'Cancel').click();
    expect(close).toHaveBeenCalledWith(false);
  });
});

describe('Exam form (Bootstrap)', () => {
  function open(e: Record<string, unknown> | null = null) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), notify(),
        { provide: ExamService, useValue: {
          categories: () => of({ results: [{ id: 1, name: 'SSC', is_active: true }, { id: 2, name: 'Banking', is_active: true }] }),
          batches: () => of({ results: [{ id: 5, name: 'Evening', member_count: 3 }] }),
          get: () => of(e),
        } },
        { provide: QuestionBankService, useValue: { subjects: () => of({ results: [] }) } },
      ],
    });
    const f = TestBed.createComponent(ExamForm);
    f.detectChanges();
    return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement };
  }

  it('is Bootstrap cards and fields, and the other tabs wait until the test is saved', () => {
    const { el } = open();
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelectorAll('.card').length).toBe(3);
    expect(el.querySelector('.form-switch input')).not.toBeNull();
    const tabs = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabs.map((t) => t.textContent!.trim())).toEqual(['Details & rules', 'Questions', 'Access & assignment']);
    expect(tabs.map((t) => t.disabled)).toEqual([false, true, true]);
    expect(el.querySelector(MATERIAL)).toBeNull();
  });

  it('"also show in" ticks other exams into the form', () => {
    const { f, c, el } = open();
    c.form.controls.category.setValue(1);
    f.detectChanges();
    expect(el.querySelector('#ef-also-1')).toBeNull(); // not its own exam
    el.querySelector<HTMLInputElement>('#ef-also-2')!.click();
    expect(c.form.controls.also_in.value).toEqual([2]);
  });

  it('shows the title error after a failed save', () => {
    const { f, c, el } = open();
    c.saveDetails();
    f.detectChanges();
    expect(el.querySelector('#ef-title + .invalid-feedback')!.textContent).toContain('Title is required');
  });

  it('a saved test opens the questions tab and the access tab with batch tick boxes', () => {
    const saved = { id: 7, title: 'Mock', status: 'draft', locked: false, access_type: 'batch', assigned_batch_ids: [5], assigned_student_ids: [], sections: [], also_in: [], total_marks: '0.00' };
    const { f, c, el } = open(saved);
    c.id = (() => '7') as never;
    TestBed.tick();
    c.exam.set(saved as never);
    c.access.set('batch');
    c.tab.set(2);
    f.detectChanges();
    expect(el.querySelectorAll('input[type="radio"]').length).toBe(3);
    el.querySelector<HTMLInputElement>('#ef-batch-5')!.click();
    expect(c.batchIds()).toEqual([5]);
    c.tab.set(1);
    f.detectChanges();
    expect(el.querySelector('.summary')!.textContent).toContain('0 questions');
  });
});

describe('Question picker (Bootstrap)', () => {
  it('lists questions with tick boxes and a pager, and Add returns the picked ones', () => {
    const close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        notify(),
        { provide: QuestionBankService, useValue: {
          subjects: () => of({ results: [{ id: 1, name: 'GK' }] }),
          questions: () => of({ count: 2, results: [{ id: 1, text: 'One?', subject_name: 'GK', difficulty: 'easy', used_in: [] }, { id: 2, text: 'Two?', subject_name: 'GK', difficulty: 'easy', used_in: [] }] }),
          pick: () => of({ available: 0, questions: [] }),
        } },
        { provide: MAT_DIALOG_DATA, useValue: { excludeIds: [] } },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    const f = TestBed.createComponent(QuestionPicker);
    f.detectChanges();
    TestBed.tick();
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector(MATERIAL)).toBeNull();
    expect(el.querySelector('app-bs-pager .range')!.textContent).toContain('1–2 of 2');
    const add = () => Array.from(el.querySelectorAll('button')).find((b) => /^Add\s*\d*\s*selected$/.test(b.textContent!.trim().replace(/\s+/g, ' ')))!;
    expect(add().disabled).toBe(true);
    el.querySelector<HTMLInputElement>('#qp-q-2')!.click();
    f.detectChanges();
    add().click();
    expect(close).toHaveBeenCalledWith([expect.objectContaining({ id: 2 })]);
  });
});

describe('Import wizard (Bootstrap)', () => {
  const job = {
    id: 3, filename: 'q.csv', total_rows: 5, headers: ['Question', 'A', 'B', 'C', 'Answer'], sample: [{ Question: 'Q?', A: 'a', B: 'b', C: 'c', Answer: 'A' }], warnings: [],
    mapping: { question: 'Question', correct: 'Answer', options: ['A', 'B'] },
  };

  function open() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), notify(),
        { provide: ImportService, useValue: { sources: () => of([{ id: 'csv', label: 'CSV', extensions: ['.csv'], available: true, note: 'Spreadsheet' }]), upload: () => of(job) } },
        { provide: QuestionBankService, useValue: { subjects: () => of({ results: [] }), topics: () => of({ results: [] }) } },
      ],
    });
    const f = TestBed.createComponent(ImportWizard);
    f.detectChanges();
    return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement };
  }

  it('starts at the upload step with Bootstrap cards and no Material component', () => {
    const { el } = open();
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('.drop')).not.toBeNull();
    expect(el.querySelectorAll('.steps li').length).toBe(4);
    expect(el.querySelector(MATERIAL)).toBeNull();
  });

  it('on the map step, option columns are ticked from a list and stay in file order', () => {
    const { f, c, el } = open();
    c.job.set(job as never);
    c.mapping.set({ ...job.mapping } as never);
    c.step.set('map');
    f.detectChanges();
    const boxes = el.querySelectorAll<HTMLInputElement>('input[id^="iw-opt-"]');
    expect(boxes.length).toBe(5);
    expect(boxes[1].checked).toBe(true);
    expect(boxes[3].checked).toBe(false);
    boxes[3].click();
    f.detectChanges();
    expect(c.mapping().options).toEqual(['A', 'B', 'C']);
    boxes[1].click();
    expect(c.mapping().options).toEqual(['B', 'C']);
  });

  it('a mapping list shows the chosen column and changing it updates the mapping', () => {
    const { f, c, el } = open();
    c.job.set(job as never);
    c.mapping.set({ ...job.mapping } as never);
    c.step.set('map');
    f.detectChanges();
    const select = el.querySelector('#iw-correct') as HTMLSelectElement;
    expect(select.value).toBe('Answer');
    select.value = 'C';
    select.dispatchEvent(new Event('change'));
    expect(c.mapping().correct).toBe('C');
  });
});

describe('Row fix pop-up (Bootstrap)', () => {
  it('shows the problems and the fields, and Cancel closes it', () => {
    const close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: ImportService, useValue: {} },
        { provide: MAT_DIALOG_DATA, useValue: {
          jobId: 1, subjects: [{ id: 1, name: 'GK' }],
          row: { id: 9, row_number: 4, errors: ['No correct answer'], normalized: { question: 'Q?', options: [{ label: 'A', text: 'a' }, { label: 'B', text: 'b' }], correct_label: '', subject: 'GK' } },
        } },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    const f = TestBed.createComponent(RowFixDialog);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.textContent).toContain('Fix row 4');
    expect(el.querySelector('.errs')!.textContent).toContain('No correct answer');
    expect(el.querySelectorAll('#rf-correct option').length).toBe(2);
    expect(el.querySelector(MATERIAL + ', [mat-dialog-title], mat-dialog-content')).toBeNull();
    button(el, 'Cancel').click();
    expect(close).toHaveBeenCalledWith(undefined);
  });
});
