/** Helpers for "how old is this question": the date presets used when picking questions for a test. */

export interface AgePreset {
  value: string;
  label: string;
}

export const AGE_PRESETS: AgePreset[] = [
  { value: '', label: 'Any date' },
  { value: '6m', label: 'Last 6 months' },
  { value: '1y', label: 'Last 1 year' },
  { value: '2y', label: 'Last 2 years' },
  { value: 'older2y', label: 'Older than 2 years' },
];

/** The age after which a question is flagged as old in the test builder. */
export const OLD_AFTER_YEARS = 2;

function iso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's date in the browser's time zone as YYYY-MM-DD. */
export function today(now = new Date()): string {
  return iso(now);
}

function monthsAgo(n: number, now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth() - n, now.getDate());
  return iso(d);
}

/** The date_from / date_to filter for a preset ('' = no filter). */
export function ageRange(preset: string, now = new Date()): { date_from?: string; date_to?: string } {
  switch (preset) {
    case '6m':
      return { date_from: monthsAgo(6, now) };
    case '1y':
      return { date_from: monthsAgo(12, now) };
    case '2y':
      return { date_from: monthsAgo(24, now) };
    case 'older2y':
      return { date_to: monthsAgo(24, now) };
    default:
      return {};
  }
}

/** True for a question dated more than OLD_AFTER_YEARS ago. A question with no date is not called old. */
export function isOld(date: string | null | undefined, now = new Date()): boolean {
  if (!date) return false;
  return date < monthsAgo(OLD_AFTER_YEARS * 12, now);
}

/** "3 months ago", "1 year ago": a short age for a date, or '' if there is none. */
export function ageLabel(date: string | null | undefined, now = new Date()): string {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  const months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m) - (now.getDate() < d ? 1 : 0);
  if (months < 1) return 'this month';
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}
