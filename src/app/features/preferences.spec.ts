import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { environment } from '../../environments/environment';
import { App } from '../app';
import { AuthService } from '../core/auth.service';
import { NotifyService } from '../core/notify.service';
import { ThemeService } from '../core/theme.service';
import { LanguageService } from '../shared/language-state';
import { CARD_SIZE, ShareCardData, cardFileName, cardLines, drawCard, shareCard } from '../shared/share-card';
import { ResultExtras } from './student/result-extras';
import { StudentService } from './student/student.service';

const API = environment.apiUrl;

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.style.colorScheme = '';
  });

  it('starts light, switches, remembers the choice and applies it to the page', () => {
    const t = TestBed.inject(ThemeService);
    expect(t.mode()).toBe('light');
    expect(document.body.style.colorScheme).toBe('light');
    t.set('dark');
    expect(document.body.style.colorScheme).toBe('dark');
    expect(localStorage.getItem('tp_theme')).toBe('dark');
    t.set('auto');
    expect(document.body.style.colorScheme).toBe('light dark');
  });

  it('cycles light, dark, device, light', () => {
    const t = TestBed.inject(ThemeService);
    t.set('light');
    const seen = [t.mode()];
    for (let i = 0; i < 3; i++) {
      t.cycle();
      seen.push(t.mode());
    }
    expect(seen).toEqual(['light', 'dark', 'auto', 'light']);
  });

  it('picks up a saved choice', () => {
    localStorage.setItem('tp_theme', 'dark');
    expect(TestBed.inject(ThemeService).mode()).toBe('dark');
    TestBed.inject(ThemeService).set('light');
  });
});

describe('Language follows the account', () => {
  function setup(user: Record<string, unknown> | null) {
    localStorage.clear();
    if (user) {
      localStorage.setItem('tp_access', 'A');
      localStorage.setItem('tp_user', JSON.stringify(user));
    }
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(App);
    f.detectChanges();
    http.match(`${API}/platform/`).forEach((r) => r.flush({ platform_name: 'TestPrep', allow_registration: true, support_email: '' }));
    return { f, http, lang: TestBed.inject(LanguageService), auth: TestBed.inject(AuthService) };
  }
  const user = (preferred: string) => ({
    id: 1, username: 'u', email: 'u@x.com', first_name: 'U', last_name: '', phone: '', role: 'student', is_active: true, date_joined: '', preferred_language: preferred,
  });

  it('uses the language saved on the account when signed in, ahead of the one on this device', () => {
    const { lang, http } = setup(user('hi'));
    expect(lang.lang()).toBe('hi');
    http.expectNone((r) => r.method === 'PATCH'); // nothing to save: it came from the account
  });

  it('saves a new choice to the account', () => {
    const { lang, http } = setup(user('en'));
    lang.set('hi');
    const req = http.expectOne(`${API}/auth/me/`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ preferred_language: 'hi' });
    req.flush(user('hi'));
  });

  it('does not call the server for a visitor who is not signed in', () => {
    const { lang, http } = setup(null);
    lang.set('hi');
    http.expectNone(`${API}/auth/me/`);
    expect(localStorage.getItem('tp_lang')).toBe('hi');
  });
});

describe('Share card', () => {
  const data: ShareCardData = { platform: 'TestPrep', title: 'SSC Full Test 1', score: '78.50', totalMarks: '100.00', percent: 78.5, correct: 80, incorrect: 14, unanswered: 6 };

  it('puts the score, accuracy and counts on the card, and the rank when there is one', () => {
    expect(cardLines(data).map((l) => l.text)).toEqual(['TestPrep', 'SSC Full Test 1', '78.50 / 100.00', '78.5% score', '80 correct · 14 wrong · 6 skipped']);
    expect(cardLines({ ...data, rank: 3, participants: 120 }).map((l) => l.text)).toContain('Rank #3 of 120');
  });

  it('draws every line on the canvas', () => {
    const drawn: string[] = [];
    const ctx = {
      createLinearGradient: () => ({ addColorStop: () => undefined }),
      fillRect: () => undefined,
      fillText: (t: string) => drawn.push(t),
      fillStyle: '', font: '', textAlign: '', textBaseline: '',
    } as unknown as CanvasRenderingContext2D;
    drawCard(ctx, data);
    expect(drawn).toEqual(cardLines(data).map((l) => l.text));
  });

  it('names the file after the test', () => {
    expect(cardFileName(data)).toBe('ssc-full-test-1-score.png');
    expect(cardFileName({ ...data, title: '***' })).toBe('score-score.png');
    expect(CARD_SIZE).toBe(1080);
  });

  it('downloads the picture when the device cannot share files', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    const canvas = {
      width: 0, height: 0, toBlob: (cb: (b: Blob) => void) => cb(blob),
      getContext: () => ({ createLinearGradient: () => ({ addColorStop: () => undefined }), fillRect: () => undefined, fillText: () => undefined }),
    };
    const real = document.createElement.bind(document);
    const click = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => (tag === 'canvas' ? (canvas as unknown as HTMLElement) : Object.assign(real(tag), { click })));
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    expect(await shareCard(data)).toBe('downloaded');
    expect(click).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe('Result extras: share and print', () => {
  function open(card: ShareCardData | null) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: StudentService,
          useValue: {
            leaderboard: () => of({ exam: 'M', participants: 40, me: { rank: 3, name: 'A', score: '9', total_marks: '10', percent: 90, time_taken_seconds: 1, is_me: true, better_than_percent: 92 }, top: [] }),
          },
        },
        { provide: NotifyService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    const f = TestBed.createComponent(ResultExtras);
    f.componentRef.setInput('attemptId', 'a1');
    f.componentRef.setInput('examId', 'e1');
    f.componentRef.setInput('card', card);
    f.detectChanges();
    return f;
  }

  it('offers both buttons, and the share button needs the score to exist', () => {
    const f = open(null);
    const buttons = [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.tools button')];
    expect(buttons.map((b) => b.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['share Share my score', 'print Print or save as PDF']);
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(false);
  });

  it('prints the page', () => {
    const f = open(null);
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    f.componentInstance.print();
    expect(print).toHaveBeenCalled();
  });
});
