import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NotifyService } from '../../../core/notify.service';
import { QuestionBankService } from './qb.service';
import { QuestionForm } from './question-form';
import { QuestionList } from './question-list';
import { QuestionPreview } from './question-preview';
import { NameDialog, SubjectsTopics } from './subjects-topics';

const MATERIAL = 'mat-card, mat-icon, mat-table, mat-paginator, mat-form-field, mat-select, mat-checkbox, mat-radio-group, mat-chip-grid, mat-tab-group, mat-slide-toggle, mat-button-toggle-group, mat-menu, [mat-flat-button], [mat-button], [mat-icon-button], [mat-stroked-button]';
const notify = () => ({ provide: NotifyService, useValue: { success: vi.fn(), error: vi.fn() } });
const button = (el: HTMLElement, label: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === label)!;

const question = (id: number) => ({
  id, text: `Question ${id}?`, text_hi: '', subject: 1, subject_name: 'GK', topic: null, topic_name: null, difficulty: 'easy', question_date: '2026-10-01',
  is_active: true, review_status: 'needs_review', open_reports: 2, used_in: [], options: [{ id: 1, text: 'a', is_correct: true }, { id: 2, text: 'b', is_correct: false }],
  marks: '1', negative_marks: '0.25', version: 1, explanation: 'Because', tags: [], image_url: null,
});

describe('Question form (Bootstrap)', () => {
  function open() {
    const save = vi.fn(() => of({ id: 1 }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), notify(),
        { provide: QuestionBankService, useValue: { saveQuestion: save, subjects: () => of({ results: [{ id: 1, name: 'GK', is_active: true }] }), topics: () => of({ results: [{ id: 5, name: 'Rivers', subject: 1, is_active: true }] }), checkDuplicates: () => of([]) } },
      ],
    });
    const f = TestBed.createComponent(QuestionForm);
    f.detectChanges();
    return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement };
  }

  it('is Bootstrap cards and fields with no Material component', () => {
    const { el } = open();
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelectorAll('.card').length).toBe(3);
    expect(el.querySelectorAll('input[type="radio"]').length).toBe(4);
    expect(el.querySelector('.form-switch input')).not.toBeNull();
    expect(el.querySelector(MATERIAL)).toBeNull();
  });

  it('the language buttons switch the language being edited', () => {
    const { f, c, el } = open();
    button(el, 'हिन्दी (Hindi) (empty)').click();
    f.detectChanges();
    expect(c.lang()).toBe('hi');
    expect(el.querySelector('#qf-text-hi')).not.toBeNull();
    expect(el.querySelector('#qf-text')).toBeNull();
  });

  it('choosing the correct option with its radio marks exactly that option', () => {
    const { f, c, el } = open();
    el.querySelectorAll<HTMLInputElement>('input[type="radio"]')[2].click();
    f.detectChanges();
    expect(c.correctIndex()).toBe(2);
    expect(c.options.controls.map((o) => o.value.is_correct)).toEqual([false, false, true, false]);
  });

  it('a tag is taken on Enter or a comma and removed with its button', () => {
    const { f, c, el } = open();
    const box = el.querySelector('#qf-tag') as HTMLInputElement;
    box.value = ' SSC ';
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    box.value = 'gk';
    box.dispatchEvent(new KeyboardEvent('keydown', { key: ',' }));
    f.detectChanges();
    expect(c.tags()).toEqual(['ssc', 'gk']);
    expect(box.value).toBe('');
    el.querySelector<HTMLButtonElement>('.tag-chip .btn-close')!.click();
    f.detectChanges();
    expect(c.tags()).toEqual(['gk']);
  });

  it('shows what is wrong with the subject after a failed save', () => {
    const { f, c, el } = open();
    c.save();
    f.detectChanges();
    expect(el.querySelector('#qf-subject + .invalid-feedback')!.textContent).toContain('Subject is required');
  });
});

