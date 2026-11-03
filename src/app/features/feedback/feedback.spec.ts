import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifyService } from '../../core/notify.service';
import { FeedbackInbox } from '../admin/feedback/feedback-inbox';
import { FeedbackButton } from './feedback-button';
import { FeedbackRow, FeedbackService } from './feedback.service';

const MATERIAL = 'mat-icon, mat-dialog-content, [mat-button], [mat-flat-button]';
const row = (id: number, over: Partial<FeedbackRow> = {}): FeedbackRow => ({
  id, kind: 'bug', kind_label: 'Something is broken', message: `Note ${id}`, page: '/student/tests', device: 'Chrome', status: 'new',
  created_at: '2026-11-03T10:00:00Z', from_name: 'Asha Verma', from_email: 'asha@example.com', from_role: 'student', ...over,
});
const button = (el: HTMLElement, label: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === label)!;

describe('FeedbackButton', () => {
  function render(send = vi.fn(() => of({ detail: 'Thank you. Your note reached us.' }))) {
    const notify = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: FeedbackService, useValue: { send } }, { provide: NotifyService, useValue: notify }],
    });
    vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/student/plan');
    const f = TestBed.createComponent(FeedbackButton);
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement, send, notify };
  }

  it('is a Bootstrap button that opens a form', () => {
    const { f, el } = render();
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('app-bs-modal')).toBeNull();
    el.querySelector<HTMLButtonElement>('button.trigger')!.click();
    f.detectChanges();
    expect(el.querySelector('app-bs-modal')!.textContent).toContain('Send us feedback');
    expect(Array.from(el.querySelectorAll('#fb-kind option')).map((o) => o.textContent!.trim())).toEqual(['Something is broken', 'An idea', 'Something else']);
    expect(el.querySelector(MATERIAL)).toBeNull();
  });

  it('asks for a few words before sending anything', async () => {
    const { f, el, send } = render();
    el.querySelector<HTMLButtonElement>('button.trigger')!.click();
    f.detectChanges();
    f.componentInstance.message = 'no';
    button(el, 'Send').click();
    f.detectChanges();
    expect(send).not.toHaveBeenCalled();
    expect(el.querySelector('.alert-danger')!.textContent).toContain('at least a few words');
  });

  it('sends the kind, the message and the page the person was on, then thanks them and closes', () => {
    const { f, el, send, notify } = render();
    el.querySelector<HTMLButtonElement>('button.trigger')!.click();
    f.detectChanges();
    f.componentInstance.kind = 'idea';
    f.componentInstance.message = '  Please add a dark mode  ';
    button(el, 'Send').click();
    f.detectChanges();
    expect(send).toHaveBeenCalledWith({ kind: 'idea', message: 'Please add a dark mode', page: '/student/plan' });
    expect(notify.success).toHaveBeenCalledWith('Thank you. Your note reached us.');
    expect(el.querySelector('app-bs-modal')).toBeNull();
    expect(f.componentInstance.message).toBe('');
  });

  it('keeps the form open and says why when sending fails', () => {
    const { f, el } = render(vi.fn(() => throwError(() => ({ error: { message: ['Keep it under 2000 characters.'] }, status: 400 }))));
    el.querySelector<HTMLButtonElement>('button.trigger')!.click();
    f.detectChanges();
    f.componentInstance.message = 'A long note about something';
    button(el, 'Send').click();
    f.detectChanges();
    expect(el.querySelector('app-bs-modal')).not.toBeNull();
    expect(el.querySelector('.alert-danger')).not.toBeNull();
  });
});

describe('FeedbackInbox (admin)', () => {
  function render(rows: FeedbackRow[]) {
    const inbox = vi.fn(() => of({ results: rows, new_count: rows.filter((r) => r.status === 'new').length }));
    const setStatus = vi.fn((id: number, status: string) => of(row(id, { status } as Partial<FeedbackRow>)));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: FeedbackService, useValue: { inbox, setStatus } }, { provide: NotifyService, useValue: { error: vi.fn() } }],
    });
    const f = TestBed.createComponent(FeedbackInbox);
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement, inbox, setStatus };
  }

  it('lists the new notes with who sent them and where, as Bootstrap cards', () => {
    const { el, inbox } = render([row(1), row(2, { kind: 'idea', kind_label: 'An idea', from_name: 'Ravi' })]);
    expect(inbox).toHaveBeenCalledWith('new');
    expect(el.classList.contains('bs')).toBe(true);
    const cards = el.querySelectorAll('.card.note');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Asha Verma');
    expect(cards[0].textContent).toContain('/student/tests');
    expect(cards[1].querySelector('.kind.idea')).not.toBeNull();
    expect(el.querySelector('.badge')!.textContent).toContain('2');
    expect(el.querySelector(MATERIAL)).toBeNull();
  });

  it('marks a note handled and reloads', () => {
    const { f, el, setStatus, inbox } = render([row(7)]);
    button(el, 'Mark handled').click();
    f.detectChanges();
    expect(setStatus).toHaveBeenCalledWith(7, 'done');
    expect(inbox).toHaveBeenCalledTimes(2);
  });

  it('a handled note can be reopened, and the filter buttons ask for the right list', () => {
    const { f, el, setStatus, inbox } = render([row(8, { status: 'done' })]);
    button(el, 'Reopen').click();
    expect(setStatus).toHaveBeenCalledWith(8, 'new');
    button(el, 'Handled').click();
    f.detectChanges();
    expect(inbox).toHaveBeenLastCalledWith('done');
    button(el, 'All').click();
    expect(inbox).toHaveBeenLastCalledWith('');
  });

  it('says when there is nothing new', () => {
    const { el } = render([]);
    expect(el.textContent).toContain('Nothing new');
  });
});
