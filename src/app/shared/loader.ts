import { Component, inject } from '@angular/core';
import { LoadingService } from '../core/loading.service';

/** The page-wide loading display: a bar along the top edge, and a spinner over the page when something takes a while. */
@Component({
  selector: 'app-loader',
  templateUrl: './loader.html',
  styleUrl: './loader.scss',
  host: { class: 'bs' },
})
export class Loader {
  loading = inject(LoadingService);
}
