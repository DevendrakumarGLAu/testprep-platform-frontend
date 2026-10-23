import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { NoteDetail, Notes, noteLines } from './notes';
import { SeriesDetail, SeriesList } from './series';

const API = `${environment.apiUrl}/student`;
const text = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent!.replace(/\s+/g, ' ');

function setup() {
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  return TestBed.inject(HttpTestingController);
}

describe('noteLines', () => {
  it('separates paragraphs from bullet points and drops blank lines', () => {
    expect(noteLines('Intro line\n\n- first\n* second\n• third\nClosing')).toEqual([
      { bullet: false, text: 'Intro line' },
      { bullet: true, text: 'first' },
      { bullet: true, text: 'second' },
      { bullet: true, text: 'third' },
      { bullet: false, text: 'Closing' },
    ]);
  });
});

describe('Study notes (student)', () => {
  it('lists the notes with a summary and searches as the student types', async () => {
    const http = setup();
    const f = TestBed.createComponent(Notes);
    f.detectChanges();
    http.expectOne((r) => r.url === `${API}/notes/` && !r.params.has('search')).flush({
      results: [{ id: 'n1', title: 'October capsule', title_hi: '', category: 'SSC', subject: null, note_date: '2026-10-01', updated_at: '', summary: 'Key points of the month' }],
    });
    f.detectChanges();
    expect(text(f)).toContain('October capsule');
    expect(text(f)).toContain('Key points of the month');
    expect(text(f)).toContain('SSC');
  });

  it('says so when there are no notes', () => {
    const http = setup();
    const f = TestBed.createComponent(Notes);
    f.detectChanges();
    http.expectOne(`${API}/notes/`).flush({ results: [] });
    f.detectChanges();
    expect(text(f)).toContain('No notes yet');
  });

  it('shows one note as paragraphs and bullets, in the chosen language when it has one', () => {
    const http = setup();
    localStorage.setItem('tp_lang', 'hi');
    const f = TestBed.createComponent(NoteDetail);
    f.componentRef.setInput('id', 'n1');
    f.detectChanges();
    http.expectOne(`${API}/notes/n1/`).flush({
      id: 'n1', title: 'Capsule', title_hi: 'सारांश', category: null, subject: null, note_date: null, updated_at: '', summary: '',
      body: 'Intro\n- point one', body_hi: 'परिचय\n- बिंदु एक',
    });
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('h1')!.textContent).toBe('सारांश');
    expect(el.querySelectorAll('li').length).toBe(1);
    expect(text(f)).toContain('बिंदु एक');
  });

  it('falls back to the other language when a note exists in only one', () => {
    const http = setup();
    localStorage.setItem('tp_lang', 'hi');
    const f = TestBed.createComponent(NoteDetail);
    f.componentRef.setInput('id', 'n2');
    f.detectChanges();
    http.expectOne(`${API}/notes/n2/`).flush({ id: 'n2', title: 'English only', title_hi: '', body: 'Only English text', body_hi: '', category: null, subject: null, note_date: null, updated_at: '', summary: '' });
    f.detectChanges();
    expect(text(f)).toContain('English only');
    expect(text(f)).toContain('Only English text');
  });

  it('shows a message for a note that is not there', () => {
    const http = setup();
    const f = TestBed.createComponent(NoteDetail);
    f.componentRef.setInput('id', 'gone');
    f.detectChanges();
    http.expectOne(`${API}/notes/gone/`).flush('no', { status: 404, statusText: 'x' });
    f.detectChanges();
    expect(text(f)).toContain('not available');
  });
});

describe('Test series (student)', () => {
  it('lists series with progress', () => {
    const http = setup();
    const f = TestBed.createComponent(SeriesList);
    f.detectChanges();
    http.expectOne(`${API}/series/`).flush({ results: [{ id: 's1', title: 'SSC CGL mocks', description: 'Thirty tests', category: 'SSC', total: 30, attempted: 4 }] });
    f.detectChanges();
    expect(text(f)).toContain('SSC CGL mocks');
    expect(text(f)).toContain('4 of 30 tests attempted');
  });

  it('shows the tests of one series in order', () => {
    const http = setup();
    const f = TestBed.createComponent(SeriesDetail);
    f.componentRef.setInput('id', 's1');
    f.detectChanges();
    const t = (id: string, title: string) => ({
      id, title, description: '', category: null, category_name: null, test_type: 'full_test', test_type_label: 'Full test', subject: null, subject_name: null,
      year: null, thumbnail_url: null, question_count: 5, total_marks: '5.00', duration_minutes: 10, start_at: null, end_at: null, max_attempts: 0,
      attempts_used: 0, negative_marking_enabled: true, sectional_timing: false, status: 'available', can_start: true, reason: '', active_attempt_id: null,
    });
    http.expectOne(`${API}/series/s1/`).flush({ id: 's1', title: 'SSC CGL mocks', description: '', category: null, total: 2, attempted: 1, tests: [t('a', 'Mock one'), t('b', 'Mock two')] });
    f.detectChanges();
    const names = [...(f.nativeElement as HTMLElement).querySelectorAll('app-test-card')].map((c) => c.textContent!.replace(/\s+/g, ' '));
    expect(names[0]).toContain('Mock one');
    expect(names[1]).toContain('Mock two');
    expect(text(f)).toContain('1 of 2 tests attempted');
  });
});
