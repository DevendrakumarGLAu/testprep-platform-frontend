import { BreakpointObserver } from '@angular/cdk/layout';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, filter, map, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth.service';
import { Role } from '../core/models';
import { PlatformService } from '../core/platform.service';
import { ThemeService, THEME_LABEL } from '../core/theme.service';
import { NotificationBell } from './notification-bell';

interface SearchResults {
  questions: { id: number; text: string; subject: string }[];
  tests: { id: number; title: string; status: string }[];
  students: { id: number; name: string; email: string }[];
}

const NO_RESULTS: SearchResults = { questions: [], tests: [], students: [] };

interface NavItem {
  label: string;
  icon: string;
  link: string;
  roles: Role[];
}

const ALL_NAV: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', link: '/admin/dashboard', roles: ['admin', 'super_admin'] },
  { label: 'Subjects & Topics', icon: 'category', link: '/admin/subjects', roles: ['admin', 'super_admin'] },
  { label: 'Question bank', icon: 'quiz', link: '/admin/questions', roles: ['admin', 'super_admin'] },
  { label: 'Insights', icon: 'insights', link: '/admin/insights', roles: ['admin', 'super_admin'] },
  { label: 'Test series', icon: 'collections_bookmark', link: '/admin/test-series', roles: ['admin', 'super_admin'] },
  { label: 'Study notes', icon: 'menu_book', link: '/admin/study-notes', roles: ['admin', 'super_admin'] },
  { label: 'Announcements', icon: 'campaign', link: '/admin/announcements', roles: ['admin', 'super_admin'] },
  { label: 'Question reports', icon: 'flag', link: '/admin/question-reports', roles: ['admin', 'super_admin'] },
  { label: 'Exams (SSC, ...)', icon: 'workspace_premium', link: '/admin/exams', roles: ['admin', 'super_admin'] },
  { label: 'Tests', icon: 'assignment', link: '/admin/tests', roles: ['admin', 'super_admin'] },
  { label: 'Batches', icon: 'groups', link: '/admin/batches', roles: ['admin', 'super_admin'] },
  { label: 'Students', icon: 'school', link: '/admin/students', roles: ['admin', 'super_admin'] },
  { label: 'Users', icon: 'group', link: '/admin/users', roles: ['admin', 'super_admin'] },
  { label: 'Activity log', icon: 'history', link: '/admin/activity', roles: ['super_admin'] },
  { label: 'Platform settings', icon: 'settings', link: '/admin/settings', roles: ['super_admin'] },
  { label: 'My profile', icon: 'account_circle', link: '/admin/profile', roles: ['admin', 'super_admin'] },
  { label: 'Dashboard', icon: 'dashboard', link: '/student/dashboard', roles: ['student'] },
  { label: 'My preparation', icon: 'school', link: '/student/prepare', roles: ['student'] },
  { label: 'All tests', icon: 'assignment', link: '/student/tests', roles: ['student'] },
  { label: 'Practice', icon: 'fitness_center', link: '/student/practice', roles: ['student'] },
  { label: 'Test series', icon: 'collections_bookmark', link: '/student/series', roles: ['student'] },
  { label: 'Study notes', icon: 'menu_book', link: '/student/notes', roles: ['student'] },
  { label: 'Revise', icon: 'style', link: '/student/revise', roles: ['student'] },
  { label: 'Saved questions', icon: 'bookmarks', link: '/student/saved', roles: ['student'] },
  { label: 'My attempts', icon: 'history', link: '/student/attempts', roles: ['student'] },
  { label: 'My profile', icon: 'account_circle', link: '/student/profile', roles: ['student'] },
];

