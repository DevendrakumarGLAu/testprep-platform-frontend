import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { NotifyService } from '../../core/notify.service';
import { NoteDetail, Notes } from './notes';
import { SeriesDetail, SeriesList } from './series';

const MATERIAL = 'mat-card, mat-icon, mat-progress-bar, mat-form-field, [mat-button], [mat-flat-button], [mat-stroked-button]';

function setup() {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: NotifyService, useValue: { error: vi.fn() } }],
  });
  return TestBed.inject(HttpTestingController);
}

describe('Study notes (Bootstrap)', () => {
  it('lists notes as cards with a search box and no Material component', () => {
    const http = setup();
    const f = TestBed.createComponent(Notes);
    f.detectChanges();
    http.expectOne((r) => r.url.endsWith('/student/notes/')).flush({
      results: [{ id: 'n1', title: 'Rivers', title_hi: '', category: 'SSC', subject: 'Geo', note_date: null, updated_at: '', summary: 'Long rivers' }],
    });
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('input.form-control')).not.toBeNull();
    expect(el.querySelector('a.card[href="/student/notes/n1"]')!.textContent).toContain('Rivers');
    expect(el.querySelector(MATERIAL)).toBeNull();
  });

  it('shows one note with a way back', () => {
    const http = setup();
    const f = TestBed.createComponent(NoteDetail);
    f.componentRef.setInput('id', 'n1');
    f.detectChanges();
    http.expectOne((r) => r.url.endsWith('/student/notes/n1/')).flush({
      id: 'n1', title: 'Rivers', title_hi: '', category: null, subject: null, note_date: null, updated_at: '', summary: '', body: 'Intro\n- Ganga\n- Yamuna', body_hi: '',
    });
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('a.btn-link[href="/student/notes"]')).not.toBeNull();
    expect(el.querySelectorAll('li').length).toBe(2);
    expect(el.querySelector(MATERIAL)).toBeNull();
  });
});

describe('Test series (Bootstrap)', () => {
  it('shows how many tests of each series are attempted in a Bootstrap progress bar', () => {
    const http = setup();
    const f = TestBed.createComponent(SeriesList);
    f.detectChanges();
    http.expectOne((r) => r.url.endsWith('/student/series/')).flush({
      results: [{ id: 's1', title: 'Mock series', description: '', category: null, total: 4, attempted: 1 }],
    });
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect((el.querySelector('.progress[aria-valuenow] .progress-bar') as HTMLElement).style.width).toBe('25%');
    expect(el.textContent).toContain('1 of 4 tests attempted');
    expect(el.querySelector(MATERIAL)).toBeNull();
  });

  it('shows the tests inside a series', () => {
    const http = setup();
    const f = TestBed.createComponent(SeriesDetail);
    f.componentRef.setInput('id', 's1');
    f.detectChanges();
    http.expectOne((r) => r.url.endsWith('/student/series/s1/')).flush({ id: 's1', title: 'Mock series', description: 'All mocks', category: null, total: 0, attempted: 0, tests: [] });
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.textContent).toContain('Mock series');
    expect(el.querySelector('a.btn-link[href="/student/series"]')).not.toBeNull();
    expect(el.querySelector(MATERIAL)).toBeNull();
  });
});
