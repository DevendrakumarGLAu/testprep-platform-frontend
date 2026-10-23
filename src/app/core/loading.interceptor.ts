import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoadingService } from './loading.service';

/** Background calls the person did not ask for: the exam's autosave, token refresh, the captcha picture, the search box. */
const QUIET = /\/answers\/|\/auth\/refresh\/|\/auth\/captcha\/|\/search\/|\/api\/platform\/|\/auth\/logout\//;

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl) || QUIET.test(req.url)) return next(req);
  const loading = inject(LoadingService);
  loading.start();
  return next(req).pipe(finalize(() => loading.stop()));
};
