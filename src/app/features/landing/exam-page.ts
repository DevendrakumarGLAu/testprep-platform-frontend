import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, input, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { PlatformService } from '../../core/platform.service';

interface PublicExam {
  id: string;
  name: string;
  description: string;
  subjects: string[];
  tests: { title: string; type: string; questions: number; minutes: number; premium: boolean; year: number | null }[];
}

/** A public page for one exam (for example SSC): what it covers and the tests on offer, with a button to sign up. Visible without signing in. */
@Component({
  selector: 'app-public-exam',
  imports: [RouterLink],
  templateUrl: './exam-page.html',
  styleUrl: './exam-page.scss',
  host: { class: 'bs' },
})
export class PublicExamPage {
  id = input.required<string>();
  platform = inject(PlatformService);
  auth = inject(AuthService);
  private http = inject(HttpClient);
  private title = inject(Title);

  loading = signal(true);
  exam = signal<PublicExam | null>(null);

  constructor() {
    effect(() => {
      this.loading.set(true);
      this.http.get<PublicExam>(`${environment.apiUrl}/public/exams/${this.id()}/`).subscribe({
        next: (e) => {
          this.exam.set(e);
          this.title.setTitle(`${e.name} mock tests | ${this.platform.info().platform_name}`);
          this.loading.set(false);
        },
        error: () => {
          this.exam.set(null);
          this.loading.set(false);
        },
      });
    });
  }
}
