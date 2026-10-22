import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NotifyService } from '../../core/notify.service';
import { LanguageService } from '../../shared/language';
import { StudentExam } from './student.models';
import { StudentService } from './student.service';
import { TestInstructions } from './test-instructions';

function exam(languages: ('en' | 'hi')[]): StudentExam {
  return {
    id: 'ex1', title: 'Mock', description: '', category: null, category_name: null, test_type: 'full_test', test_type_label: 'Full test',
    subject: null, subject_name: null, year: null, thumbnail_url: null, question_count: 2, total_marks: '2.00', duration_minutes: 10,
    start_at: null, end_at: null, max_attempts: 0, attempts_used: 0, negative_marking_enabled: false, sectional_timing: false,
    status: 'available', can_start: true, reason: '', active_attempt_id: null, instructions: '', languages,
  } as unknown as StudentExam;
}

describe('TestInstructions language choice', () => {
  let api: { exam: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn> };

  async function open(languages: ('en' | 'hi')[]) {
    localStorage.clear();
    api = { exam: vi.fn(() => of(exam(languages))), start: vi.fn(() => of({ attempt_id: 'a1', created: true })) };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: StudentService, useValue: api }, { provide: NotifyService, useValue: { error: vi.fn() } }],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(TestInstructions);
    fixture.componentRef.setInput('id', 'ex1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLInputElement>('mat-checkbox input')!.click();
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el };
  }

  const startButton = (el: HTMLElement) => [...el.querySelectorAll('button')].find((b) => b.textContent!.includes('Start test'))!;

  it('has no language selected by default and refuses to start until one is chosen', async () => {
    const { fixture, c, el } = await open(['en', 'hi']);
    expect(el.querySelector('mat-select')).not.toBeNull();
    expect(c.chosen()).toBeNull();
    startButton(el).click();
    fixture.detectChanges();
    expect(api.start).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('Select a language');
  });

  it('starts with the chosen language and remembers it', async () => {
    const { fixture, c, el } = await open(['en', 'hi']);
    c.choose('hi');
    fixture.detectChanges();
    startButton(el).click();
    expect(api.start).toHaveBeenCalledWith('ex1');
    expect(TestBed.inject(LanguageService).lang()).toBe('hi');
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('asks nothing when the test has only one language', async () => {
    const { el } = await open(['hi']);
    expect(el.querySelector('mat-select')).toBeNull();
    startButton(el).click();
    expect(api.start).toHaveBeenCalled();
    expect(TestBed.inject(LanguageService).lang()).toBe('hi');
  });
});
