import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { NotifyService } from '../../core/notify.service';
import { ExamService } from './exams/exam.service';
import { ReportsService } from './students/reports.service';
import { StudentList } from './students/student-list';
import { StudentProfile } from './students/student-profile';
import { UserDialog } from './users/user-dialog';
import { UserList } from './users/user-list';

const API = environment.apiUrl;
const MATERIAL = 'mat-card, mat-icon, mat-table, mat-paginator, mat-form-field, mat-select, mat-checkbox, mat-progress-bar, [mat-flat-button], [mat-button], [mat-icon-button], [mat-stroked-button]';
const notify = () => ({ provide: NotifyService, useValue: { success: vi.fn(), error: vi.fn() } });

describe('User list (Bootstrap)', () => {
  function open() {
    localStorage.clear();
    localStorage.setItem('tp_access', 'A');
    localStorage.setItem('tp_user', JSON.stringify({ id: 1, username: 'boss', email: 'b@x.com', first_name: 'B', last_name: '', phone: '', role: 'super_admin', is_active: true, date_joined: '' }));
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), notify()] });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(UserList);
    f.detectChanges();
    return { f, http, el: f.nativeElement as HTMLElement };
  }

  const users = {
    count: 2,
    results: [
      { id: 1, username: 'boss', email: 'b@x.com', first_name: 'B', last_name: '', role: 'super_admin', is_active: true },
      { id: 2, username: 'dan', email: 'd@x.com', first_name: 'Dan', last_name: 'Old', role: 'student', is_active: false },
    ],
  };

  it('lists the users in a Bootstrap table, without row actions that would act on yourself', () => {
    const { f, http, el } = open();
    http.expectOne((r) => r.url === `${API}/users/`).flush(users);
    f.detectChanges();
    expect(el.classList.contains('bs')).toBe(true);
    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[1].textContent).toContain('Dan Old');
    expect(rows[1].textContent).toContain('Inactive');
    expect(rows[0].querySelectorAll('button').length).toBe(1); // only Edit for yourself
    expect(rows[1].querySelectorAll('button').length).toBe(3);
    expect(el.querySelector('app-bs-pager .range')!.textContent).toContain('1–2 of 2');
    expect(el.querySelector(MATERIAL)).toBeNull();
  });

  it('filtering by status asks the server and goes back to the first page', () => {
    const { f, http, el } = open();
    http.expectOne((r) => r.url === `${API}/users/`).flush(users);
    f.detectChanges();
    const select = el.querySelector('#ul-status') as HTMLSelectElement;
    select.value = 'false';
    select.dispatchEvent(new Event('change'));
    TestBed.tick();
    const req = http.expectOne((r) => r.url === `${API}/users/` && r.params.get('is_active') === 'false');
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ count: 0, results: [] });
    f.detectChanges();
    expect(el.textContent).toContain('No users match your filters.');
  });
});

describe('User dialog (Bootstrap)', () => {
  function open(user: unknown = null) {
    const close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { user, allowedRoles: ['admin', 'student'] } },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    const f = TestBed.createComponent(UserDialog);
    f.detectChanges();
    return { f, close, el: f.nativeElement as HTMLElement, http: TestBed.inject(HttpTestingController) };
  }

  it('is a Bootstrap form with a role list and no Material component', () => {
    const { el } = open();
    expect(el.classList.contains('bs')).toBe(true);
    expect(Array.from(el.querySelectorAll('#ud-role option')).map((o) => o.textContent!.trim())).toEqual(['Admin', 'Student']);
    expect(el.querySelector('[mat-dialog-title], mat-dialog-content, mat-form-field, mat-select, [mat-flat-button]')).toBeNull();
  });

  it('shows what is missing, then saves a new user and closes', () => {
    const { f, close, el, http } = open();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    f.detectChanges();
    expect(Array.from(el.querySelectorAll('.invalid-feedback')).map((e) => e.textContent!.trim())).toEqual(['Required', 'A valid email is required', 'At least 8 characters']);
    f.componentInstance.form.patchValue({ username: 'neha', email: 'n@x.com', password: 'Strong-pass-1' });
    f.componentInstance.save();
    const req = http.expectOne(`${API}/users/`);
    expect(req.request.method).toBe('POST');
    req.flush({});
    expect(close).toHaveBeenCalledWith(true);
  });

  it('Cancel closes without saving', () => {
    const { close, el } = open();
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Cancel')!.click();
    expect(close).toHaveBeenCalledWith(false);
  });
});