/** Shared responsive frame: sidebar + top bar. Used by both the admin and student areas. */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, MatSidenavModule, MatToolbarModule,
    MatListModule, MatIconModule, MatButtonModule, MatMenuModule, ReactiveFormsModule, MatAutocompleteModule,
    MatFormFieldModule, MatInputModule, NotificationBell,
  ],
  styleUrl: './shell.scss',
  template: `
    <mat-sidenav-container class="shell">
      <mat-sidenav
        #nav
        [mode]="mobile() ? 'over' : 'side'"
        [opened]="!mobile()"
        [fixedInViewport]="true"
      >
        <div class="brand"><mat-icon>school</mat-icon> {{ platform.info().platform_name }}</div>
        <mat-nav-list>
          @for (item of items(); track item.link) {
            <a mat-list-item [routerLink]="item.link" routerLinkActive="active" (click)="mobile() && nav.close()">
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar class="topbar">
          @if (mobile()) {
            <button mat-icon-button (click)="nav.toggle()" aria-label="Toggle navigation">
              <mat-icon>menu</mat-icon>
            </button>
          }
          <span class="title">{{ areaTitle() }}</span>
          <span class="spacer"></span>
          @if (auth.isAdminRole()) {
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search">
              <mat-icon matPrefix>search</mat-icon>
              <input matInput [formControl]="query" [matAutocomplete]="auto" placeholder="Search questions, tests, students" aria-label="Search" />
              <mat-autocomplete #auto="matAutocomplete" (optionSelected)="open($event.option.value)">
                @if (results().questions.length) {
                  <mat-optgroup label="Questions">
                    @for (q of results().questions; track q.id) { <mat-option [value]="'/admin/questions/' + q.id">{{ q.text }} ({{ q.subject }})</mat-option> }
                  </mat-optgroup>
                }
                @if (results().tests.length) {
                  <mat-optgroup label="Tests">
                    @for (t of results().tests; track t.id) { <mat-option [value]="'/admin/tests/' + t.id">{{ t.title }} ({{ t.status }})</mat-option> }
                  </mat-optgroup>
                }
                @if (results().students.length) {
                  <mat-optgroup label="Students">
                    @for (s of results().students; track s.id) { <mat-option [value]="'/admin/students/' + s.id">{{ s.name }} ({{ s.email }})</mat-option> }
                  </mat-optgroup>
                }
                @if (searched() && !hasResults()) { <mat-option disabled>No matches</mat-option> }
              </mat-autocomplete>
            </mat-form-field>
          }
          <button mat-icon-button (click)="theme.cycle()" [attr.aria-label]="'Appearance: ' + themeLabel() + '. Click to change.'" [title]="'Appearance: ' + themeLabel()">
            <mat-icon>{{ theme.mode() === 'dark' ? 'dark_mode' : theme.mode() === 'light' ? 'light_mode' : 'contrast' }}</mat-icon>
          </button>
          <app-notification-bell />
          <button mat-button [matMenuTriggerFor]="menu">
            <mat-icon>account_circle</mat-icon>
            <span class="name">{{ displayName() }}</span>
          </button>
          <mat-menu #menu="matMenu">
            <div class="menu-meta">{{ roleLabel() }}</div>
            <a mat-menu-item [routerLink]="profileLink()"><mat-icon>person</mat-icon> My profile</a>
            <button mat-menu-item (click)="logout()"><mat-icon>logout</mat-icon> Sign out</button>
          </mat-menu>
        </mat-toolbar>
        @if (auth.user()?.must_change_password) {
          <div class="banner warn" role="alert">
            <mat-icon inline>lock_reset</mat-icon> You are using a temporary password. Please <a [routerLink]="profileLink()">choose your own password</a> now.
          </div>
        } @else if (auth.user() && auth.user()!.email_verified === false && platform.info().email_enabled) {
          <div class="banner" role="status">
            <mat-icon inline>mark_email_unread</mat-icon> Please confirm your email address ({{ auth.user()!.email }}).
            <button mat-button (click)="sendVerification()" [disabled]="sentVerification()">{{ sentVerification() ? 'Link sent. Check your email' : 'Send me the link' }}</button>
          </div>
        }
        <main class="content"><router-outlet /></main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
})
export class Shell {
  auth = inject(AuthService);
  theme = inject(ThemeService);
  themeLabel = () => THEME_LABEL[this.theme.mode()];
  platform = inject(PlatformService);
  private http = inject(HttpClient);
  private router = inject(Router);

  query = new FormControl('', { nonNullable: true });
  results = signal<SearchResults>(NO_RESULTS);
  searched = signal(false);
  hasResults = computed(() => {
    const r = this.results();
    return r.questions.length + r.tests.length + r.students.length > 0;
  });
  private nav = viewChild.required<MatSidenav>('nav');

  mobile = toSignal(
    inject(BreakpointObserver).observe('(max-width: 900px)').pipe(map((s) => s.matches)),
    { initialValue: false },
  );

  items = computed(() => ALL_NAV.filter((i) => i.roles.includes(this.auth.role()!)));
  displayName = computed(() => {
    const u = this.auth.user();
    return u ? `${u.first_name} ${u.last_name}`.trim() || u.username : '';
  });
  roleLabel = computed(() =>
    ({ super_admin: 'Super Admin', admin: 'Admin', student: 'Student' })[this.auth.role() ?? 'student'],
  );
  sentVerification = signal(false);
  sendVerification() {
    this.auth.sendVerification().subscribe({
      next: () => this.sentVerification.set(true),
      error: () => this.sentVerification.set(false),
    });
  }

  profileLink = computed(() => (this.auth.role() === 'student' ? '/student/profile' : '/admin/profile'));
  areaTitle = computed(() => (this.auth.role() === 'student' ? 'Student Portal' : 'Admin Panel'));

  constructor() {
    this.query.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => {
          if (q.trim().length < 2) {
            this.searched.set(false);
            return of(NO_RESULTS);
          }
          this.searched.set(true);
          return this.http
            .get<SearchResults>(`${environment.apiUrl}/admin/search/`, { params: { q: q.trim() } })
            .pipe(catchError(() => of(NO_RESULTS)));
        }),
      )
      .subscribe((r) => this.results.set(r));

    // Close the drawer after navigating on small screens.
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      if (this.mobile()) this.nav().close();
    });
  }

  open(link: string) {
    this.query.setValue('', { emitEvent: false });
    this.results.set(NO_RESULTS);
    this.searched.set(false);
    this.router.navigateByUrl(link);
  }

  logout() {
    this.auth.logout();
  }
}
