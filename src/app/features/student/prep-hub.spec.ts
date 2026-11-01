import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
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
  mini_mocks: [test('n1', 'Mini Mock 1', { test_type: 'mini_mock' })],
  subject_tests: [
    { subject: 1, subject_name: 'Maths', tests: [test('m1', 'Maths only 1', { test_type: 'sectional', subject: 1, subject_name: 'Maths' })] },
    { subject: 2, subject_name: 'GK', tests: [] },
    { subject: 3, subject_name: 'Reasoning', tests: [test('r1', 'Reasoning only 1', { test_type: 'sectional', subject: 3, subject_name: 'Reasoning' })] },
    { subject: 4, subject_name: 'English', tests: [] },
  ],
  previous_year: [test('p1', 'CGL 2023', { test_type: 'previous_year', year: 2023 }), test('p2', 'CGL 2022', { test_type: 'previous_year', year: 2022 })],
  progress: { total: 6, attempted: 1 },
};

async function mount(data: PrepHubData, inputs: Record<string, unknown> = {}, type: string | null = null) {
  const navigate = vi.fn(() => Promise.resolve(true));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: StudentService, useValue: { hub: vi.fn(() => of(data)), exams: vi.fn(() => of([])) } },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(type ? { type } : {}) } } },
    ],
  });
  vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate);
  const fixture = TestBed.createComponent(PrepHub);
  fixture.componentRef.setInput('id', 'ssc');
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, root: fixture.nativeElement as HTMLElement, navigate };
}

const tabs = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[role="tab"]')];
const label = (t: HTMLElement) => t.textContent!.replace(/\s+/g, ' ').trim();

