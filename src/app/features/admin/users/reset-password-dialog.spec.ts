import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { environment } from '../../../../environments/environment';
import { ResetPasswordDialog } from './reset-password-dialog';

describe('ResetPasswordDialog', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: MAT_DIALOG_DATA, useValue: { id: 7, username: 'dan', name: 'Dan' } }],
    });
    const fixture = TestBed.createComponent(ResetPasswordDialog);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  it('asks first and shows nothing secret', () => {
    const { fixture } = setup();
    expect(fixture.nativeElement.textContent).toContain('temporary password');
    expect(fixture.componentInstance.password()).toBe('');
  });

  it('shows the temporary password once it is created', () => {
    const { fixture, http } = setup();
    fixture.componentInstance.reset();
    http.expectOne(`${environment.apiUrl}/users/7/reset-password/`).flush({ temporary_password: 'Abc12345xy', username: 'dan' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Abc12345xy');
    http.verify();
  });

  it('shows the server error', () => {
    const { fixture, http } = setup();
    fixture.componentInstance.reset();
    http.expectOne(`${environment.apiUrl}/users/7/reset-password/`).flush({ detail: 'Not allowed.' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toContain('Not allowed');
    expect(fixture.componentInstance.busy()).toBe(false);
  });
});