describe('Student list (Bootstrap)', () => {
  const row = (id: number, name: string) => ({ id, name, username: name, email: `${name}@x.com`, phone: '', is_active: true, date_joined: '2026-01-05T10:00:00Z', attempts_count: 3, average_percentage: 55, last_attempt_at: null, batches: [{ id: 1, name: 'Evening' }] });

  function open() {
    const students = vi.fn(() => of({ count: 2, results: [row(1, 'Asha'), row(2, 'Ravi')] }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), notify(),
        { provide: ReportsService, useValue: { students } },
        { provide: ExamService, useValue: { batches: () => of({ results: [{ id: 1, name: 'Evening' }] }) } },
      ],
    });
    const f = TestBed.createComponent(StudentList);
    f.detectChanges();
    return { f, students, el: f.nativeElement as HTMLElement };
  }

  it('lists students with tick boxes and the batch names, with no Material component', () => {
    const { el } = open();
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.querySelector('tbody tr')!.textContent).toContain('Evening');
    expect(el.querySelector(MATERIAL)).toBeNull();
  });

  it('ticking students shows the bulk bar, and the header box ticks the whole page', () => {
    const { f, el } = open();
    expect(el.querySelector('.bulk')).toBeNull();
    el.querySelector<HTMLInputElement>('tbody input[type="checkbox"]')!.click();
    f.detectChanges();
    expect(el.querySelector('.bulk')!.textContent).toContain('1 selected');
    el.querySelector<HTMLInputElement>('thead input[type="checkbox"]')!.click();
    f.detectChanges();
    expect(el.querySelector('.bulk')!.textContent).toContain('2 selected');
    Array.from(el.querySelectorAll('.bulk button')).find((b) => b.textContent!.trim() === 'Clear')!.dispatchEvent(new Event('click'));
    f.detectChanges();
    expect(el.querySelector('.bulk')).toBeNull();
  });

  it('choosing a batch filters by its number', () => {
    const { f, students, el } = open();
    const select = el.querySelector('#sl-batch') as HTMLSelectElement;
    select.value = '1';
    select.dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(f.componentInstance.batch()).toBe(1);
    TestBed.tick();
    expect(students).toHaveBeenLastCalledWith(expect.objectContaining({ batch: 1 }));
  });
});

describe('Student profile (Bootstrap)', () => {
  const profile = {
    id: 5, name: 'Asha Verma', username: 'asha', email: 'a@x.com', phone: '', is_active: true, date_joined: '2026-01-05T10:00:00Z',
    batches: [{ id: 1, name: 'Evening' }],
    assigned_exams: [{ id: 9, title: 'Mock 9', status: 'published', access_type: 'assigned' }],
    performance: { attempts_count: 1, average_percentage: 50, best_percentage: 50, accuracy_percent: 40, pass_rate: 0, trend: [], subjects: [], history: [] },
  };

  function open() {
    const setBatches = vi.fn(() => of({ batches: [{ id: 1, name: 'Evening' }, { id: 2, name: 'Morning' }] }));
    const assignTests = vi.fn(() => of({ assigned_exams: profile.assigned_exams, notes: [] }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), notify(),
        { provide: ReportsService, useValue: { student: () => of(profile), setBatches, assignTests } },
        { provide: ExamService, useValue: {
          batches: () => of({ results: [{ id: 1, name: 'Evening' }, { id: 2, name: 'Morning' }] }),
          list: () => of({ results: [{ id: 9, title: 'Mock 9', status: 'published' }, { id: 10, title: 'Mock 10', status: 'published' }] }),
        } },
      ],
    });
    const f = TestBed.createComponent(StudentProfile);
    f.componentRef.setInput('id', '5');
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement, setBatches, assignTests };
  }

  it('shows the student and Bootstrap cards with no Material component', () => {
    const { el } = open();
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('h1')!.textContent).toContain('Asha Verma');
    expect(el.querySelectorAll('.stat').length).toBe(5);
    expect(el.querySelector(MATERIAL)).toBeNull();
  });

  it('batches are ticked from a list and saved together', () => {
    const { f, el, setBatches } = open();
    const boxes = el.querySelectorAll<HTMLInputElement>('#pb-1, #pb-2');
    expect(boxes[0].checked).toBe(true);
    expect(boxes[1].checked).toBe(false);
    boxes[1].click();
    f.detectChanges();
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Save batches')!.click();
    expect(setBatches).toHaveBeenCalledWith(5, [1, 2]);
  });

  it('offers only tests that are not yet assigned and assigns the ticked ones', () => {
    const { f, el, assignTests } = open();
    expect(el.querySelector('#pa-9')).toBeNull();
    const assign = () => Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Assign')!;
    expect(assign().disabled).toBe(true);
    el.querySelector<HTMLInputElement>('#pa-10')!.click();
    f.detectChanges();
    expect(assign().disabled).toBe(false);
    assign().click();
    expect(assignTests).toHaveBeenCalledWith(5, [10], 'add');
  });
});
