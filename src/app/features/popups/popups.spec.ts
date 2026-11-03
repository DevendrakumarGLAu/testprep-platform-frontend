import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { NotifyService } from '../../core/notify.service';
import { PopupsAdmin } from '../admin/popups/popups';
import { PopupHost } from './popup-host';
import { Popup } from './popups.service';

const API = environment.apiUrl;
const MATERIAL = 'mat-card, mat-icon, mat-form-field, mat-slide-toggle, [mat-flat-button]';

describe('Student pop-up', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(PopupHost);
    f.detectChanges();
    return { f, http, el: f.nativeElement as HTMLElement };
  }
  const pop = { id: 4, title: 'New: study plan', body: 'Plan your week.\nStay on track.', link: '/student/plan', button_label: 'See my plan' };

  it('shows nothing when no pop-up is waiting', () => {
    const { f, http, el } = setup();
    http.expectOne(`${API}/student/popups/pending/`).flush({ popup: null });
    f.detectChanges();
    expect(el.querySelector('.modal-content')).toBeNull();
  });

  it('shows the title, message and button, and closing marks it seen then fetches the next one', () => {
    const { f, http, el } = setup();
    http.expectOne(`${API}/student/popups/pending/`).flush({ popup: pop });
    f.detectChanges();
    expect(el.querySelector('.modal-title')!.textContent).toContain('New: study plan');
    expect(el.querySelector('.body')!.textContent).toContain('Stay on track.');
    expect(el.querySelector('.btn-primary')!.textContent).toContain('See my plan');
    [...el.querySelectorAll<HTMLButtonElement>('.btn-link')].find((b) => b.textContent!.includes('Maybe later'))!.click();
    http.expectOne(`${API}/student/popups/4/seen/`).flush(null);
    http.expectOne(`${API}/student/popups/pending/`).flush({ popup: null });
    f.detectChanges();
    expect(el.querySelector('.modal-content')).toBeNull();
  });

  it('the button marks it seen and opens a page of the app', () => {
    const { f, http, el } = setup();
    const go = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    http.expectOne(`${API}/student/popups/pending/`).flush({ popup: pop });
    f.detectChanges();
    el.querySelector<HTMLButtonElement>('.btn-primary')!.click();
    http.expectOne(`${API}/student/popups/4/seen/`).flush(null);
    http.expectOne(`${API}/student/popups/pending/`).flush({ popup: null });
    expect(go).toHaveBeenCalledWith('/student/plan');
  });

  it('a pop-up without a link only has a "Got it" button', () => {
    const { f, http, el } = setup();
    http.expectOne(`${API}/student/popups/pending/`).flush({ popup: { ...pop, link: '' } });
    f.detectChanges();
    expect(el.querySelector('.btn-primary')).toBeNull();
    expect(el.querySelector('.btn-link')!.textContent).toContain('Got it');
  });

  it('shows the picture above the message when the pop-up has one', () => {
    const { f, http, el } = setup();
    http.expectOne(`${API}/student/popups/pending/`).flush({ popup: { ...pop, image_url: 'https://cdn.example/storage/popups/a.png' } });
    f.detectChanges();
    expect(el.querySelector<HTMLImageElement>('img.banner')!.getAttribute('src')).toBe('https://cdn.example/storage/popups/a.png');
  });

  it('shows no picture when there is none', () => {
    const { f, http, el } = setup();
    http.expectOne(`${API}/student/popups/pending/`).flush({ popup: pop });
    f.detectChanges();
    expect(el.querySelector('img.banner')).toBeNull();
  });

  it('shows no pop-up if the request fails', () => {
    const { f, http, el } = setup();
    http.expectOne(`${API}/student/popups/pending/`).flush('x', { status: 500, statusText: 'err' });
    f.detectChanges();
    expect(el.querySelector('.modal-content')).toBeNull();
  });
});

