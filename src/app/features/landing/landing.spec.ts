import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { PublicExamPage } from './exam-page';
import { Landing } from './landing';

const API = environment.apiUrl;

describe('Landing page', () => {
  let http: HttpTestingController;

  function open(loggedIn = false) {
    localStorage.clear();
    if (loggedIn) {
      localStorage.setItem('tp_access', 'A');
      localStorage.setItem('tp_user', JSON.stringify({ id: 1, username: 'u', email: 'u@x.com', first_name: 'U', last_name: '', phone: '', role: 'student', is_active: true, date_joined: '' }));
    }
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Landing);
    fixture.detectChanges();
    return fixture;
  }

  const text = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent!.replace(/\s+/g, ' ');

  afterEach(() => {
    http.match(() => true);
  });

  it('shows the sections and the sign-up and login buttons to a visitor', () => {
    const f = open();
    http.expectOne(`${API}/public/home/`).flush({ stats: { tests: 0, questions: 0, students: 0 }, exams: [] });
    http.match(`${API}/platform/`).forEach((r) => r.flush({ platform_name: 'TestPrep', allow_registration: true, support_email: 'help@x.com' }));
    f.detectChanges();
    const t = text(f);
    for (const s of ['Prepare smarter.', 'Choose your exam', 'Everything you need to practise', 'How it works', 'Questions students ask', 'Sign up free', 'Log in', 'help@x.com']) {
      expect(t).toContain(s);
    }
    expect(f.nativeElement.querySelectorAll('.accordion-item').length).toBe(5);
    expect(t).toContain('Exams will appear here');
  });

  it('lists the exams and numbers the server reports', () => {
    const f = open();
    http.expectOne(`${API}/public/home/`).flush({
      stats: { tests: 12, questions: 1250, students: 40 },
      exams: [{ name: 'SSC', description: 'Staff Selection Commission', tests: 4, subjects: ['GK', 'Maths'] }],
    });
    f.detectChanges();
    const t = text(f);
    expect(t).toContain('SSC');
    expect(t).toContain('4 free tests');
    expect(t).toContain('GK');
    expect(t).toContain('1.2K+');
    expect(t).toContain('Mock tests');
    expect(t).not.toContain('Exams will appear here');
  });

  it('sends a signed-in student to their dashboard instead of the sign-up buttons', () => {
    const f = open(true);
    http.expectOne(`${API}/public/home/`).flush({ stats: { tests: 0, questions: 0, students: 0 }, exams: [] });
    f.detectChanges();
    const t = text(f);
    expect(t).toContain('Go to dashboard');
    expect(t).not.toContain('Sign up free');
  });

  it('still renders when the numbers cannot be loaded', () => {
    const f = open();
    http.expectOne(`${API}/public/home/`).flush('down', { status: 503, statusText: 'x' });
    f.detectChanges();
    expect(text(f)).toContain('Prepare smarter.');
  });

  it('is Bootstrap: buttons, an accordion that opens one question at a time, and no Material component', () => {
    const f = open();
    http.expectOne(`${API}/public/home/`).flush({ stats: { tests: 0, questions: 0, students: 0 }, exams: [] });
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('a.btn.btn-primary')).not.toBeNull();
    expect(el.querySelector('mat-icon, mat-accordion, mat-expansion-panel, [mat-flat-button], [mat-button], [mat-stroked-button]')).toBeNull();
    const buttons = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.accordion-button'));
    expect(el.querySelector('.accordion-body')).toBeNull();
    buttons()[0].click();
    f.detectChanges();
    expect(el.querySelectorAll('.accordion-body').length).toBe(1);
    expect(el.querySelector('.accordion-body')!.textContent).toContain('free');
    buttons()[2].click();
    f.detectChanges();
    expect(el.querySelectorAll('.accordion-body').length).toBe(1);
    expect(buttons()[2].getAttribute('aria-expanded')).toBe('true');
    expect(buttons()[0].getAttribute('aria-expanded')).toBe('false');
    buttons()[2].click();
    f.detectChanges();
    expect(el.querySelector('.accordion-body')).toBeNull();
  });
});

describe('Public exam page (Bootstrap)', () => {
  it('shows the exam and its tests in Bootstrap cards', () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(PublicExamPage);
    f.componentRef.setInput('id', 'ssc');
    f.detectChanges();
    http.expectOne(`${API}/public/exams/ssc/`).flush({
      id: 'ssc', name: 'SSC', description: 'Staff Selection', subjects: ['GK'],
      tests: [{ title: 'Mock 1', type: 'Full test', questions: 100, minutes: 60, premium: true, year: null }],
    });
    http.match(() => true);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('h1')!.textContent).toContain('SSC mock tests');
    expect(el.querySelector('.card .card-body')!.textContent).toContain('Mock 1');
    expect(el.textContent).toContain('Premium');
    expect(el.querySelector('a.btn-primary')).not.toBeNull();
    expect(el.querySelector('mat-card, mat-icon, mat-progress-bar, [mat-flat-button], [mat-button]')).toBeNull();
  });
});