describe('PrepHub tabs', () => {
  async function open(root: HTMLElement, fixture: { detectChanges(): void; whenStable(): Promise<unknown> }, name: string) {
    tabs(root).find((t) => label(t).startsWith(name))!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('has four tabs: Full tests, Mini mocks, Previous year and Subject wise, each with its count', async () => {
    const { root } = await mount(hub);
    expect(tabs(root).map(label)).toEqual(['Full tests (2)', 'Mini mocks (1)', 'Previous year (2)', 'Subject wise (2)']);
  });

  it('opens on the full tests', async () => {
    const { root } = await mount(hub);
    expect(root.textContent).toContain('Full Test 1');
    expect(root.textContent).toContain('Full Test 2');
    expect(root.textContent).not.toContain('Mini Mock 1');
  });

  it('opens on the first tab that has tests when there are no full tests', async () => {
    const { root } = await mount({ ...hub, full_tests: [] });
    expect(tabs(root).find((t) => t.getAttribute('aria-selected') === 'true')!.textContent).toContain('Mini mocks');
    expect(root.textContent).toContain('Mini Mock 1');
  });

  it('the Mini mocks tab lists the mini mocks', async () => {
    const { root, fixture } = await mount(hub);
    await open(root, fixture, 'Mini mocks');
    expect(root.textContent).toContain('Mini Mock 1');
  });

  it('says so when there are no mini mocks yet', async () => {
    const { root, fixture } = await mount({ ...hub, mini_mocks: [] });
    await open(root, fixture, 'Mini mocks');
    expect(root.textContent).toContain('No mini mocks yet.');
  });

  it('Previous year groups the papers under their year', async () => {
    const { root, fixture } = await mount(hub);
    await open(root, fixture, 'Previous year');
    const heads = [...root.querySelectorAll('.tab > h3')].map((h) => h.textContent!.trim());
    expect(heads).toEqual(['2023', '2022']);
    expect(root.textContent).toContain('CGL 2023');
  });

  it('Subject wise shows every subject under its own heading, with the tests of that subject', async () => {
    const { root, fixture } = await mount(hub);
    await open(root, fixture, 'Subject wise');
    const heads = [...root.querySelectorAll('.tab > h3')].map((h) => h.textContent!.replace(/\s+/g, ' ').trim());
    expect(heads).toEqual(['Maths (1)', 'GK Upcoming', 'Reasoning (1)', 'English Upcoming']);
    expect(root.textContent).toContain('Maths only 1');
    expect(root.textContent).toContain('Reasoning only 1');
  });

  it('a subject without tests explains that they are coming soon', async () => {
    const { root, fixture } = await mount(hub);
    await open(root, fixture, 'Subject wise');
    expect(root.textContent).toContain('GK tests for SSC are coming soon.');
  });

  it('opens the tab named in the address', async () => {
    const { root } = await mount(hub, {}, 'previous');
    expect(tabs(root).find((t) => t.getAttribute('aria-selected') === 'true')!.textContent).toContain('Previous year');
  });

  it('puts the chosen tab in the address, keeping the rest of it', async () => {
    const { root, fixture, navigate } = await mount(hub);
    await open(root, fixture, 'Subject wise');
    expect(navigate).toHaveBeenCalledWith([], { queryParams: { type: 'subject' }, queryParamsHandling: 'merge', replaceUrl: true });
  });

  it('says so when an exam has no subject tests at all', async () => {
    const { root, fixture } = await mount({ ...hub, subject_tests: [] });
    await open(root, fixture, 'Subject wise');
    expect(root.textContent).toContain('No subject tests yet.');
  });
});

describe('PrepHub family and embedding', () => {
  const withGroup = (group: { id: string; name: string } | null): PrepHubData => ({ ...hub, exam: { ...hub.exam, name: 'SSC CGL', group } });

  it('on its own it shows the family above the exam name and a back link', async () => {
    const { root } = await mount(withGroup({ id: 'g1', name: 'SSC Exams' }));
    expect(root.querySelector('.family')?.textContent).toContain('SSC Exams');
    expect(root.querySelector('h1')?.textContent).toContain('SSC CGL');
    expect(root.querySelector('a[href="/student/prepare"]')).not.toBeNull();
  });

  it('the back link can point somewhere else', async () => {
    const { root } = await mount(hub, { back: '/student/tests' });
    expect(root.querySelector('a[href="/student/tests"]')).not.toBeNull();
  });

  it('shows nothing extra for an exam without a family', async () => {
    const { root } = await mount(withGroup(null));
    expect(root.querySelector('.family')).toBeNull();
  });

  it('inside the exam tabs of a family it drops the title and back link but keeps the tabs', async () => {
    const { root } = await mount(withGroup({ id: 'g1', name: 'SSC Exams' }), { embedded: true });
    expect(root.querySelector('h1')).toBeNull();
    expect(root.querySelector('a[href="/student/prepare"]')).toBeNull();
    expect(tabs(root).length).toBe(4);
    expect(root.textContent).toContain('Staff Selection Commission');
  });
});

describe('PrepHub tabs set by the admin', () => {
  const set = (tabs: PrepHubData['tabs']): PrepHubData => ({ ...hub, tabs });
  const all = (over: Record<string, Partial<{ label: string; visible: boolean }>> = {}) =>
    (['full', 'mini', 'previous', 'subject'] as const).map((key) => ({ key, label: { full: 'Full tests', mini: 'Mini mocks', previous: 'Previous year', subject: 'Subject wise' }[key], visible: true, ...over[key] }));

  it('shows the four standard tabs when the server sends no tab settings', async () => {
    const { root } = await mount(hub);
    expect(tabs(root).map(label)).toEqual(['Full tests (2)', 'Mini mocks (1)', 'Previous year (2)', 'Subject wise (2)']);
  });

  it('leaves out a tab the admin hid', async () => {
    const { root } = await mount(set(all({ mini: { visible: false } })));
    expect(tabs(root).map(label)).toEqual(['Full tests (2)', 'Previous year (2)', 'Subject wise (2)']);
  });

  it('uses the admin\'s names and order, with the right tests under each', async () => {
    const reordered = [all({ subject: { label: 'By subject' }, full: { label: 'Mocks' } })[3], ...all({ full: { label: 'Mocks' } }).slice(0, 3)];
    const { root, fixture } = await mount(set(reordered), {}, 'subject');
    expect(tabs(root).map(label)).toEqual(['By subject (2)', 'Mocks (2)', 'Mini mocks (1)', 'Previous year (2)']);
    expect(root.textContent).toContain('Maths only 1');
    tabs(root)[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.textContent).toContain('Full Test 1');
  });

  it('puts the tab key, not its position, in the address', async () => {
    const { root, fixture, navigate } = await mount(set(all({ full: { visible: false } })));
    tabs(root)[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { type: 'previous' } }));
  });

  it('opens the tab named in the address, and the first with tests when that tab is hidden', async () => {
    const { root } = await mount(set(all({ mini: { visible: false } })), {}, 'mini');
    expect(label(tabs(root).find((t) => t.getAttribute('aria-selected') === 'true')!)).toBe('Full tests (2)');
  });
});

