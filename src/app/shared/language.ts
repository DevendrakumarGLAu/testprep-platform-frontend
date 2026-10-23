import { Component, computed, inject, input } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { LANG_LABEL, Lang, LanguageService } from './language-state';

// The language state lives in language-state.ts so the app shell can use it without loading this component.
export * from './language-state';

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
