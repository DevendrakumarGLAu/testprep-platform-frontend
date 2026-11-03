import { BreakpointObserver } from '@angular/cdk/layout';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, filter, map, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth.service';
import { Role } from '../core/models';
import { PlatformService } from '../core/platform.service';
import { ThemeService, THEME_LABEL } from '../core/theme.service';
import { PopupHost } from '../features/popups/popup-host';
import { FeedbackButton } from '../features/feedback/feedback-button';
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
  { label: 'Dashboard', icon: 'bi-speedometer2', link: '/admin/dashboard', roles: ['admin', 'super_admin'] },
  { label: 'Subjects & Topics', icon: 'bi-tags', link: '/admin/subjects', roles: ['admin', 'super_admin'] },
  { label: 'Question bank', icon: 'bi-question-circle', link: '/admin/questions', roles: ['admin', 'super_admin'] },
  { label: 'Insights', icon: 'bi-graph-up', link: '/admin/insights', roles: ['admin', 'super_admin'] },
  { label: 'Test series', icon: 'bi-collection', link: '/admin/test-series', roles: ['admin', 'super_admin'] },
  { label: 'Study notes', icon: 'bi-journal-text', link: '/admin/study-notes', roles: ['admin', 'super_admin'] },
  { label: 'Pop-ups', icon: 'bi-window-stack', link: '/admin/popups', roles: ['admin', 'super_admin'] },
  { label: 'Announcements', icon: 'bi-megaphone', link: '/admin/announcements', roles: ['admin', 'super_admin'] },
  { label: 'Question reports', icon: 'bi-flag', link: '/admin/question-reports', roles: ['admin', 'super_admin'] },
  { label: 'Student doubts', icon: 'bi-chat-dots', link: '/admin/doubts', roles: ['admin', 'super_admin'] },
  { label: 'Feedback', icon: 'bi-chat-left-text', link: '/admin/feedback', roles: ['admin', 'super_admin'] },
  { label: 'Batch progress', icon: 'bi-graph-up-arrow', link: '/admin/batch-progress', roles: ['admin', 'super_admin'] },
  { label: 'Exams (SSC, ...)', icon: 'bi-award', link: '/admin/exams', roles: ['admin', 'super_admin'] },
  { label: 'Tests', icon: 'bi-clipboard-check', link: '/admin/tests', roles: ['admin', 'super_admin'] },
  { label: 'Batches', icon: 'bi-people', link: '/admin/batches', roles: ['admin', 'super_admin'] },
  { label: 'Students', icon: 'bi-mortarboard', link: '/admin/students', roles: ['admin', 'super_admin'] },
  { label: 'Users', icon: 'bi-people-fill', link: '/admin/users', roles: ['admin', 'super_admin'] },
  { label: 'Activity log', icon: 'bi-clock-history', link: '/admin/activity', roles: ['super_admin'] },
  { label: 'Platform settings', icon: 'bi-gear', link: '/admin/settings', roles: ['super_admin'] },
  { label: 'My profile', icon: 'bi-person-circle', link: '/admin/profile', roles: ['admin', 'super_admin'] },
  { label: 'Dashboard', icon: 'bi-speedometer2', link: '/student/dashboard', roles: ['student'] },
  { label: 'My preparation', icon: 'bi-mortarboard', link: '/student/prepare', roles: ['student'] },
  { label: 'All tests', icon: 'bi-clipboard-check', link: '/student/tests', roles: ['student'] },
  { label: 'Practice', icon: 'bi-lightning-charge', link: '/student/practice', roles: ['student'] },
  { label: 'Test series', icon: 'bi-collection', link: '/student/series', roles: ['student'] },
  { label: 'Study notes', icon: 'bi-journal-text', link: '/student/notes', roles: ['student'] },
  { label: 'Study plan', icon: 'bi-calendar-check', link: '/student/plan', roles: ['student'] },
  { label: 'Revise', icon: 'bi-card-text', link: '/student/revise', roles: ['student'] },
  { label: 'Listen and revise', icon: 'bi-headphones', link: '/student/listen', roles: ['student'] },
  { label: 'Saved questions', icon: 'bi-bookmarks', link: '/student/saved', roles: ['student'] },
  { label: 'My attempts', icon: 'bi-clock-history', link: '/student/attempts', roles: ['student'] },
  { label: 'My ranks', icon: 'bi-trophy', link: '/student/ranks', roles: ['student'] },
  { label: 'My doubts', icon: 'bi-patch-question', link: '/student/doubts', roles: ['student'] },
  { label: 'My profile', icon: 'bi-person-circle', link: '/student/profile', roles: ['student'] },
];

/** Shared responsive frame: sidebar + top bar. Used by both the admin and student areas. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ReactiveFormsModule, NotificationBell, FeedbackButton, PopupHost],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
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
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The sidebar on small screens, where it slides over the page. */
  navOpen = signal(false);
  menuOpen = signal(false);
  searchOpen = signal(false);

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

    // Close the sidebar after navigating on small screens.
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.navOpen.set(false);
    });
  }

  /** A click outside a pop-up closes it; Escape closes all of them. */
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent) {
    const target = event.target as Element | null;
    if (!target || !this.host.nativeElement.contains(target)) return;
    if (!target.closest('.account')) this.menuOpen.set(false);
    if (!target.closest('.search')) this.searchOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape() {
    this.menuOpen.set(false);
    this.searchOpen.set(false);
    this.navOpen.set(false);
  }

  open(link: string) {
    this.searchOpen.set(false);
    this.query.setValue('', { emitEvent: false });
    this.results.set(NO_RESULTS);
    this.searched.set(false);
    this.router.navigateByUrl(link);
  }

  logout() {
    this.auth.logout();
  }
}