describe('PrepHub tabs the admin added', () => {
  const std = [
    { key: 'full', label: 'Full tests', visible: true }, { key: 'mini', label: 'Mini mocks', visible: true },
    { key: 'previous', label: 'Previous year', visible: true }, { key: 'subject', label: 'Subject wise', visible: true },
  ];
  const withCustom = (): PrepHubData => ({
    ...hub,
    tabs: [{ key: 'cabc12', label: 'Current affairs', visible: true, custom: true }, ...std],
    custom_tests: { cabc12: [test('c1', 'Weekly CA 1'), test('c2', 'Weekly CA 2')] },
  });

  it('shows the new tab with its own count, in the admin\'s order', async () => {
    const { root } = await mount(withCustom());
    expect(tabs(root).map(label)).toEqual(['Current affairs (2)', 'Full tests (2)', 'Mini mocks (1)', 'Previous year (2)', 'Subject wise (2)']);
  });

  it('lists the tests of the new tab', async () => {
    const { root } = await mount(withCustom());
    expect(root.textContent).toContain('Weekly CA 1');
    expect(root.textContent).toContain('Weekly CA 2');
  });

  it('says so when the new tab has no tests yet', async () => {
    const { root } = await mount({ ...withCustom(), custom_tests: { cabc12: [] } }, {}, 'cabc12');
    expect(label(tabs(root)[0])).toBe('Current affairs (0)');
    expect(root.textContent).toContain('No tests in Current affairs yet.');
  });

  it('can be hidden like any other tab', async () => {
    const hidden = { ...withCustom(), tabs: withCustom().tabs!.map((t) => (t.key === 'cabc12' ? { ...t, visible: false } : t)) };
    const { root } = await mount(hidden);
    expect(tabs(root).map(label)).toEqual(['Full tests (2)', 'Mini mocks (1)', 'Previous year (2)', 'Subject wise (2)']);
  });

  it('opens the new tab from the address by its key', async () => {
    const { root } = await mount(withCustom(), {}, 'cabc12');
    expect(label(tabs(root).find((t) => t.getAttribute('aria-selected') === 'true')!)).toBe('Current affairs (2)');
  });
});

describe('PrepHub live tab', () => {
  const liveOne = (id: string) => test(id, 'Live ' + id, { is_live: true, start_at: '2026-12-01T10:00:00Z' } as Partial<StudentExam>);

  async function mountLive(live: StudentExam[], type: string | null = null) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: StudentService, useValue: { hub: vi.fn(() => of(hub)), exams: vi.fn(() => of(live)) } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(type ? { type } : {}) } } },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(() => Promise.resolve(true));
    const fixture = TestBed.createComponent(PrepHub);
    fixture.componentRef.setInput('id', 'ssc');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('adds a Live tests tab after the others when the exam has live tests, instead of a strip above them', async () => {
    const root = await mountLive([liveOne('a'), liveOne('b')]);
    expect(tabs(root).map(label)).toEqual(['Full tests (2)', 'Mini mocks (1)', 'Previous year (2)', 'Subject wise (2)', 'Live tests (2)']);
    expect(root.querySelector('app-live-strip section h2')).toBeNull(); // no heading and no strip pushing the tabs down
  });

  it('has no Live tab when there is none', async () => {
    const root = await mountLive([]);
    expect(tabs(root).map(label)).toEqual(['Full tests (2)', 'Mini mocks (1)', 'Previous year (2)', 'Subject wise (2)']);
  });

  it('opens the Live tab from the address', async () => {
    const root = await mountLive([liveOne('a')], 'live');
    expect(label(tabs(root).find((t) => t.getAttribute('aria-selected') === 'true')!)).toBe('Live tests (1)');
  });
});
