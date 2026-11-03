import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NotifyService } from '../../../core/notify.service';
import { Exam } from '../exams/exam.models';
import { ExamService } from '../exams/exam.service';
import { QuestionBankService } from '../question-bank/qb.service';
import { ContentService } from './content.service';
import { provideRouter } from '@angular/router';
import { Announcements } from './announcements';
import { NoteDialog, StudyNotes } from './study-notes';
import { SeriesDialog, TestSeriesPage } from './test-series';

const text = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent!.replace(/\s+/g, ' ');

describe('NoteDialog', () => {
  function open(note: unknown = null) {
    const api = { saveNote: vi.fn(() => of({})) };
    const close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: ContentService, useValue: api },
        { provide: MAT_DIALOG_DATA, useValue: { note, categories: [], subjects: [] } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: NotifyService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    const f = TestBed.createComponent(NoteDialog);
    f.detectChanges();
    return { f, c: f.componentInstance, api, close };
  }

  it('needs a title and a body in some language', () => {
    const { c, api } = open();
    c.save();
    expect(c.error()).toContain('title');
    c.form.patchValue({ title_hi: 'शीर्षक' });
    c.save();
    expect(c.error()).toContain('Write the note');
    expect(api.saveNote).not.toHaveBeenCalled();
  });

  it('saves a Hindi-only note and closes', () => {
    const { c, api, close } = open();
    c.form.patchValue({ title_hi: 'शीर्षक', body_hi: 'पाठ', is_published: true });
    c.save();
    expect(api.saveNote).toHaveBeenCalled();
    const [body, id] = api.saveNote.mock.calls[0] as unknown as [Record<string, unknown>, number | undefined];
    expect(body).toMatchObject({ title_hi: 'शीर्षक', body_hi: 'पाठ', is_published: true });
    expect(id).toBeUndefined();
    expect(close).toHaveBeenCalledWith(true);
  });

  it('edits an existing note by id', () => {
    const { c, api } = open({ id: 7, title: 'Old', title_hi: '', body: 'text', body_hi: '', category: null, subject: null, note_date: '2026-10-01', is_published: false });
    c.form.patchValue({ title: 'New' });
    c.save();
    expect((api.saveNote.mock.calls[0] as unknown as [unknown, number])[1]).toBe(7);
  });
});

describe('SeriesDialog', () => {
  const exam = (id: number, title: string, status = 'published') => ({ id, title, status }) as unknown as Exam;

  function open(series: unknown = null) {
    const api = { saveSeries: vi.fn(() => of({})) };
    const close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: ContentService, useValue: api },
        { provide: MAT_DIALOG_DATA, useValue: { series, categories: [], exams: [exam(1, 'Mock 1'), exam(2, 'Mock 2'), exam(3, 'Old', 'archived')] } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MatDialog, useValue: {} },
      ],
    });
    const f = TestBed.createComponent(SeriesDialog);
    f.detectChanges();
    return { f, c: f.componentInstance, api, close };
  }

  it('builds the order by adding, moving and removing tests, and never offers archived ones', () => {
    const { f, c } = open();
    expect(c.available().map((e) => e.id)).toEqual([1, 2]);
    c.add(1);
    c.add(2);
    c.move(1, -1);
    f.detectChanges();
    expect(c.chosen().map((e) => e.title)).toEqual(['Mock 2', 'Mock 1']);
    expect(c.available()).toEqual([]);
    c.remove(2);
    expect(c.chosen().map((e) => e.id)).toEqual([1]);
    expect(text(f)).toContain('Mock 1');
  });

  it('sends the title, the ordered test ids and the published flag', () => {
    const { c, api, close } = open();
    c.save();
    expect(c.error()).toContain('title');
    c.form.patchValue({ title: 'SSC mocks', is_published: true });
    c.add(2);
    c.add(1);
    c.save();
    expect(api.saveSeries.mock.calls[0]).toEqual([expect.objectContaining({ title: 'SSC mocks', is_published: true, exam_ids: [2, 1] }), undefined]);
    expect(close).toHaveBeenCalledWith(true);
  });
});

const MATERIAL = 'mat-card, mat-icon, mat-table, mat-form-field, mat-select, mat-slide-toggle, mat-progress-bar, [mat-flat-button], [mat-button], [mat-icon-button]';
const button = (el: HTMLElement, label: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === label)!;

