import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlatformService } from '../../core/platform.service';
import { LegalLayout } from './legal-layout';

@Component({
  selector: 'app-terms',
  imports: [LegalLayout, RouterLink],
  templateUrl: './terms.html',
})
export class Terms {
  platform = inject(PlatformService);
}
