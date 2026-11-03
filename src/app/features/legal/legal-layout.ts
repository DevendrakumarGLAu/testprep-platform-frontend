import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlatformService } from '../../core/platform.service';
import { SupportLine } from '../../shared/support-line/support-line';

/** The frame of the Terms and Privacy pages: the site name, a way home, the text, and how to reach us. */
@Component({
  selector: 'app-legal-layout',
  imports: [RouterLink, SupportLine],
  templateUrl: './legal-layout.html',
  styleUrl: './legal-layout.scss',
  host: { class: 'bs' },
})
export class LegalLayout {
  title = input.required<string>();
  updated = input('');
  platform = inject(PlatformService);
}
