import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlatformService } from '../../core/platform.service';
import { SupportLine } from '../../shared/support-line/support-line';

/**
 * The frame around the sign-in and registration forms: a brand panel on the left (a banner on small screens) and the form
 * on the right. The form and the links below it are projected in.
 */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterLink, SupportLine],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.scss',
})
export class AuthLayout {
  heading = input.required<string>();
  sub = input('');
  /** Show the support contact under the form. The sign-in page turns it off because it shows the contact beside "Forgot password". */
  showSupport = input(true);
  platform = inject(PlatformService);
  year = new Date().getFullYear();
}
