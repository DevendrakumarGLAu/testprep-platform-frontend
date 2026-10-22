import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StudentExam } from './student.models';
import { TestCard } from './test-card';

function exam(over: Partial<StudentExam>): StudentExam {
  return {
    id: 'ex1', title: 'Some test', description: '', category: 'cat1', category_name: 'SSC', test_type: 'full_test', test_type_label: 'Full test',
    subject: null, subject_name: null, year: null, thumbnail_url: null, question_count: 10, total_marks: '20.00', duration_minutes: 30,
    start_at: null, end_at: null, max_attempts: 0, attempts_used: 0, negative_marking_enabled: true, sectional_timing: false, status: 'available',
    can_start: true, reason: '', active_attempt_id: null, ...over,
  };
}

function render(e: StudentExam): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(TestCard);
  fixture.componentRef.setInput('exam', e);
  fixture.detectChanges();
  return fixture.nativeElement;
}

describe('TestCard', () => {
  it('labels a full test with its exam', () => {
    expect(render(exam({})).textContent).toContain('SSC · Full test');
  });

  it('labels a subject test with the subject', () => {
    const el = render(exam({ test_type: 'sectional', test_type_label: 'Subject test', subject: 2, subject_name: 'Maths' }));
    expect(el.textContent).toContain('SSC · Maths only');
  });

  it('labels a previous year paper with its year', () => {
    const el = render(exam({ test_type: 'previous_year', test_type_label: 'Previous year paper', year: 2023 }));
    expect(el.textContent).toContain('SSC · Previous year 2023');
  });

  it('shows unlimited retakes and offers to attempt again after a first attempt', () => {
    const el = render(exam({ attempts_used: 2 }));
    expect(el.textContent).toContain('2 / unlimited');
    expect(el.textContent).toContain('Attempt again');
  });

  it('offers Resume for an attempt in progress', () => {
    expect(render(exam({ status: 'in_progress', active_attempt_id: 'att7' })).textContent).toContain('Resume');
  });

  it('does not offer to start a test that has not opened yet', () => {
    const el = render(exam({ status: 'upcoming', can_start: false, reason: 'This test has not started yet.' }));
    expect(el.textContent).toContain('This test has not started yet.');
    expect(el.querySelector('a.mat-mdc-unelevated-button')).toBeNull(); // no primary Start / Resume button
    expect(el.textContent).toContain('Details');
  });
});
