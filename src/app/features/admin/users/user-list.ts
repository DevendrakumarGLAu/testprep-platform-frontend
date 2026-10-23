import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth.service';
import { Page, Role, User, apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { ConfirmDialog } from '../../../shared/confirm-dialog';
import { ResetPasswordDialog } from './reset-password-dialog';
import { UserDialog } from './user-dialog';

@Component({
  selector: 'app-user-list',
  imports: [
    ReactiveFormsModule, MatTableModule, MatPaginatorModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatProgressBarModule,
  ],
  styles: `
    .head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .filters { display: flex; gap: 12px; flex-wrap: wrap; }
    .filters mat-form-field { min-width: 200px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; }
    .inactive { color: var(--mat-sys-error); }
    .empty { padding: 24px; text-align: center; color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <div class="head">
      <h1>Users</h1>
      <button mat-flat-button (click)="openDialog(null)"><mat-icon>add</mat-icon> New user</button>
    </div>
    <div class="filters">
      <mat-form-field appearance="outline">
        <mat-label>Search</mat-label>
        <input matInput [formControl]="search" placeholder="Name, username or email" />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>
      @if (isSuper()) {
        <mat-form-field appearance="outline">
          <mat-label>Role</mat-label>
          <mat-select [value]="role()" (selectionChange)="role.set($event.value); pageIndex.set(0)">
            <mat-option value="">All</mat-option>
            <mat-option value="super_admin">Super Admin</mat-option>
            <mat-option value="admin">Admin</mat-option>
            <mat-option value="student">Student</mat-option>
          </mat-select>
        </mat-form-field>
      }
      <mat-form-field appearance="outline">
        <mat-label>Status</mat-label>
        <mat-select [value]="status()" (selectionChange)="status.set($event.value); pageIndex.set(0)">
          <mat-option value="">All</mat-option>
          <mat-option value="true">Active</mat-option>
          <mat-option value="false">Inactive</mat-option>
        </mat-select>
      </mat-form-field>
    </div>

    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    <div class="table-wrap">
      <table mat-table [dataSource]="rows()">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Name</th>
          <td mat-cell *matCellDef="let u">{{ (u.first_name + ' ' + u.last_name).trim() || u.username }}</td>
        </ng-container>
        <ng-container matColumnDef="username">
          <th mat-header-cell *matHeaderCellDef>Username</th>
          <td mat-cell *matCellDef="let u">{{ u.username }}</td>
        </ng-container>
        <ng-container matColumnDef="email">
          <th mat-header-cell *matHeaderCellDef>Email</th>
          <td mat-cell *matCellDef="let u">{{ u.email }}</td>
        </ng-container>
        <ng-container matColumnDef="role">
          <th mat-header-cell *matHeaderCellDef>Role</th>
          <td mat-cell *matCellDef="let u">{{ roleLabel(u.role) }}</td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let u"><span [class.inactive]="!u.is_active">{{ u.is_active ? 'Active' : 'Inactive' }}</span></td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let u">
            <button mat-icon-button (click)="openDialog(u)" aria-label="Edit user"><mat-icon>edit</mat-icon></button>
            @if (u.id !== auth.user()?.id) {
              <button mat-icon-button (click)="resetPassword(u)" aria-label="Reset password"><mat-icon>lock_reset</mat-icon></button>
              <button mat-icon-button (click)="toggleActive(u)" [attr.aria-label]="u.is_active ? 'Deactivate user' : 'Activate user'">
                <mat-icon>{{ u.is_active ? 'person_off' : 'person_add' }}</mat-icon>
              </button>
            }
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
      @if (!loading() && rows().length === 0) { <div class="empty">No users match your filters.</div> }
    </div>
    <mat-paginator
      [length]="total()" [pageIndex]="pageIndex()" [pageSize]="pageSize()"
      [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" showFirstLastButtons />
  `,
})
export class UserList {
  auth = inject(AuthService);
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

  columns = ['name', 'username', 'email', 'role', 'status', 'actions'];
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

  onPage(e: PageEvent) {
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
