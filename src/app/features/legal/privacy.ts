import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlatformService } from '../../core/platform.service';
import { LegalLayout } from './legal-layout';

@Component({
  selector: 'app-privacy',
  imports: [LegalLayout, RouterLink],
  templateUrl: './privacy.html',
})
export class Privacy {
  platform = inject(PlatformService);
}
