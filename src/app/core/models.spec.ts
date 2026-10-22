import { apiErrorMessage, homeRouteFor } from './models';

describe('apiErrorMessage', () => {
  it('uses the DRF detail message', () => {
    expect(apiErrorMessage({ error: { detail: 'Nope.' } })).toBe('Nope.');
  });

  it('flattens field errors', () => {
    const msg = apiErrorMessage({ error: { name: ['Taken.'], non_field_errors: ['Bad combo.'] } });
    expect(msg).toContain('name: Taken.');
    expect(msg).toContain('Bad combo.');
  });

  it('falls back when there is no usable body', () => {
    expect(apiErrorMessage({ error: null }, 'fallback')).toBe('fallback');
    expect(apiErrorMessage({ error: '<html>500</html>' }, 'fallback')).toBe('fallback');
  });
});

describe('homeRouteFor', () => {
  it('maps roles to their area', () => {
    expect(homeRouteFor('student')).toBe('/student');
    expect(homeRouteFor('admin')).toBe('/admin');
    expect(homeRouteFor('super_admin')).toBe('/admin');
    expect(homeRouteFor(undefined)).toBe('/login');
  });
});
