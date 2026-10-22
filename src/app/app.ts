import { Component, DestroyRef, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { installPickerOnClick } from './shared/pickers';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  constructor() {
    const remove = installPickerOnClick(document);
    inject(DestroyRef).onDestroy(remove);
  }
}
