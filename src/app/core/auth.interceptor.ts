import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

let refreshing$: Observable<unknown> | null = null;

const isAuthEndpoint = (url: string) => /\/auth\/(login|register|refresh|logout)\//.test(url);

function withToken(req: HttpRequest<unknown>, token: string | null) {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

export const authInterceptor: HttpInterceptorFn = (req, next: HttpHandlerFn) => {
  const auth = inject(AuthService);
  if (!req.url.startsWith(environment.apiUrl) || isAuthEndpoint(req.url)) return next(req);

  return next(withToken(req, auth.accessToken)).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || !auth.refreshToken) {
        if (err.status === 401) auth.logout();
        return throwError(() => err);
      }
      // One shared refresh for all requests that failed at the same time.
      refreshing$ ??= auth.refresh().pipe(
        shareReplay(1),
        finalize(() => (refreshing$ = null)),
      );
      return refreshing$.pipe(
        switchMap(() => next(withToken(req, auth.accessToken))),
        catchError((e) => {
          auth.logout();
          return throwError(() => e);
        }),
      );
    }),
  );
};
