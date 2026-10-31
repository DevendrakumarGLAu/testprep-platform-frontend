import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NotifyService } from '../../../core/notify.service';
import { QuestionReportRow } from './qb.models';
import { QuestionBankService } from './qb.service';
import { QuestionReports } from './question-reports';

const row = (over: Partial<QuestionReportRow> = {}): QuestionReportRow => ({
  id: 1, question: 12, question_text: 'Which river is the longest?', student_name: 'Dan Old', exam_title: 'Mock 1',
  reason: 'wrong_answer', reason_label: 'The marked answer is wrong', message: 'Option B is right', image_url: null, status: 'open', admin_note: '',
  resolved_at: null, created_at: '2026-10-20T10:00:00Z', ...over,
});

describe('QuestionReports (admin queue)', () => {
  const text = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent!.replace(/\s+/g, ' ');

  async function open(rows: QuestionReportRow[] = [row()]) {
    const api = {
      reports: vi.fn((_q: Record<string, unknown>) => of({ count: rows.length, next: null, previous: null, results: rows })),
      updateReport: vi.fn(() => of(row({ status: 'resolved' }))),
    };
    const notify = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: QuestionBankService, useValue: api }, { provide: NotifyService, useValue: notify }] });
    const f = TestBed.createComponent(QuestionReports);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    return { f, c: f.componentInstance, api, notify };
  }

  it('lists the open reports by default, with what was said and who said it', async () => {
    const { f, api } = await open();
    expect(api.reports.mock.calls[0][0]).toMatchObject({ status: 'open', page: 1 });
    const t = text(f);
    expect(t).toContain('Question #12');
    expect(t).toContain('The marked answer is wrong');
    expect(t).toContain('Option B is right');
    expect(t).toContain('Dan Old in Mock 1');
  });

  it('marks a report fixed with a note for the student, then reloads the queue', async () => {
    const { f, c, api, notify } = await open();
    c.setNote(c.rows()[0], 'Key corrected');
    c.set(c.rows()[0], 'resolved');
    expect(api.updateReport).toHaveBeenCalledWith(1, { status: 'resolved', admin_note: 'Key corrected' });
    expect(notify.success).toHaveBeenCalledWith('Marked as fixed.');
    f.detectChanges();
    await f.whenStable();
    expect(api.reports.mock.calls.length).toBeGreaterThan(1);
  });

  it('offers Reopen on a closed report and not on an open one', async () => {
    const closed = await open([row({ status: 'rejected' })]);
    expect(text(closed.f)).toContain('Reopen');
    expect(text(closed.f)).not.toContain('No change needed Reopen'); // the button for the current state is hidden
    TestBed.resetTestingModule();
    const open1 = await open([row({ status: 'open' })]);
    expect(text(open1.f)).not.toContain('Reopen');
    expect(text(open1.f)).toContain('Mark fixed');
  });

  it('says so when there is nothing to do', async () => {
    const { f } = await open([]);
    expect(text(f)).toContain('Nothing is waiting for you');
  });

  it('shows the picture a student attached and opens it full size when clicked', async () => {
    const { f, c } = await open([row({ image_url: 'https://cdn.example/storage/reports/a.png' })]);
    const img = f.nativeElement.querySelector('img.thumb') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://cdn.example/storage/reports/a.png');
    const zoom = vi.spyOn(c, 'zoom').mockImplementation(() => undefined);
    img.click();
    img.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(zoom).toHaveBeenCalledTimes(2);
  });

  it('a report without a picture shows none', async () => {
    const { f } = await open();
    expect(f.nativeElement.querySelector('img.thumb')).toBeNull();
  });
});
