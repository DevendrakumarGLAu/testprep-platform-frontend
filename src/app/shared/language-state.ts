import { Injectable, signal } from '@angular/core';

export type Lang = 'en' | 'hi';

export const LANG_LABEL: Record<Lang, string> = { en: 'English', hi: 'हिन्दी' };

const KEY = 'tp_lang';

function stored(): Lang {
  try {
    return localStorage.getItem(KEY) === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

/** The language the student reads questions in. It is remembered, so it is the same on the next page and the next test. */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly lang = signal<Lang>(stored());

  /** Called after the person changes language, so the choice can also be saved to their account. */
  sync: ((lang: Lang) => void) | null = null;

  /** The person picked a language. */
  set(lang: Lang) {
    this.apply(lang);
    this.sync?.(lang);
  }

  /** Use this language without telling the account (for example when it came from the account). */
  apply(lang: Lang) {
    this.lang.set(lang);
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* private mode: the choice just lasts for this visit */
    }
  }
}

/** The text in the chosen language, or the other one when this question was not written in it. */
export function pick(en: string | null | undefined, hi: string | null | undefined, lang: Lang): string {
  const first = lang === 'hi' ? hi : en;
  const second = lang === 'hi' ? en : hi;
  return first?.trim() ? first : second || '';
}
