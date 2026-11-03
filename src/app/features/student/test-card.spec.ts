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

describe('TestCard as a Bootstrap card', () => {
  const buttons = (el: HTMLElement) => Array.from(el.querySelectorAll('.actions a, .actions p')).map((n) => n.textContent!.trim());

  it('is a Bootstrap card with no Material component in it', () => {
    const el = render(exam());
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('.card .card-body')).not.toBeNull();
    expect(el.querySelector('.actions a.btn.btn-primary')).not.toBeNull();
    expect(el.querySelector('mat-card, mat-icon, [mat-flat-button], [mat-stroked-button]')).toBeNull();
  });

  it('shows the facts of the test and its status', () => {
    const el = render(exam({ attempts_used: 2, max_attempts: 3 }));
    expect(el.querySelector('h3')!.textContent).toBe('SuperTET 1');
    expect(el.textContent).toContain('120');
    expect(el.textContent).toContain('360.00');
    expect(el.textContent).toContain('2 / 3');
    expect(el.querySelector('.chip')!.textContent).toContain('Available');
    expect(el.querySelector('.chip')!.className).toContain('available');
  });

  it('offers the right main button for each situation', () => {
    expect(buttons(render(exam()))).toEqual(['Start']);
    TestBed.resetTestingModule();
    expect(buttons(render(exam({ status: 'in_progress' })))[0]).toContain('Resume');
    TestBed.resetTestingModule();
    expect(buttons(render(exam({ locked: true } as Partial<StudentExam>)))[0]).toContain('Locked');
    TestBed.resetTestingModule();
    expect(buttons(render(exam({ can_start: false, reason: 'Opens on Monday', status: 'upcoming' })))[0]).toBe('Details');
    TestBed.resetTestingModule();
    expect(render(exam({ can_start: false, reason: 'Opens on Monday' })).textContent).toContain('Opens on Monday');
  });

  it('marks a live test and a premium test', () => {
    const live = render(exam({ is_live: true }));
    expect(live.querySelector('.live')!.textContent).toContain('LIVE TEST');
    expect(live.textContent).toContain('Join live test');
    TestBed.resetTestingModule();
    const premium = render(exam({ premium: true, price: '99' } as Partial<StudentExam>));
    expect(premium.querySelector('.premium')!.textContent).toContain('Premium · ₹99');
  });

  it('names the kind of test: a subject for a sectional test, the year for a previous year paper', () => {
    expect(render(exam({ test_type: 'sectional', subject_name: 'Maths' })).querySelector('.cat')!.textContent).toContain('Maths only');
    TestBed.resetTestingModule();
    expect(render(exam({ test_type: 'previous_year', year: 2022 })).querySelector('.cat')!.textContent).toContain('Previous year 2022');
  });

  it('shows the picture when the test has one', () => {
    expect(render(exam({ thumbnail_url: 'https://cdn.example/a.png' })).querySelector('img.card-img-top')!.getAttribute('src')).toBe('https://cdn.example/a.png');
    TestBed.resetTestingModule();
    expect(render(exam()).querySelector('img')).toBeNull();
  });
});
