import { Component, DestroyRef, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { Loader } from './shared/loader';
import { Toasts } from './shared/toasts/toasts';
import { AuthService } from './core/auth.service';
import { PlatformService } from './core/platform.service';
import { ThemeService } from './core/theme.service';
import { LanguageService } from './shared/language-state';
import { installPickerOnClick } from './shared/pickers';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Loader, Toasts],
  template: '<app-loader /><router-outlet /><app-toasts />',
})
export class App {
  constructor() {
    // The browser tab shows the platform name an administrator set in Platform settings.
    const title = inject(Title);
    const platform = inject(PlatformService);
    effect(() => title.setTitle(platform.info().platform_name || 'TestPrep'));
    inject(ThemeService); // applies the saved light/dark choice as soon as the app starts

    // The reading language follows the account: the account's choice wins when someone signs in, and a new choice is saved back.
    const auth = inject(AuthService);
    const lang = inject(LanguageService);
    lang.sync = (l) => {
      if (auth.isLoggedIn() && auth.user()?.preferred_language !== l) auth.updateProfile({ preferred_language: l }).subscribe({ error: () => undefined });
    };
    effect(() => {
      const saved = auth.user()?.preferred_language;
      if (saved) lang.apply(saved);
    });
    const remove = installPickerOnClick(document);
    inject(DestroyRef).onDestroy(remove);
  }
}
