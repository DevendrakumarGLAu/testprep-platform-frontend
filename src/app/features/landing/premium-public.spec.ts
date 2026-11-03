import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { StudentExam } from '../student/student.models';
import { TestCard } from '../student/test-card';
import { PublicExamPage } from './exam-page';

const API = environment.apiUrl;
const text = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent!.replace(/\s+/g, ' ');

describe('Public exam page', () => {
  function open(id = 'abc') {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(PublicExamPage);
    f.componentRef.setInput('id', id);
    f.detectChanges();
    http.match(`${API}/platform/`).forEach((r) => r.flush({ platform_name: 'TestPrep', allow_registration: true, support_email: '' }));
    return { f, http };
  }

  it('lists the exam, its subjects and open tests, and sets the page title', () => {
    const { f, http } = open();
    http.expectOne(`${API}/public/exams/abc/`).flush({
      id: 'abc', name: 'SSC', description: 'Staff Selection Commission', subjects: ['GK', 'Maths'],
      tests: [
        { title: 'Full Test 1', type: 'Full test', questions: 100, minutes: 60, premium: false, year: null },
        { title: 'CGL 2023', type: 'Previous year paper', questions: 100, minutes: 60, premium: true, year: 2023 },
      ],
    });
    f.detectChanges();
    const t = text(f);
    expect(t).toContain('SSC mock tests');
    expect(t).toContain('Staff Selection Commission');
    expect(t).toContain('Maths');
    expect(t).toContain('Full Test 1');
    expect(t).toContain('Previous year paper 2023 · 100 questions · 60 minutes');
    expect(t).toContain('Premium');
    expect(t).toContain('Sign up free');
    expect(TestBed.inject(Title).getTitle()).toBe('SSC mock tests | TestPrep');
  });

  it('says when an exam has no tests yet, and when it does not exist', () => {
    const { f, http } = open();
    http.expectOne(`${API}/public/exams/abc/`).flush({ id: 'abc', name: 'RRB', description: '', subjects: [], tests: [] });
    f.detectChanges();
    expect(text(f)).toContain('Tests for RRB will appear here soon');
    TestBed.resetTestingModule();
    const gone = open('nope');
    gone.http.expectOne(`${API}/public/exams/nope/`).flush('no', { status: 404, statusText: 'x' });
    gone.f.detectChanges();
    expect(text(gone.f)).toContain('Exam not found');
  });
});

describe('Premium test card', () => {
  const exam = (over: Partial<StudentExam>): StudentExam => ({
    id: 't1', title: 'Gold Mock', description: '', category: null, category_name: null, test_type: 'full_test', test_type_label: 'Full test',
    subject: null, subject_name: null, year: null, thumbnail_url: null, question_count: 10, total_marks: '10.00', duration_minutes: 20,
    start_at: null, end_at: null, max_attempts: 0, attempts_used: 0, negative_marking_enabled: true, sectional_timing: false,
    status: 'available', can_start: true, reason: '', active_attempt_id: null, ...over,
  } as StudentExam);

  function card(e: StudentExam) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(TestCard);
    f.componentRef.setInput('exam', e);
    f.detectChanges();
    return f;
  }

  it('shows the premium badge with the price, and a lock when the student has no access', () => {
    const f = card(exam({ premium: true, price: '199.00', locked: true, status: 'locked', can_start: false, reason: 'This is a premium test. Ask your administrator for access.' }));
    const t = text(f);
    expect(t).toContain('Premium · ₹199.00');
    expect(t).toContain('Locked');
    expect(t).toContain('Ask your administrator for access');
    const actions = [...(f.nativeElement as HTMLElement).querySelectorAll('.actions a')].map((a) => a.textContent!.trim());
    expect(actions).toEqual(['Locked']);
  });

  it('an unlocked premium test starts normally, and a free test shows no badge', () => {
    const open = card(exam({ premium: true, price: null, locked: false }));
    expect(text(open)).toContain('Premium');
    expect([...(open.nativeElement as HTMLElement).querySelectorAll('.actions a')].map((a) => a.textContent!.trim())).toEqual(['Start']);
    TestBed.resetTestingModule();
    expect(text(card(exam({})))).not.toContain('Premium');
  });
});
