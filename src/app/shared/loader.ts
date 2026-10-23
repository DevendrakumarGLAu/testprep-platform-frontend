import { Component, inject } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LoadingService } from '../core/loading.service';

/** The page-wide loading display: a bar along the top edge, and a spinner over the page when something takes a while. */
@Component({
  selector: 'app-loader',
  imports: [MatProgressBarModule, MatProgressSpinnerModule],
  styles: `
    .bar { position: fixed; top: 0; left: 0; right: 0; z-index: 2000; height: 3px; }
    .overlay {
      position: fixed; inset: 0; z-index: 1999; display: grid; place-items: center;
      background: color-mix(in srgb, var(--mat-sys-scrim) 25%, transparent);
    }
    mat-progress-spinner { filter: drop-shadow(0 1px 3px #0006); }
    .box { display: grid; justify-items: center; gap: 12px; }
    .wake { max-width: min(380px, 86vw); text-align: center; padding: 10px 16px; border-radius: 12px; background: var(--mat-sys-surface); color: var(--mat-sys-on-surface); box-shadow: 0 2px 10px #0004; }
  `,
  template: `
    @if (loading.bar()) { <mat-progress-bar class="bar" mode="indeterminate" aria-label="Loading" /> }
    @if (loading.overlay()) {
      <div class="overlay" role="status" aria-live="polite" aria-label="Please wait">
        <div class="box">
          <mat-progress-spinner mode="indeterminate" diameter="56" />
          @if (loading.slow()) {
            <div class="wake">The server is starting up after being idle. This can take up to a minute. Please wait.</div>
          }
        </div>
      </div>
    }
  `,
})
export class Loader {
  loading = inject(LoadingService);
}
