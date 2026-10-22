import { Component, Injectable, computed, inject, input, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

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

  set(lang: Lang) {
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

/** Small language dropdown. Shows nothing unless the test really offers more than one language. */
@Component({
  selector: 'app-lang-switch',
  imports: [MatFormFieldModule, MatSelectModule],
  styles: `
    mat-form-field {
      width: 128px;
      --mat-form-field-container-height: 34px;
      --mat-form-field-container-vertical-padding: 5px;
      --mat-form-field-outlined-label-text-size: 13px;
      font-size: 13px;
    }
  `,
  template: `
    @if (languages().length > 1) {
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-select [value]="current()" (selectionChange)="svc.set($event.value)" aria-label="Question language">
          @for (l of languages(); track l) { <mat-option [value]="l" [attr.lang]="l">{{ label[l] }}</mat-option> }
        </mat-select>
      </mat-form-field>
    }
  `,
})
export class LangSwitch {
  languages = input<Lang[]>([]);
  protected svc = inject(LanguageService);
  protected label = LANG_LABEL;
  /** The chosen language if this test has it, otherwise the first one it does have. */
  current = computed(() => (this.languages().includes(this.svc.lang()) ? this.svc.lang() : (this.languages()[0] ?? 'en')));
}
