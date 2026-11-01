import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';
import { loadProtection, protectApp } from './app/shared/protect';

loadProtection(environment.protect)
  .then((on) => {
    protectApp(document, on);
    return bootstrapApplication(App, appConfig);
  })
  .then(() => {
    // The service worker only runs in the production build, so it never gets in the way of development.
    if (!isDevMode() && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => undefined);
    }
  })
  .catch((err) => console.error(err));
