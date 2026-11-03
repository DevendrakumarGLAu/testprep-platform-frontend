import { Component, inject } from '@angular/core';
import { NotifyService } from '../../core/notify.service';

/** The short messages the app shows ("Saved", "Could not reach the server"), in the top-right corner. Placed once, in the app root. */
@Component({
  selector: 'app-toasts',
  templateUrl: './toasts.html',
  styleUrl: './toasts.scss',
  host: { class: 'bs' },
})
export class Toasts {
  notify = inject(NotifyService);
}
