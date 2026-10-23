import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { environment } from '../../../../environments/environment';
import { NotifyService } from '../../../core/notify.service';
import { ExamService } from '../exams/exam.service';
import { InsightsPage } from '../insights/insights';
import { BulkValueDialog, DuplicatesDialog } from './bulk-dialogs';
import { DuplicateGroup, Subject } from './qb.models';
import { QuestionBankService } from './qb.service';

const text = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent!.replace(/\s+/g, ' ');

describe('BulkValueDialog', () => {
  const subjects = [{ id: 1, name: 'Maths' }, { id: 2, name: 'GK' }] as unknown as Subject[];

  function open(kind: 'date' | 'subject') {
    TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: { kind, count: 3, subjects } }] });
    const f = TestBed.createComponent(BulkValueDialog);
    f.detectChanges();
    return f;
  }

  it('asks for a date, today by default, and says how many questions it changes', () => {
    const f = open('date');
    expect(text(f)).toContain('Set the question date');
    expect(text(f)).toContain('3 selected questions');
    expect(f.componentInstance.value()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('needs a subject to be chosen before it can be applied', () => {
    const f = open('subject');
    expect(f.componentInstance.value()).toBeNull();
    f.componentInstance.subject.set(2);
    expect(f.componentInstance.value()).toBe(2);
    expect(text(f)).toContain('topics are cleared');
  });
});

describe('DuplicatesDialog', () => {
  const group = (ids: number[]): DuplicateGroup => ({
    text: 'What is the capital of India?',
    questions: ids.map((id) => ({ id, subject: 'GK', question_date: null, review_status: 'approved', created_at: '2026-10-01T00:00:00Z', used_in: id === 2 ? ['Mock A'] : [] })),
  });

  function open(groups: DuplicateGroup[]) {
    const api = {
      duplicates: vi.fn(() => of({ groups })),
      resolveDuplicates: vi.fn(() => of({ archived: 1, still_used_in: ['Mock A'] })),
    };
    const notify = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: QuestionBankService, useValue: api }, { provide: NotifyService, useValue: notify }] });
    const f = TestBed.createComponent(DuplicatesDialog);
    f.detectChanges();
    return { f, c: f.componentInstance, api, notify };
  }

  it('lists each group, defaulting to keeping the oldest copy and showing where copies are used', () => {
    const { f } = open([group([1, 2])]);
    const t = text(f);
    expect(t).toContain('What is the capital of India?');
    expect(t).toContain('Keep #1');
    expect(t).toContain('Keep #2');
    expect(t).toContain('in Mock A');
  });

  it('archives the other copies and reports tests that still use one', () => {
    const { c, api, notify } = open([group([1, 2, 3])]);
    c.choose(c.groups()[0], 2);
    c.resolve(c.groups()[0]);
    expect(api.resolveDuplicates).toHaveBeenCalledWith(2, [1, 3]);
    expect(c.groups()).toEqual([]);
    expect(c.changed()).toBe(true);
    expect(notify.success).toHaveBeenCalledWith('Archived 1. Still used in: Mock A.');
  });

  it('says so when the bank has no duplicates', () => {
    const { f } = open([]);
    expect(text(f)).toContain('No duplicates found');
  });
});

describe('InsightsPage', () => {
  it('shows busiest tests, hardest and most skipped questions, and the drop-off for the busiest test', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: NotifyService, useValue: { error: vi.fn(), success: vi.fn() } },
        { provide: ExamService, useValue: { list: () => of({ results: [{ id: 5, title: 'Mock 1' }] }) } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(InsightsPage);
    f.detectChanges();
    http.expectOne(`${environment.apiUrl}/admin/insights/`).flush({
      attempts: 40, min_answers: 5,
      tests: [{ id: 5, title: 'Mock 1', attempts: 30, average_percent: 61.5 }],
      hardest: [{ question: 9, text: 'Which river?', subject: 'GK', attempts: 20, correct_percent: 12.5, skipped_percent: 5 }],
      most_skipped: [{ question: 11, text: 'Solve x', subject: 'Maths', attempts: 20, correct_percent: 50, skipped_percent: 45 }],
    });
    http.expectOne(`${environment.apiUrl}/exams/5/dropoff/`).flush({
      exam: 'Mock 1', attempts: 30,
      positions: [{ number: 1, answered_percent: 100, correct_percent: 80, average_seconds: 20 }, { number: 2, answered_percent: 40, correct_percent: 50, average_seconds: 5 }],
    });
    f.detectChanges();
    const t = text(f);
    expect(t).toContain('40');
    expect(t).toContain('30 attempts · avg 61.5%');
    expect(t).toContain('12.5% right');
    expect(t).toContain('45% skipped');
    expect(f.nativeElement.querySelectorAll('.col').length).toBe(2);
    expect(f.nativeElement.querySelectorAll('.bar.low').length).toBe(1); // question 2: only 40% answered
    http.verify();
  });
});
