import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth.service';
import { Page, Role, User, apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { BsPager, PageChange } from '../../../shared/bs-pager/bs-pager';
import { ConfirmDialog } from '../../../shared/confirm-dialog';
import { ResetPasswordDialog } from './reset-password-dialog';
import { UserDialog } from './user-dialog';

@Component({
  selector: 'app-user-list',
  imports: [ReactiveFormsModule, BsPager],
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss',
  host: { class: 'bs' },
})
export class UserList {
  auth = inject(AuthService);
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

  isSuper = computed(() => this.auth.role() === 'super_admin');

  search = new FormControl('', { nonNullable: true });
  private searchTerm = toSignal(this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged()), { initialValue: '' });
  role = signal('');
  status = signal('');
  pageIndex = signal(0);
  pageSize = signal(20);
  reload = signal(0);

  loading = signal(true);
  total = signal(0);
  rows = signal<User[]>([]);

  constructor() {
    // Any change to a filter, page or the reload counter refetches; a new search resets the page.
    const query = computed(() => ({
      search: this.searchTerm(), role: this.role(), status: this.status(),
      page: this.pageIndex(), size: this.pageSize(), r: this.reload(),
    }));
    toObservable(query)
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap((q) => {
          let params = new HttpParams().set('page', q.page + 1).set('page_size', q.size);
          if (q.search) params = params.set('search', q.search);
          if (q.role) params = params.set('role', q.role);
          if (q.status) params = params.set('is_active', q.status);
          return this.http.get<Page<User>>(`${environment.apiUrl}/users/`, { params });
        }),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (p) => {
          this.rows.set(p.results);
          this.total.set(p.count);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.notify.error(apiErrorMessage(err));
        },
      });
    this.search.valueChanges.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.pageIndex.set(0));
  }

  roleLabel(r: Role) {
    return { super_admin: 'Super Admin', admin: 'Admin', student: 'Student' }[r];
  }

  onPage(e: PageChange) {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  openDialog(user: User | null) {
    const allowedRoles: Role[] = this.isSuper() ? ['super_admin', 'admin', 'student'] : ['student'];
    this.dialog
      .open(UserDialog, { data: { user, allowedRoles } })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.notify.success(user ? 'User updated' : 'User created');
          this.reload.update((n) => n + 1);
        }
      });
  }

  resetPassword(u: User) {
    this.dialog.open(ResetPasswordDialog, {
      data: { id: u.id, username: u.username, name: `${u.first_name} ${u.last_name}`.trim() || u.username },
      width: '460px', maxWidth: '95vw',
    });
  }

  toggleActive(u: User) {
    const deactivate = u.is_active;
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: deactivate ? 'Deactivate user?' : 'Activate user?',
          message: deactivate
            ? `${u.username} will no longer be able to sign in. Their data is kept.`
            : `${u.username} will be able to sign in again.`,
          confirmLabel: deactivate ? 'Deactivate' : 'Activate',
        },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        const url = `${environment.apiUrl}/users/${u.id}/`;
        const req = deactivate ? this.http.delete(url) : this.http.post(`${url}activate/`, {});
        req.subscribe({
          next: () => {
            this.notify.success(deactivate ? 'User deactivated' : 'User activated');
            this.reload.update((n) => n + 1);
          },
          error: (err) => this.notify.error(apiErrorMessage(err)),
        });
      });
  }
}