describe('Question list (Bootstrap)', () => {
  function open() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), notify(),
        { provide: QuestionBankService, useValue: {
          subjects: () => of({ results: [{ id: 1, name: 'GK', is_active: true }] }), topics: () => of({ results: [] }), tags: () => of(['ssc']),
          questions: () => of({ count: 3, results: [question(1), question(2)] }),
          bulk: vi.fn(() => of({ updated: 1 })),
        } },
      ],
    });
    const f = TestBed.createComponent(QuestionList);
    f.detectChanges();
    TestBed.tick();
    f.detectChanges();
    return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement };
  }

  it('lists questions in a Bootstrap table with a pager and no Material component', () => {
    const { el } = open();
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.querySelector('tbody tr')!.textContent).toContain('Needs review (2)');
    expect(el.querySelector('app-bs-pager .range')!.textContent).toContain('1–3 of 3');
    expect(el.querySelector(MATERIAL)).toBeNull();
  });

  it('ticking a question shows the bulk bar with the difficulty menu', () => {
    const { f, el } = open();
    expect(el.querySelector('.bulk')).toBeNull();
    el.querySelector<HTMLInputElement>('tbody input[type="checkbox"]')!.click();
    f.detectChanges();
    expect(el.querySelector('.bulk')!.textContent).toContain('1 selected');
    expect(el.querySelector('.dropdown-menu')).toBeNull();
    button(el, 'Set difficulty').click();
    f.detectChanges();
    expect(Array.from(el.querySelectorAll('.dropdown-item')).map((b) => b.textContent!.trim())).toEqual(['Easy', 'Medium', 'Hard']);
    document.body.click();
    f.detectChanges();
    expect(el.querySelector('.dropdown-menu')).toBeNull();
  });

  it('choosing a subject filters by its number and clears the topic', () => {
    const { f, c, el } = open();
    c.topic.set(7);
    const select = el.querySelector('#ql-subject') as HTMLSelectElement;
    select.value = '1';
    select.dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(c.subject()).toBe(1);
    expect(c.topic()).toBeNull();
  });
});

describe('Subjects and topics (Bootstrap)', () => {
  function open() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), notify(),
        { provide: QuestionBankService, useValue: {
          subjects: () => of({ results: [{ id: 1, name: 'GK', topic_count: 2, question_count: 30, is_active: true }] }),
          topics: () => of({ results: [{ id: 5, name: 'Rivers', subject: 1, subject_name: 'GK', question_count: 4, is_active: false }] }),
        } },
      ],
    });
    const f = TestBed.createComponent(SubjectsTopics);
    f.detectChanges();
    return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement };
  }

  it('shows the subjects first and the topics on the second tab', () => {
    const { f, el } = open();
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('tbody tr')!.textContent).toContain('GK');
    expect(el.querySelector(MATERIAL)).toBeNull();
    el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();
    f.detectChanges();
    expect(el.querySelector('tbody tr')!.textContent).toContain('Rivers');
    expect(el.querySelector('.archived')).not.toBeNull();
  });

  it('the name pop-up needs a name and closes when cancelled', () => {
    const close = vi.fn();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { title: 'New subject', value: { name: '', description: '' }, save: vi.fn() } },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    const f = TestBed.createComponent(NameDialog);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    f.detectChanges();
    expect(el.querySelector('.invalid-feedback')!.textContent).toContain('Required');
    button(el, 'Cancel').click();
    expect(close).toHaveBeenCalledWith(false);
  });
});

describe('Question preview (Bootstrap)', () => {
  it('shows the question and marks the right option, and Close closes it', () => {
    const close = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: question(3) }, { provide: MatDialogRef, useValue: { close } }] });
    const f = TestBed.createComponent(QuestionPreview);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.textContent).toContain('Question 3?');
    expect(el.querySelectorAll('li.correct').length).toBe(1);
    expect(el.querySelector('li.correct .bi-check-circle-fill')).not.toBeNull();
    expect(el.querySelector('[mat-dialog-title], mat-dialog-content, mat-icon, [mat-button]')).toBeNull();
    button(el, 'Close').click();
    expect(close).toHaveBeenCalled();
  });
});