describe('Content pages (Bootstrap)', () => {
  it('the note pop-up is a Bootstrap form with a switch, and Cancel closes it', () => {
    const close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: ContentService, useValue: {} },
        { provide: MAT_DIALOG_DATA, useValue: { note: null, categories: [{ id: 1, name: 'SSC' }], subjects: [{ id: 2, name: 'GK' }] } },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    const f = TestBed.createComponent(NoteDialog);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('.form-switch input[type="checkbox"]')).not.toBeNull();
    expect(Array.from(el.querySelectorAll('#nd-exam option')).map((o) => o.textContent!.trim())).toEqual(['Any exam', 'SSC']);
    expect(el.querySelector('[mat-dialog-title], mat-dialog-content, mat-form-field, mat-select, mat-slide-toggle')).toBeNull();
    button(el, 'Cancel').click();
    expect(close).toHaveBeenCalledWith(false);
  });

  it('the series pop-up adds a test from the list and takes it out of the list', () => {
    const exams = [{ id: 1, title: 'Mock 1', status: 'published' }, { id: 2, title: 'Mock 2', status: 'published' }];
    TestBed.configureTestingModule({
      providers: [
        { provide: ContentService, useValue: {} },
        { provide: MAT_DIALOG_DATA, useValue: { series: null, categories: [], exams } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const f = TestBed.createComponent(SeriesDialog);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const select = el.querySelector('#sd-add') as HTMLSelectElement;
    select.value = '2';
    select.dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(f.componentInstance.chosen().map((e) => e.id)).toEqual([2]);
    expect(el.querySelectorAll('ol li .t')[0].textContent).toContain('Mock 2');
    expect(Array.from((el.querySelector('#sd-add') as HTMLSelectElement).options).map((o) => o.value)).toEqual(['', '1']);
    expect(el.querySelector('mat-icon, [mat-icon-button], mat-select')).toBeNull();
  });

  it('the study notes list is a Bootstrap table with edit and delete buttons', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ContentService, useValue: { notes: () => of({ results: [{ id: 1, title: 'Oct capsule', title_hi: '', category_name: 'SSC', subject_name: null, note_date: '2026-10-01', is_published: true }] }) } },
        { provide: ExamService, useValue: { categories: () => of({ results: [] }) } },
        { provide: QuestionBankService, useValue: { subjects: () => of({ results: [] }) } },
        { provide: NotifyService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    const f = TestBed.createComponent(StudyNotes);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('table.table tbody tr')!.textContent).toContain('Oct capsule');
    expect(el.querySelector('button[aria-label="Edit note"]')).not.toBeNull();
    expect(el.querySelector('button[aria-label="Delete note"]')).not.toBeNull();
    expect(el.querySelector(MATERIAL)).toBeNull();
  });

  it('the test series list is a Bootstrap table', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ContentService, useValue: { series: () => of({ results: [{ id: 1, title: 'SSC mocks', category_name: null, exams: [{ id: 1 }, { id: 2 }], is_published: false }] }) } },
        { provide: ExamService, useValue: { categories: () => of({ results: [] }), list: () => of({ results: [] }) } },
        { provide: NotifyService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    const f = TestBed.createComponent(TestSeriesPage);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('table.table tbody tr')!.textContent).toContain('SSC mocks');
    expect(el.querySelector('tbody td:nth-child(3)')!.textContent).toContain('Draft');
    expect(el.querySelector(MATERIAL)).toBeNull();
  });

  it('announcements: the audience list shows the exam or batch list that fits it', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ExamService, useValue: { categories: () => of({ results: [{ id: 1, name: 'SSC', is_active: true }] }), batches: () => of({ results: [{ id: 3, name: 'Evening', is_active: true }] }) } },
        { provide: NotifyService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: MatDialog, useValue: {} },
        { provide: HttpClient, useValue: {} },
      ],
    });
    const f = TestBed.createComponent(Announcements);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('#an-exam')).toBeNull();
    f.componentInstance.form.patchValue({ audience: 'exam' });
    f.detectChanges();
    expect(Array.from(el.querySelectorAll('#an-exam option')).map((o) => o.textContent!.trim())).toEqual(['SSC']);
    f.componentInstance.form.patchValue({ audience: 'batch' });
    f.detectChanges();
    expect(el.querySelector('#an-exam')).toBeNull();
    expect(Array.from(el.querySelectorAll('#an-batch option')).map((o) => o.textContent!.trim())).toEqual(['Evening']);
    expect(el.querySelector(MATERIAL)).toBeNull();
  });
});
