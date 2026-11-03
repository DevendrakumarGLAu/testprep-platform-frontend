import { Component, input } from '@angular/core';
import { PrepHub } from './prep-hub';

// The family page lives in family-browser.ts; it is exported from here too, as the routes and tests have always imported it.
export { FamilyBrowser } from './family-browser';

/** One exam that is not in a family: straight to its four tabs. */
@Component({
  selector: 'app-exam-browser',
  imports: [PrepHub],
  templateUrl: './exam-browser.html',
})
export class ExamBrowser {
  id = input.required<string>();
}
