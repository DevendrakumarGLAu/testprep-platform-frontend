import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NotifyService } from '../../../core/notify.service';
import { Exam } from '../exams/exam.models';
import { ContentService } from './content.service';
import { NoteDialog } from './study-notes';
import { SeriesDialog } from './test-series';

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
