import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StudentExam } from './student.models';
import { TestCard } from './test-card';

function exam(over: Partial<StudentExam> = {}): StudentExam {
  return {
    id: 'ex1', title: 'SuperTET 1', description: '', category: null, category_name: 'SuperTET', test_type: 'full_test', test_type_label: 'Full test',
    subject: null, subject_name: null, year: null, thumbnail_url: null, question_count: 120, total_marks: '360.00', duration_minutes: 120,
    start_at: null, end_at: null, max_attempts: 0, attempts_used: 0, negative_marking_enabled: true, sectional_timing: false,
    status: 'available', can_start: true, reason: '', active_attempt_id: null, ...over,
  };
}

function render(e: StudentExam) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const f = TestBed.createComponent(TestCard);
  f.componentRef.setInput('exam', e);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('TestCard result link', () => {
  it('links to the result of the last attempt once the student has taken the test', () => {
    const el = render(exam({ attempts_used: 1, last_attempt_id: 'att9', result_available: true }));
    const link = el.querySelector('a.view-result') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.textContent).toContain('View result');
    expect(link.getAttribute('href')).toBe('/student/results/att9');
    expect(el.textContent).toContain('Attempt again'); // the main action stays
  });

  it('says the result is not released yet when the instructor has not released it', () => {
    const el = render(exam({ attempts_used: 1, last_attempt_id: 'att9', result_available: false }));
    expect(el.querySelector('a.view-result')).toBeNull();
    expect(el.textContent).toContain('Result not released yet');
  });

  it('has no result link for a test the student has not taken', () => {
    const el = render(exam());
    expect(el.querySelector('a.view-result')).toBeNull();
    expect(el.textContent).not.toContain('Result not released');
  });

  it('keeps the result link next to Resume when a retake is in progress', () => {
    const el = render(exam({ status: 'in_progress', attempts_used: 1, last_attempt_id: 'att9', result_available: true, active_attempt_id: 'att10' }));
    expect(el.textContent).toContain('Resume');
    expect((el.querySelector('a.view-result') as HTMLAnchorElement).getAttribute('href')).toBe('/student/results/att9');
  });
});
