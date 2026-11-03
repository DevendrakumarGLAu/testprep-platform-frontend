import { Component, computed, inject, input } from '@angular/core';
import { LANG_LABEL, Lang, LanguageService } from '../language-state';

/** Small language dropdown. Shows nothing unless the test really offers more than one language. */
@Component({
  selector: 'app-lang-switch',
  templateUrl: './lang-switch.html',
  styleUrl: './lang-switch.scss',
  host: { class: 'bs' },
})
export class LangSwitch {
  languages = input<Lang[]>([]);
  protected svc = inject(LanguageService);
  protected label = LANG_LABEL;
  /** The chosen language if this test has it, otherwise the first one it does have. */
  current = computed(() => (this.languages().includes(this.svc.lang()) ? this.svc.lang() : (this.languages()[0] ?? 'en')));
}
