import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { CaptchaField } from './captcha-field';

const URL = `${environment.apiUrl}/auth/captcha/`;

describe('CaptchaField', () => {
  let http: HttpTestingController;

  function render() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CaptchaField);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('shows the picture and an input when the captcha is on', () => {
    const fixture = render();
    http.expectOne(URL).flush({ enabled: true, token: 't1', image: 'data:image/png;base64,AAAA' });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('img')!.getAttribute('src')).toBe('data:image/png;base64,AAAA');
    expect(el.querySelector('input')).not.toBeNull();
  });

  it('shows nothing and asks for nothing when the server has it switched off', () => {
    const fixture = render();
    http.expectOne(URL).flush({ enabled: false });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
    expect(fixture.componentInstance.ready()).toBe(true);
    expect(fixture.componentInstance.payload()).toEqual({});
  });

  it('is not ready until something is typed, then sends the token and the answer', () => {
    const fixture = render();
    http.expectOne(URL).flush({ enabled: true, token: 't1', image: 'x' });
    fixture.detectChanges();
    const c = fixture.componentInstance;
    expect(c.ready()).toBe(false);
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '  ab3cd ';
    input.dispatchEvent(new Event('input'));
    expect(c.ready()).toBe(true);
    expect(c.payload()).toEqual({ captcha_token: 't1', captcha_answer: 'ab3cd' });
  });

  it('refresh() loads a new picture and clears what was typed', () => {
    const fixture = render();
    http.expectOne(URL).flush({ enabled: true, token: 't1', image: 'one' });
    const c = fixture.componentInstance;
    c.answer.set('wrong');
    c.refresh();
    http.expectOne(URL).flush({ enabled: true, token: 't2', image: 'two' });
    expect(c.answer()).toBe('');
    expect(c.image()).toBe('two');
    expect(c.payload()['captcha_token']).toBe('t2');
  });

  it('stays out of the way when the server cannot be reached', () => {
    const fixture = render();
    http.expectOne(URL).flush('down', { status: 503, statusText: 'Unavailable' });
    expect(fixture.componentInstance.enabled()).toBe(false);
    expect(fixture.componentInstance.ready()).toBe(true);
  });
});
