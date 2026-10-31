import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifyService } from '../../core/notify.service';
import { ResultData } from '../../shared/result.models';
import { ReportDialog } from './report-dialog';
import { Saved } from './saved';
import { SavedList, SavedQuestion } from './student.models';
import { StudentResultPage } from './result-page';
import { StudentService } from './student.service';

const saved = (id: number, note = ''): SavedQuestion => ({
  id, exam_title: 'Mock 1', subject: 'Geo', text: `Question ${id}?`, text_hi: `प्रश्न ${id}?`, note,
  options: [{ id: 1, text: 'right', text_hi: 'सही', is_correct: true }, { id: 2, text: 'wrong', text_hi: 'गलत', is_correct: false }],
  selected_option: 2, explanation: 'because', explanation_hi: 'क्योंकि', created_at: '2026-10-20T10:00:00Z',
});
const text = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent!.replace(/\s+/g, ' ');

describe('Saved questions page', () => {
  function open(api: Record<string, unknown>) {
    localStorage.clear();
    const notify = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StudentService, useValue: api }, { provide: NotifyService, useValue: notify }] });
    const f = TestBed.createComponent(Saved);
    f.detectChanges();
    return { f, c: f.componentInstance, notify };
  }

  const list = (): SavedList => ({ count: 2, subjects: ['Geo'], results: [saved(1, 'remember'), saved(2)] });
  const base = () => ({ saved: vi.fn(() => of(list())), myReports: vi.fn(() => of({ results: [] })) });

  it('shows each question with its answer, explanation and note', async () => {
    const { f } = open(base());
    await f.whenStable();
    f.detectChanges();
    const t = text(f);
    expect(t).toContain('Question 1?');
    expect(t).toContain('Correct answer');
    expect(t).toContain('Your answer');
    expect(t).toContain('because');
    expect((f.nativeElement.querySelector('textarea') as HTMLTextAreaElement).value).toBe('remember');
  });

  it('shows the question in Hindi when that language is chosen', () => {
    const { f } = open(base());
    TestBed.inject(StudentService);
    localStorage.setItem('tp_lang', 'hi');
    // the language service reads storage when created, so switch it directly
    const langs = (f.componentInstance as unknown as { langs: { set(l: 'hi'): void } }).langs;
    langs.set('hi');
    f.detectChanges();
    expect(text(f)).toContain('प्रश्न 1?');
  });

  it('saves a changed note, and only a changed one', () => {
    const api = { ...base(), updateSaved: vi.fn(() => of(saved(1, 'new note'))) };
    const { f, c, notify } = open(api);
    const s = c.data()!.results[0];
    expect(c.isDirty(s)).toBe(false);
    c.draft(1, 'new note');
    expect(c.isDirty(s)).toBe(true);
    c.saveNote(s);
    expect(api.updateSaved).toHaveBeenCalledWith(1, 'new note');
    expect(c.data()!.results[0].note).toBe('new note');
    expect(notify.success).toHaveBeenCalledWith('Note saved.');
    f.detectChanges();
  });

  it('removes a saved question from the list', () => {
    const api = { ...base(), deleteSaved: vi.fn(() => of(undefined)) };
    const { f, c } = open(api);
    c.remove(c.data()!.results[0]);
    f.detectChanges();
    expect(c.data()!.results.map((r) => r.id)).toEqual([2]);
    expect(text(f)).not.toContain('Question 1?');
  });

  it('explains an empty list, and shows how my reports were answered', () => {
    const api = {
      saved: vi.fn(() => of({ count: 0, subjects: [], results: [] })),
      myReports: vi.fn(() => of({ results: [{ id: 1, question: 'Which river?', exam_title: 'Mock 1', reason: 'The marked answer is wrong', message: '', status: 'resolved', status_label: 'Fixed', admin_note: 'Key corrected', image_url: 'https://cdn.example/storage/reports/a.png', created_at: '', resolved_at: '' }] })),
    };
    const { f } = open(api);
    const t = text(f);
    expect(t).toContain('You have not saved any questions yet');
    expect(t).toContain('Problems I reported');
    expect(t).toContain('Fixed');
    expect(t).toContain('Key corrected');
    const img = f.nativeElement.querySelector('img.thumb') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://cdn.example/storage/reports/a.png');
  });

  it('opens the picture I sent at full size', () => {
    const api = {
      saved: vi.fn(() => of({ count: 0, subjects: [], results: [] })),
      myReports: vi.fn(() => of({ results: [{ id: 1, question: 'Q', exam_title: 'M', reason: 'Typo', message: '', status: 'open', status_label: 'Open', admin_note: '', image_url: 'https://cdn.example/storage/reports/a.png', created_at: '', resolved_at: '' }] })),
    };
    const { f, c } = open(api);
    const zoom = vi.spyOn(c, 'zoom').mockImplementation(() => undefined);
    (f.nativeElement.querySelector('img.thumb') as HTMLImageElement).click();
    expect(zoom).toHaveBeenCalledWith('https://cdn.example/storage/reports/a.png');
  });

  it('a report without a picture shows no thumbnail', () => {
    const api = {
      saved: vi.fn(() => of({ count: 0, subjects: [], results: [] })),
      myReports: vi.fn(() => of({ results: [{ id: 1, question: 'Q', exam_title: 'M', reason: 'Typo', message: '', status: 'open', status_label: 'Open', admin_note: '', image_url: null, created_at: '', resolved_at: '' }] })),
    };
    const { f } = open(api);
    expect(f.nativeElement.querySelector('img.thumb')).toBeNull();
  });
});