describe('Pop-ups admin page (Bootstrap)', () => {
  const row: Popup = {
    id: 1, title: 'Launch', body: 'Hi', image_url: null, link: '/student/plan', button_label: 'Open', audience: 'exam', category: 2, category_name: 'SSC',
    batch: null, batch_name: null, starts_at: null, ends_at: '2026-12-01T10:00:00Z', is_active: true, seen_count: 3, audience_size: 10, state: 'live', created_at: '2026-11-01T10:00:00Z',
  };

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: NotifyService, useValue: { success: vi.fn(), error: vi.fn() } }],
    });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(PopupsAdmin);
    f.detectChanges();
    http.expectOne((r) => r.url === `${API}/exam-categories/` || r.url.includes('categor')).flush({ count: 1, results: [{ id: 2, name: 'SSC', is_active: true }] });
    http.expectOne((r) => r.url === `${API}/batches/`).flush({ count: 1, results: [{ id: 5, name: 'Morning', is_active: true }] });
    http.expectOne((r) => r.url === `${API}/popups/`).flush({ count: 1, results: [row] });
    f.detectChanges();
    return { f, http, el: f.nativeElement as HTMLElement };
  }

  it('lists pop-ups with who they are for, how many saw them and their status', () => {
    const { el } = setup();
    expect(el.classList.contains('bs')).toBe(true);
    const text = el.querySelector('table.table tbody tr')!.textContent!;
    expect(text).toContain('Launch');
    expect(text).toContain('Preparing for SSC');
    expect(text).toContain('3 of 10');
    expect(text).toContain('Showing');
    expect(el.querySelector(MATERIAL)).toBeNull();
  });

  it('creating asks for the exam when the audience is an exam, then saves', () => {
    const { f, http, el } = setup();
    el.querySelector<HTMLButtonElement>('.head .btn-primary')!.click();
    f.detectChanges();
    const set = (sel: string, value: string) => {
      const input = el.querySelector<HTMLInputElement | HTMLSelectElement>(sel)!;
      input.value = value;
      input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
    };
    set('#pp-title', 'Big launch');
    set('#pp-audience', 'exam');
    f.detectChanges();
    el.querySelector<HTMLFormElement>('#popup-form')!.dispatchEvent(new Event('submit'));
    f.detectChanges();
    expect(el.querySelector('.alert-danger')!.textContent).toContain('Choose the exam');
    http.expectNone(`${API}/popups/`);
    set('#pp-audience', 'all');
    f.detectChanges();
    el.querySelector<HTMLFormElement>('#popup-form')!.dispatchEvent(new Event('submit'));
    const req = http.expectOne((r) => r.method === 'POST' && r.url === `${API}/popups/`);
    expect(req.request.body.title).toBe('Big launch');
    expect(req.request.body.audience).toBe('all');
    expect(req.request.body.ends_at).toBeTruthy(); // defaults to a week from now
  });

  it('switching off sends is_active false', () => {
    const { http, el } = setup();
    el.querySelector<HTMLButtonElement>('button[aria-label="Switch off"]')!.click();
    const req = http.expectOne((r) => r.method === 'PATCH' && r.url === `${API}/popups/1/`);
    expect(req.request.body).toEqual({ is_active: false });
  });

  it('deleting asks first', () => {
    const { f, http, el } = setup();
    el.querySelector<HTMLButtonElement>('button[aria-label="Delete pop-up"]')!.click();
    f.detectChanges();
    expect(el.querySelector('.modal-title')!.textContent).toContain('Delete this pop-up?');
    http.expectNone(`${API}/popups/1/`);
    el.querySelector<HTMLButtonElement>('.btn-danger')!.click();
    http.expectOne((r) => r.method === 'DELETE' && r.url === `${API}/popups/1/`);
  });

  function choose(el: HTMLElement, file: File) {
    const input = el.querySelector<HTMLInputElement>('#pp-image')!;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
  }

  it('uploads a chosen picture after the pop-up is saved', () => {
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
    const { f, http, el } = setup();
    el.querySelector<HTMLButtonElement>('.head .btn-primary')!.click();
    f.detectChanges();
    const title = el.querySelector<HTMLInputElement>('#pp-title')!;
    title.value = 'With picture';
    title.dispatchEvent(new Event('input'));
    choose(el, new File(['x'], 'a.png', { type: 'image/png' }));
    f.detectChanges();
    expect(el.querySelector<HTMLImageElement>('.thumb')!.getAttribute('src')).toBe('blob:preview');
    el.querySelector<HTMLFormElement>('#popup-form')!.dispatchEvent(new Event('submit'));
    http.expectOne((r) => r.method === 'POST' && r.url === `${API}/popups/`).flush({ ...row, id: 9 });
    const up = http.expectOne((r) => r.method === 'POST' && r.url === `${API}/popups/9/image/`);
    expect((up.request.body as FormData).get('image')).toBeInstanceOf(File);
    up.flush({ ...row, id: 9, image_url: 'https://cdn.example/storage/popups/a.png' });
    http.expectOne((r) => r.url === `${API}/popups/`);
  });

  it('refuses a picture over 2 MB or that is not an image', () => {
    const { f, el } = setup();
    el.querySelector<HTMLButtonElement>('.head .btn-primary')!.click();
    f.detectChanges();
    choose(el, new File(['x'], 'a.txt', { type: 'text/plain' }));
    f.detectChanges();
    expect(el.querySelector('.alert-danger')!.textContent).toContain('JPG, PNG, WebP or GIF');
    choose(el, new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }));
    f.detectChanges();
    expect(el.querySelector('.alert-danger')!.textContent).toContain('2 MB or smaller');
    expect(el.querySelector('.thumb')).toBeNull();
  });

  it('removing the current picture of a pop-up calls the remove endpoint on save', () => {
    const { f, http, el } = setup();
    // edit a pop-up that has a picture
    const withPic = { ...row, image_url: 'https://cdn.example/storage/popups/a.png' };
    (f.componentInstance as unknown as { rows: { set(v: Popup[]): void } }).rows.set([withPic]);
    f.detectChanges();
    el.querySelector<HTMLButtonElement>('button[aria-label="Edit pop-up"]')!.click();
    f.detectChanges();
    expect(el.querySelector('.thumb')).not.toBeNull();
    [...el.querySelectorAll<HTMLButtonElement>('.thumb-row button')].find((b) => b.textContent!.includes('Remove picture'))!.click();
    f.detectChanges();
    expect(el.querySelector('.thumb')).toBeNull();
    el.querySelector<HTMLFormElement>('#popup-form')!.dispatchEvent(new Event('submit'));
    http.expectOne((r) => r.method === 'PATCH' && r.url === `${API}/popups/1/`).flush(withPic);
    http.expectOne((r) => r.method === 'DELETE' && r.url === `${API}/popups/1/image/`);
  });
});
