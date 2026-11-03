import { TestBed } from '@angular/core/testing';
import { LANG_LABEL, LangSwitch, LanguageService, pick } from './language';

describe('pick', () => {
  it('returns the chosen language', () => {
    expect(pick('Hello', 'नमस्ते', 'en')).toBe('Hello');
    expect(pick('Hello', 'नमस्ते', 'hi')).toBe('नमस्ते');
  });

  it('falls back to the other language when a question was not written in the chosen one', () => {
    expect(pick('Hello', '', 'hi')).toBe('Hello');
    expect(pick('', 'नमस्ते', 'en')).toBe('नमस्ते');
    expect(pick(undefined, undefined, 'en')).toBe('');
  });
});

describe('LanguageService', () => {
  beforeEach(() => localStorage.clear());

  it('remembers the choice for the next visit', () => {
    TestBed.inject(LanguageService).set('hi');
    expect(localStorage.getItem('tp_lang')).toBe('hi');
    TestBed.resetTestingModule();
    expect(TestBed.inject(LanguageService).lang()).toBe('hi');
  });

  it('starts in English', () => {
    expect(TestBed.inject(LanguageService).lang()).toBe('en');
  });
});

describe('LangSwitch', () => {
  beforeEach(() => localStorage.clear());

  function render(languages: ('en' | 'hi')[]) {
    const fixture = TestBed.createComponent(LangSwitch);
    fixture.componentRef.setInput('languages', languages);
    fixture.detectChanges();
    return fixture;
  }

  it('is hidden when the test has only one language', () => {
    expect(render(['hi']).nativeElement.querySelector('select')).toBeNull();
  });

  it('is a Bootstrap dropdown that shows the current language and updates the shared choice', async () => {
    const fixture = render(['en', 'hi']);
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const select = el.querySelector('select.form-select') as HTMLSelectElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(Array.from(select.options).map((o) => o.textContent!.trim())).toEqual([LANG_LABEL.en, LANG_LABEL.hi]);
    expect(select.selectedOptions[0].textContent!.trim()).toBe(LANG_LABEL.en);
    TestBed.inject(LanguageService).set('hi');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(select.selectedOptions[0].textContent!.trim()).toBe(LANG_LABEL.hi);
  });

  it('changing the dropdown changes the shared language', () => {
    const fixture = render(['en', 'hi']);
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = 'hi';
    select.dispatchEvent(new Event('change'));
    expect(TestBed.inject(LanguageService).lang()).toBe('hi');
  });

  it('shows the first available language when the saved choice is not offered', () => {
    TestBed.inject(LanguageService).set('hi');
    expect(render(['en']).componentInstance.current()).toBe('en');
  });
});
