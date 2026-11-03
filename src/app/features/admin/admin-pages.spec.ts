import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { NotifyService } from '../../core/notify.service';
import { PlatformService } from '../../core/platform.service';
import { ActivityLogPage } from './activity-log';
import { AdminDashboard } from './dashboard';
import { PlatformSettings } from './platform-settings';
import { ReportsService } from './students/reports.service';

const MATERIAL = 'mat-card, mat-icon, mat-progress-bar, mat-table, mat-paginator, mat-form-field, mat-slide-toggle, [mat-flat-button]';
const API = environment.apiUrl;

describe('Admin dashboard (Bootstrap)', () => {
  it('shows the numbers as cards and the recent activity in a Bootstrap table', () => {
    const data = {
      students: { total: 40, active: 30, new_last_30_days: 5 }, questions: { total: 500, active: 480 },
      tests: { total: 12, published: 9, draft: 3 }, attempts: { submitted: 100, in_progress: 2 },
      average_percentage: 61.5, pass_rate: 70, participation: [{ date: '2026-10-01', attempts: 3 }], score_distribution: [{ range: '0-20', count: 4 }],
      subjects: [{ subject: 'GK', accuracy: 60 }], top_tests: [{ id: 1, title: 'Mock 1', attempts: 20 }],
      recent_activity: [{ attempt: 'a1', student: 'Asha', exam: 'Mock 1', score: '40', total_marks: '100', percentage: 40, passed: false, submitted_at: '2026-10-02T10:00:00Z' }],
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ReportsService, useValue: { dashboard: () => of(data) } }, { provide: NotifyService, useValue: { error: vi.fn() } }],
    });
    const f = TestBed.createComponent(AdminDashboard);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelectorAll('.stat').length).toBe(6);
    expect(el.querySelector('.stat')!.textContent).toContain('40');
    expect(el.querySelector('table.table tbody tr')!.textContent).toContain('Asha');
    expect(el.querySelector('td.fail')!.textContent).toContain('Not passed');
    expect(el.querySelector('a[href="/admin/tests/1/results"]')).not.toBeNull();
    expect(el.querySelector(MATERIAL)).toBeNull();
  });
});

describe('Activity log (Bootstrap)', () => {
  it('lists the log in a Bootstrap table and pages with the pager', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: NotifyService, useValue: { error: vi.fn() } }] });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(ActivityLogPage);
    f.detectChanges();
    http.expectOne((r) => r.url === `${API}/activity-logs/` && r.params.get('page') === '1').flush({
      count: 45, results: [{ id: 1, actor_name: 'Dan', action: 'exam.publish', target_type: 'exam', target_id: '7', detail: 'Mock 1', created_at: '2026-10-02T10:00:00Z' }],
    });
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('table.table tbody tr')!.textContent).toContain('exam.publish');
    expect(el.querySelector('app-bs-pager .range')!.textContent).toContain('1–20 of 45');
    el.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!.click();
    http.expectOne((r) => r.url === `${API}/activity-logs/` && r.params.get('page') === '2').flush({ count: 45, results: [] });
    expect(el.querySelector(MATERIAL)).toBeNull();
  });
});

describe('Platform settings (Bootstrap)', () => {
  function open() {
    const save = vi.fn(() => of({}));
    const notify = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PlatformService, useValue: { info: () => ({ platform_name: 'TestPrep', support_email: 'help@x.com', support_phone: '', support_hours: '', allow_registration: true }), refresh: vi.fn(), save } },
        { provide: NotifyService, useValue: notify },
      ],
    });
    const f = TestBed.createComponent(PlatformSettings);
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement, save, notify };
  }

  it('shows the current settings in Bootstrap fields with a switch', () => {
    const { el } = open();
    expect(el.classList.contains('bs')).toBe(true);
    expect((el.querySelector('#ps-name') as HTMLInputElement).value).toBe('TestPrep');
    expect((el.querySelector('#ps-email') as HTMLInputElement).value).toBe('help@x.com');
    expect((el.querySelector('#ps-registration') as HTMLInputElement).checked).toBe(true);
    expect(el.querySelector('.form-switch')).not.toBeNull();
    expect(el.querySelector(MATERIAL)).toBeNull();
  });

  it('saves the settings and says so', () => {
    const { el, save, notify } = open();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    expect(save).toHaveBeenCalledWith({ platform_name: 'TestPrep', support_email: 'help@x.com', support_phone: '', support_hours: '', allow_registration: true });
    expect(notify.success).toHaveBeenCalledWith('Settings saved');
  });

  it('does not save without a name, and shows why', () => {
    const { f, el, save } = open();
    const name = el.querySelector('#ps-name') as HTMLInputElement;
    name.value = '';
    name.dispatchEvent(new Event('input'));
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    f.detectChanges();
    expect(save).not.toHaveBeenCalled();
    expect(el.querySelector('.invalid-feedback')!.textContent).toContain('platform name is required');
  });
});