describe('Result page: save and report buttons', () => {
  const result = (over: Partial<ResultData['questions'][number]> = {}): ResultData => ({
    attempt: { id: 'att1', attempt_number: 1, submitted_at: '2026-10-20T10:00:00Z', auto_submitted: false },
    exam: { id: 'ex1', title: 'Mock 1' },
    summary: { score: '1.00', total_marks: '2.00', passing_marks: '1.00', passed: true, percentage: 50, correct: 1, incorrect: 1, unanswered: 0, accuracy: '50', time_taken_seconds: 60 },
    sections: [], timing: { total_seconds: 60, average_seconds: 30, slowest: null }, subjects: [],
    comparison: { attempts_count: 1, average_percentage: null }, solutions_available: true,
    questions: [{
      number: 1, section: 'S', subject: 'Geo', text: 'Q1?', image_url: null, marks: '1', selected_option: 2, time_spent_seconds: 5,
      options: [{ id: 1, text: 'right', is_correct: true }, { id: 2, text: 'wrong', is_correct: false }],
      status: 'incorrect', marks_awarded: '-0.25', explanation: 'because', saved_id: null, report_status: null, ...over,
    }],
  });

  function open(api: Record<string, unknown>, dialogResult: unknown = undefined) {
    localStorage.clear();
    const notify = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), { provide: NotifyService, useValue: notify },
        { provide: StudentService, useValue: { leaderboard: () => throwError(() => ({ status: 403 })), ...api } },
        { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) } },
      ],
    });
    const f = TestBed.createComponent(StudentResultPage);
    f.componentRef.setInput('id', 'att1');
    f.detectChanges();
    return { f, c: f.componentInstance, notify };
  }

  const buttons = (f: { nativeElement: HTMLElement }) => [...f.nativeElement.querySelectorAll<HTMLButtonElement>('.q-actions button')];

  it('shows Save and Report under each reviewed question', () => {
    const { f } = open({ result: vi.fn(() => of(result())) });
    expect(buttons(f).map((b) => b.textContent!.trim())).toEqual(['replay Re-attempt', 'bookmark_border Save', 'flag Report a problem']);
  });

  it('saves and un-saves a question', async () => {
    const api = {
      result: vi.fn(() => of(result())),
      saveQuestion: vi.fn(() => of({ id: 9 })),
      unsaveQuestion: vi.fn(() => of(undefined)),
    };
    const { f, c, notify } = open(api);
    await c.toggleSave(1);
    f.detectChanges();
    expect(api.saveQuestion).toHaveBeenCalledWith('att1', 1);
    expect(buttons(f)[1].textContent).toContain('Saved');
    await c.toggleSave(1);
    expect(api.unsaveQuestion).toHaveBeenCalledWith('att1', 1);
    expect(notify.success).toHaveBeenCalledTimes(2);
  });

  it('sends a report and then shows it as waiting', async () => {
    const api = { result: vi.fn(() => of(result())), reportQuestion: vi.fn(() => of({ id: 1, status: 'open', updated: false, image_url: null })) };
    const { f, c } = open(api, { reason: 'typo', message: 'Spelling of Ganga', image: null });
    await c.reportQuestion(1);
    f.detectChanges();
    expect(api.reportQuestion).toHaveBeenCalledWith('att1', 1, 'typo', 'Spelling of Ganga', null);
    expect(buttons(f)[2].textContent).toContain('Reported, waiting for review');
    expect(buttons(f)[2].disabled).toBe(true);
  });

  it('sends nothing when the report dialog is cancelled', async () => {
    const api = { result: vi.fn(() => of(result())), reportQuestion: vi.fn() };
    const { c } = open(api, undefined);
    await c.reportQuestion(1);
    expect(api.reportQuestion).not.toHaveBeenCalled();
  });

  it('shows the error when saving fails', async () => {
    const api = { result: vi.fn(() => of(result())), saveQuestion: vi.fn(() => throwError(() => ({ error: { detail: 'Not allowed.' } }))) };
    const { c, notify } = open(api);
    await c.toggleSave(1);
    expect(notify.error).toHaveBeenCalledWith('Not allowed.');
  });

  it('does not offer the buttons when solutions are not out yet', () => {
    const { f } = open({ result: vi.fn(() => of({ ...result(), solutions_available: false })) });
    expect(buttons(f).length).toBe(0);
  });
});

