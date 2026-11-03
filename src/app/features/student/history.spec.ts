import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { NotifyService } from '../../core/notify.service';
import { AttemptHistory } from './history';
import { HistoryRow } from './student.models';
import { StudentService } from './student.service';

const row = (over: Partial<HistoryRow> = {}): HistoryRow =>
  ({
    id: 'a1', exam_title: 'CGL Mock 1', attempt_number: 2, started_at: '2026-03-01T10:00:00Z', status: 'submitted', auto_submitted: false,
    result_available: true, score: '120.00', total_marks: '200.00', percentage: 60, passed: true, ...over,
  }) as HistoryRow;

function render(history: unknown) {
  const notify = { error: vi.fn() };
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: StudentService, useValue: { history: () => history } }, { provide: NotifyService, useValue: notify }],
  });
  const f = TestBed.createComponent(AttemptHistory);
  f.detectChanges();
  return { f, el: f.nativeElement as HTMLElement, notify };
}

describe('AttemptHistory', () => {
  it('is a Bootstrap table with no Material component', () => {
    const { el } = render(of([row()]));
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('table.table')).not.toBeNull();
    expect(el.querySelector('mat-table, table[mat-table], mat-progress-bar, [mat-button]')).toBeNull();
  });

  it('shows one row for each attempt, with the score and a link to the result', () => {
    const { el } = render(of([row(), row({ id: 'a2', exam_title: 'CHSL Mock', score: '40.00', percentage: 20, passed: false })]));
    const rows = Array.from(el.querySelectorAll('tbody tr'));
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('CGL Mock 1');
    expect(rows[0].textContent).toContain('#2');
    expect(rows[0].textContent).toContain('120.00 / 200.00 (60%)');
    expect(rows[0].textContent).toContain('Passed');
    expect(rows[1].textContent).toContain('Not passed');
    expect((rows[0].querySelector('a[href="/student/results/a1"]') as HTMLAnchorElement).textContent).toContain('View result');
  });

  it('shows the status of each attempt in words', () => {
    const { el } = render(
      of([row({ id: 'a1' }), row({ id: 'a2', auto_submitted: true }), row({ id: 'a3', status: 'in_progress', result_available: false })]),
    );
    const cells = Array.from(el.querySelectorAll('tbody tr')).map((r) => r.querySelectorAll('td')[2].textContent!.trim());
    expect(cells).toEqual(['Submitted', 'Auto-submitted', 'In progress']);
  });

  it('offers Resume for an attempt that is running and no score yet', () => {
    const { el } = render(of([row({ status: 'in_progress', result_available: false })]));
    expect(el.querySelector('a[href="/student/attempt/a1"]')!.textContent).toContain('Resume');
    expect(el.querySelector('a[href="/student/results/a1"]')).toBeNull();
    expect(el.querySelectorAll('tbody td')[3].textContent).toContain('—');
  });

  it('says the result is not out yet for a submitted attempt without a released result', () => {
    const { el } = render(of([row({ result_available: false })]));
    expect(el.textContent).toContain('Result not released yet');
    expect(el.querySelector('a[href="/student/results/a1"]')).toBeNull();
  });

  it('says so when the student has no attempts', () => {
    expect(render(of([])).el.textContent).toContain('You have not attempted any tests yet.');
  });

  it('tells the student when the list cannot be loaded', () => {
    const { notify } = render(throwError(() => ({ error: { detail: 'Server is busy.' } })));
    expect(notify.error).toHaveBeenCalledWith('Server is busy.');
  });
});
