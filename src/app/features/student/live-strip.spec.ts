import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LiveStrip } from './live-strip';
import { StudentExam } from './student.models';
import { StudentService } from './student.service';

const at = (ms: number) => new Date(Date.now() + ms).toISOString();

const live = (over: Partial<StudentExam> = {}): StudentExam =>
  ({
    id: 'l1', title: 'Live Mock 1', category_name: 'SSC', duration_minutes: 60, is_live: true, status: 'available', start_at: at(-60_000),
    join_closes_at: at(10 * 60_000), ...over,
  }) as StudentExam;

function render(list: StudentExam[], inputs: Record<string, unknown> = {}) {
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StudentService, useValue: { exams: vi.fn(() => of(list)) } }] });
  const f = TestBed.createComponent(LiveStrip);
  for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
  f.detectChanges();
  return f;
}

describe('LiveStrip', () => {
  it('shows each live test as a Bootstrap card with a join button, and no Material component', () => {
    const el = render([live()]).nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    const card = el.querySelector('.card.live-card')!;
    expect(card.textContent).toContain('Live Mock 1');
    expect(card.textContent).toContain('SSC');
    expect(card.textContent).toContain('Live now');
    const join = card.querySelector('a.btn.btn-primary') as HTMLAnchorElement;
    expect(join.textContent).toContain('Join now');
    expect(join.getAttribute('href')).toBe('/student/tests/l1');
    expect(el.querySelector('mat-card, [mat-flat-button]')).toBeNull();
  });

  it('has a heading with a pulsing dot, unless it sits in a tab', () => {
    expect(render([live()]).nativeElement.querySelector('h2 .dot')).not.toBeNull();
    TestBed.resetTestingModule();
    expect(render([live()], { inTab: true }).nativeElement.querySelector('h2')).toBeNull();
  });

  it('shows nothing when there is no live test, or says so in a tab', () => {
    expect(render([]).nativeElement.textContent.trim()).toBe('');
    TestBed.resetTestingModule();
    expect(render([], { inTab: true }).nativeElement.textContent).toContain('No live tests right now');
  });

  it('words the state and the action of a test that has not started, one in progress and one that is done', () => {
    const c = render([]).componentInstance;
    const soon = live({ start_at: at(90_000), join_closes_at: at(20 * 60_000) });
    expect(c.phase(soon)).toBe('upcoming');
    expect(c.when(soon)).toContain('Starts in');
    expect(c.action(soon)).toBe('Open');
    expect(c.when(live({ status: 'in_progress' }))).toBe('You are in this test');
    expect(c.action(live({ status: 'in_progress' }))).toBe('Resume');
    expect(c.when(live({ status: 'completed' }))).toBe('Done');
    expect(c.action(live({ status: 'completed' }))).toBe('Details');
    const closed = live({ join_closes_at: at(-1000) });
    expect(c.phase(closed)).toBe('closed');
    expect(c.when(closed)).toBe('Joining closed');
  });

  it('uses the list it is given instead of asking the server', () => {
    const f = render([], { list: [live({ title: 'Given test' })] });
    expect(f.nativeElement.textContent).toContain('Given test');
  });
});
