import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PlatformInfo, PlatformService } from '../../core/platform.service';
import { SupportLine } from '../../shared/support-line/support-line';
import { Privacy } from './privacy';
import { Terms } from './terms';

function platform(over: Partial<PlatformInfo> = {}) {
  const info = signal<PlatformInfo>({ platform_name: 'TestPrep', allow_registration: true, support_email: '', ...over });
  return { info };
}

function setup(over: Partial<PlatformInfo> = {}) {
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: PlatformService, useValue: platform(over) }] });
}

describe('SupportLine', () => {
  function render(over: Partial<PlatformInfo>, lead?: string) {
    setup(over);
    const f = TestBed.createComponent(SupportLine);
    if (lead) f.componentRef.setInput('lead', lead);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it('shows nothing until a phone or an email is set', () => {
    expect(render({}).querySelector('.support')).toBeNull();
  });

  it('shows the phone as a call link, the hours, and a WhatsApp link when the number has a country code', () => {
    const el = render({ support_phone: '+91 98765 43210', support_hours: 'Mon to Sat, 10 am to 6 pm' }, 'Forgot your password?');
    expect(el.textContent).toContain('Forgot your password?');
    expect(el.querySelector<HTMLAnchorElement>('a.phone')!.getAttribute('href')).toBe('tel:+919876543210');
    expect(el.querySelector<HTMLAnchorElement>('a.wa')!.getAttribute('href')).toBe('https://wa.me/919876543210');
    expect(el.querySelector('.hours')!.textContent).toContain('10 am to 6 pm');
  });

  it('offers no WhatsApp link for a number without a country code, and shows the email', () => {
    const el = render({ support_phone: '98765 43210', support_email: 'help@example.com' });
    expect(el.querySelector('a.phone')).not.toBeNull();
    expect(el.querySelector('a.wa')).toBeNull();
    expect(el.querySelector<HTMLAnchorElement>('a.mail')!.getAttribute('href')).toBe('mailto:help@example.com');
  });
});

describe('Terms and privacy pages', () => {
  it('the terms page names the site, the sections and links to the privacy policy', () => {
    setup({ platform_name: 'ExamHub' });
    const f = TestBed.createComponent(Terms);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('h1')!.textContent).toContain('Terms of use');
    expect(el.textContent).toContain('ExamHub');
    expect(el.querySelectorAll('h2').length).toBeGreaterThanOrEqual(8);
    expect(el.textContent).toContain('do not predict or guarantee');
    expect(el.querySelector('a[href="/privacy"]')).not.toBeNull();
    expect(el.querySelector('.bs')).not.toBeNull();
  });

  it('the privacy page says what is collected and that nothing is sold, and links to the terms', () => {
    setup({ platform_name: 'ExamHub', support_phone: '+91 98765 43210' });
    const f = TestBed.createComponent(Privacy);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('h1')!.textContent).toContain('Privacy policy');
    expect(el.querySelectorAll('table tbody tr').length).toBeGreaterThanOrEqual(5);
    expect(el.textContent).toContain('We do not sell your information');
    expect(el.querySelector('a[href="/terms"]')).not.toBeNull();
    expect(el.querySelector('a.phone')).not.toBeNull(); // the contact line at the bottom
  });
});
