import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { PrepHub } from './prep-hub';
import { PrepHubData, StudentExam } from './student.models';
import { StudentService } from './student.service';

function test(id: string, title: string, over: Partial<StudentExam> = {}): StudentExam {
  return {
    id, title, description: '', category: 'ssc', category_name: 'SSC', test_type: 'full_test', test_type_label: 'Full test',
    subject: null, subject_name: null, year: null, thumbnail_url: null, question_count: 5, total_marks: '10.00', duration_minutes: 10,
    start_at: null, end_at: null, max_attempts: 0, attempts_used: 0, negative_marking_enabled: true, sectional_timing: false, status: 'available',
    can_start: true, reason: '', active_attempt_id: null, ...over,
  };
}

const hub: PrepHubData = {
  exam: { id: 'ssc', name: 'SSC', description: 'Staff Selection Commission', subjects: [{ id: 1, name: 'Maths' }, { id: 2, name: 'GK' }, { id: 3, name: 'Reasoning' }, { id: 4, name: 'English' }] },
  preparing: true,
  full_tests: [test('f1', 'Full Test 1'), test('f2', 'Full Test 2')],
  subject_tests: [
    { subject: 1, subject_name: 'Maths', tests: [test('m1', 'Maths only 1', { test_type: 'sectional', subject: 1, subject_name: 'Maths' })] },
    { subject: 2, subject_name: 'GK', tests: [] },
    { subject: 3, subject_name: 'Reasoning', tests: [test('r1', 'Reasoning only 1', { test_type: 'sectional', subject: 3, subject_name: 'Reasoning' })] },
    { subject: 4, subject_name: 'English', tests: [] },
  ],
  previous_year: [test('p1', 'CGL 2023', { test_type: 'previous_year', year: 2023 })],
  progress: { total: 5, attempted: 1 },
};

describe('PrepHub subject tabs', () => {
  let root: HTMLElement;
  let fixture: ReturnType<typeof TestBed.createComponent<PrepHub>>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StudentService, useValue: { hub: vi.fn(() => of(hub)) } }] });
    fixture = TestBed.createComponent(PrepHub);
    fixture.componentRef.setInput('id', 'ssc');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    root = fixture.nativeElement;
  });

  const tabs = () => [...root.querySelectorAll<HTMLElement>('[role="tab"]')];
  const label = (t: HTMLElement) => t.textContent!.replace(/\s+/g, ' ').trim();

  async function open(name: string) {
    tabs().find((t) => label(t).startsWith(name))!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('shows Full tests, then one tab per subject, then Previous year papers', () => {
    expect(tabs().map(label)).toEqual([
      'Full tests (2)', 'Maths (1)', 'GK Upcoming', 'Reasoning (1)', 'English Upcoming', 'Previous year papers (1)',
    ]);
  });

  it('a subject tab lists that subject\'s tests', async () => {
    await open('Maths');
    expect(root.textContent).toContain('Maths only 1');
    expect(root.textContent).not.toContain('Reasoning only 1');
    await open('Reasoning');
    expect(root.textContent).toContain('Reasoning only 1');
  });

  it('an upcoming subject explains that its tests are coming soon', async () => {
    await open('GK');
    expect(root.textContent).toContain('GK tests for SSC are coming soon.');
    expect(root.querySelectorAll('app-test-card').length).toBe(0);
  });

  it('the first tab still holds the full tests', () => {
    expect(root.textContent).toContain('Full Test 1');
    expect(root.textContent).toContain('Full Test 2');
  });
});