describe('Report dialog', () => {
  it('needs a reason, and words when the reason is "something else"', async () => {
    const { MAT_DIALOG_DATA, MatDialogRef } = await import('@angular/material/dialog');
    const close = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: { number: 4 } }, { provide: MatDialogRef, useValue: { close } }] });
    const f = TestBed.createComponent(ReportDialog);
    f.detectChanges();
    const c = f.componentInstance;
    expect(text(f)).toContain('question 4');
    c.send();
    expect(close).not.toHaveBeenCalled();
    expect(c.error()).toContain('Choose what is wrong');
    c.reason.set('other');
    c.send();
    expect(c.error()).toContain('few words');
    c.message.set('The picture is missing');
    c.send();
    expect(close).toHaveBeenCalledWith({ reason: 'other', message: 'The picture is missing', image: null });
  });

  describe('picture', () => {
    const png = (size = 100, type = 'image/png') => new File([new Uint8Array(size)], 'shot', { type });

    async function dialog() {
      const { MAT_DIALOG_DATA, MatDialogRef } = await import('@angular/material/dialog');
      const close = vi.fn();
      TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: { number: 4 } }, { provide: MatDialogRef, useValue: { close } }] });
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:shot');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
      const f = TestBed.createComponent(ReportDialog);
      f.detectChanges();
      return { f, c: f.componentInstance, close };
    }
    const paste = (files: File[]) => {
      const ev = new Event('paste', { cancelable: true }) as ClipboardEvent;
      Object.defineProperty(ev, 'clipboardData', { value: { files } });
      document.dispatchEvent(ev);
      return ev;
    };
    const choose = (input: { files: File[]; value: string }) => ({ target: input }) as unknown as Event;

    it('only offers real picture types in the file chooser', async () => {
      const { f } = await dialog();
      expect((f.nativeElement.querySelector('input[type="file"]') as HTMLInputElement).getAttribute('accept')).toBe('image/jpeg,image/png,image/webp,image/gif');
      expect(text(f)).toContain('paste a screenshot with Ctrl+V');
    });

    it('a chosen picture is previewed and sent with the report', async () => {
      const { f, c, close } = await dialog();
      const file = png();
      const input = { files: [file], value: 'C:\\fakepath\\shot.png' };
      c.pick(choose(input));
      f.detectChanges();
      expect(input.value).toBe('');
      expect((f.nativeElement.querySelector('.picture img') as HTMLImageElement).getAttribute('src')).toBe('blob:shot');
      c.reason.set('typo');
      c.send();
      expect(close).toHaveBeenCalledWith({ reason: 'typo', message: '', image: file });
    });

    it('a pasted screenshot is taken, and text or other files are left alone', async () => {
      const { c } = await dialog();
      const ev = paste([png()]);
      expect(ev.defaultPrevented).toBe(true);
      expect(c.image()).not.toBeNull();
      c.remove();
      expect(paste([png(10, 'text/plain')]).defaultPrevented).toBe(false);
      expect(paste([]).defaultPrevented).toBe(false);
      expect(c.image()).toBeNull();
    });

    it('refuses a wrong type or a picture over 2 MB', async () => {
      const { c } = await dialog();
      c.pick(choose({ files: [png(10, 'image/bmp')], value: 'x' }));
      expect(c.error()).toBe('Use a JPG, PNG, WebP or GIF picture.');
      c.pick(choose({ files: [png(2 * 1024 * 1024 + 1)], value: 'x' }));
      expect(c.error()).toBe('The picture must be 2 MB or smaller.');
      expect(c.image()).toBeNull();
    });

    it('can remove the picture again, and stops listening for pastes when closed', async () => {
      const { f, c } = await dialog();
      c.pick(choose({ files: [png()], value: 'x' }));
      c.remove();
      f.detectChanges();
      expect(c.image()).toBeNull();
      expect(f.nativeElement.querySelector('.picture img')).toBeNull();
      f.destroy();
      paste([png()]);
      expect(c.image()).toBeNull();
    });
  });
});
