import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PlatformInfo {
  platform_name: string;
  allow_registration: boolean;
  support_email: string;
}

/** Public platform settings: shown on the login page and in the app header. */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/platform/`;

  readonly info = signal<PlatformInfo>({ platform_name: 'TestPrep', allow_registration: true, support_email: '' });

  constructor() {
    this.refresh();
  }

  refresh() {
    this.http.get<PlatformInfo>(this.url).subscribe({ next: (i) => this.info.set(i), error: () => undefined });
  }

  save(body: Partial<PlatformInfo>) {
    return this.http.patch<PlatformInfo>(this.url, body).pipe(tap((i) => this.info.set(i)));
  }
}
