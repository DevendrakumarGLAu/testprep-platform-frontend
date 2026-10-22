export type Role = 'super_admin' | 'admin' | 'student';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: Role;
  is_active: boolean;
  date_joined: string;
}

export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export function homeRouteFor(role: Role | undefined): string {
  return role === 'student' ? '/student' : role ? '/admin' : '/login';
}

/** Flattens a DRF error body into a single readable message. */
export function apiErrorMessage(err: any, fallback = 'Something went wrong. Please try again.'): string {
  const body = err?.error;
  if (!body) return fallback;
  if (typeof body === 'string') return fallback;
  if (typeof body.detail === 'string') return body.detail;
  const parts: string[] = [];
  for (const [field, val] of Object.entries(body)) {
    const text = Array.isArray(val) ? val.join(' ') : String(val);
    parts.push(field === 'non_field_errors' ? text : `${field}: ${text}`);
  }
  return parts.join(' ') || fallback;
}
