import { BreakpointObserver } from '@angular/cdk/layout';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Shell } from './shell';

function user(role: string, extra: Record<string, unknown> = {}) {
  localStorage.setItem('tp_access', 'A');
  localStorage.setItem('tp_user', JSON.stringify({ id: 1, username: 'asha', email: 'a@x.com', first_name: 'Asha', last_name: 'Verma', phone: '', role, is_active: true, date_joined: '', ...extra }));
}

function render(phone = false) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: BreakpointObserver, useValue: { observe: () => of({ matches: phone, breakpoints: {} }) } },
    ],
  });
  const f = TestBed.createComponent(Shell);
  f.detectChanges();
  TestBed.inject(HttpTestingController).match(() => true);
  return { f, el: f.nativeElement as HTMLElement };
}

describe('Shell (Bootstrap)', () => {
  beforeEach(() => localStorage.clear());

  it('has a sidebar with the student links and no Material component', () => {
    user('student');
    const { el } = render();
    const links = Array.from(el.querySelectorAll('.sidebar a.menu-item')).map((a) => a.textContent!.trim());
    expect(links).toContain('Practice');
    expect(links).toContain('My profile');
    expect(links).not.toContain('Question bank');
    expect(el.querySelector('.sidebar .menu-item .bi')).not.toBeNull();
    expect(el.querySelector('mat-sidenav-container, mat-toolbar, mat-icon, mat-nav-list, mat-menu, [mat-icon-button]')).toBeNull();
    expect(el.querySelector('.search')).toBeNull();
  });

  it('offers the admin the search box and the admin links', () => {
    user('admin');
    const { el } = render();
    expect(el.querySelector('.search input.form-control')).not.toBeNull();
    expect(Array.from(el.querySelectorAll('.sidebar a.menu-item')).map((a) => a.textContent!.trim())).toContain('Question bank');
  });

  it('the account menu opens, shows the role, and closes on a click elsewhere', () => {
    user('student');
    const { f, el } = render();
    expect(el.querySelector('.account .dropdown-menu')).toBeNull();
    el.querySelector<HTMLButtonElement>('.account-btn')!.click();
    f.detectChanges();
    const menu = el.querySelector('.account .dropdown-menu')!;
    expect(menu.textContent).toContain('Student');
    expect(menu.textContent).toContain('Sign out');
    el.querySelector<HTMLElement>('.content')!.click();
    f.detectChanges();
    expect(el.querySelector('.account .dropdown-menu')).toBeNull();
  });

  it('on a phone the sidebar is closed until the menu button opens it, and a tap on the dark layer closes it', () => {
    user('student');
    const { f, el } = render(true);
    const sidebar = el.querySelector('.sidebar')!;
    expect(sidebar.classList.contains('open')).toBe(false);
    expect(el.querySelector('.scrim')).toBeNull();
    el.querySelector<HTMLButtonElement>('button[aria-label="Toggle navigation"]')!.click();
    f.detectChanges();
    expect(sidebar.classList.contains('open')).toBe(true);
    el.querySelector<HTMLElement>('.scrim')!.click();
    f.detectChanges();
    expect(sidebar.classList.contains('open')).toBe(false);
  });

  it('on a wide screen there is no menu button', () => {
    user('student');
    const { el } = render(false);
    expect(el.querySelector('button[aria-label="Toggle navigation"]')).toBeNull();
  });

  it('tells a person with a temporary password to choose their own', () => {
    user('student', { must_change_password: true });
    const { el } = render();
    expect(el.querySelector('.banner.warn')!.textContent).toContain('temporary password');
  });
});
