import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'auto';

const KEY = 'tp_theme';
const SCHEME: Record<ThemeMode, string> = { light: 'light', dark: 'dark', auto: 'light dark' };
export const THEME_LABEL: Record<ThemeMode, string> = { light: 'Light', dark: 'Dark', auto: 'Same as my device' };

function stored(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'auto' ? v : 'light';
  } catch {
    return 'light';
  }
}

/** Light or dark appearance (or follow the device). The choice is remembered on this device. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(stored());

  constructor() {
    this.apply(this.mode());
  }

  set(mode: ThemeMode) {
    this.mode.set(mode);
    this.apply(mode);
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* private mode: the choice lasts for this visit only */
    }
  }

  /** Light, then dark, then follow the device. */
  cycle() {
    const next: Record<ThemeMode, ThemeMode> = { light: 'dark', dark: 'auto', auto: 'light' };
    this.set(next[this.mode()]);
  }

  private apply(mode: ThemeMode) {
    if (typeof document === 'undefined') return;
    document.body.style.colorScheme = SCHEME[mode];
    this.applyBootstrap(mode);
    // Following the device: switch Bootstrap's palette when the device does.
    if (mode === 'auto' && typeof matchMedia === 'function' && !this.watching) {
      this.watching = true;
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.applyBootstrap(this.mode()));
    }
  }

  private watching = false;

  /** The newer pages use Bootstrap, whose dark palette is switched by an attribute on the page. */
  private applyBootstrap(mode: ThemeMode) {
    const dark = mode === 'dark' || (mode === 'auto' && typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
  }
}
