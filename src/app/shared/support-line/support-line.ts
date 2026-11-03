import { Component, computed, inject, input } from '@angular/core';
import { PlatformService } from '../../core/platform.service';

/**
 * How to reach the people who run the site (phone or WhatsApp, hours, email), from Platform settings. Shows nothing until at
 * least one of them is set, so it can be dropped into any page.
 */
@Component({
  selector: 'app-support-line',
  templateUrl: './support-line.html',
  styleUrl: './support-line.scss',
  host: { class: 'bs' },
})
export class SupportLine {
  private platform = inject(PlatformService);
  lead = input('Need help?');

  phone = computed(() => this.platform.info().support_phone ?? '');
  hours = computed(() => this.platform.info().support_hours ?? '');
  email = computed(() => this.platform.info().support_email ?? '');
  visible = computed(() => !!(this.phone() || this.email()));
  /** The number as a phone link (digits and a leading plus only). */
  tel = computed(() => this.phone().replace(/[^\d+]/g, ''));
  /** WhatsApp needs the country code, so the link is offered only for a number long enough to have one. */
  whatsapp = computed(() => {
    const digits = this.phone().replace(/\D/g, '');
    return digits.length >= 11 ? `https://wa.me/${digits}` : '';
  });
}
