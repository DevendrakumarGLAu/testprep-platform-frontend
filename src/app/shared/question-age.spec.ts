import { AGE_PRESETS, ageLabel, ageRange, isOld, today } from './question-age';

const NOW = new Date(2026, 9, 23); // 23 Oct 2026

describe('question age helpers', () => {
  it('today() is the local date', () => {
    expect(today(NOW)).toBe('2026-10-23');
  });

  it('turns each preset into a date range', () => {
    expect(ageRange('', NOW)).toEqual({});
    expect(ageRange('6m', NOW)).toEqual({ date_from: '2026-04-23' });
    expect(ageRange('1y', NOW)).toEqual({ date_from: '2025-10-23' });
    expect(ageRange('2y', NOW)).toEqual({ date_from: '2024-10-23' });
    expect(ageRange('older2y', NOW)).toEqual({ date_to: '2024-10-23' });
    expect(AGE_PRESETS.map((p) => p.value)).toEqual(['', '6m', '1y', '2y', 'older2y']);
  });

  it('flags questions older than two years, but not undated ones', () => {
    expect(isOld('2024-10-22', NOW)).toBe(true);
    expect(isOld('2024-10-23', NOW)).toBe(false);
    expect(isOld('2026-07-08', NOW)).toBe(false);
    expect(isOld(null, NOW)).toBe(false);
    expect(isOld(undefined, NOW)).toBe(false);
  });

  it('describes the age in words', () => {
    expect(ageLabel('2026-10-10', NOW)).toBe('this month');
    expect(ageLabel('2026-07-08', NOW)).toBe('3 months ago');
    expect(ageLabel('2025-10-23', NOW)).toBe('1 year ago');
    expect(ageLabel('2023-01-05', NOW)).toBe('3 years ago');
    expect(ageLabel(null, NOW)).toBe('');
  });
});
