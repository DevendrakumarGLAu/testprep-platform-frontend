import { TestBed } from '@angular/core/testing';
import { Sparkline } from './sparkline';

function render(values: number[], extra: Partial<{ min: number; max: number }> = {}) {
  const f = TestBed.createComponent(Sparkline);
  f.componentRef.setInput('values', values);
  if (extra.min !== undefined) f.componentRef.setInput('min', extra.min);
  if (extra.max !== undefined) f.componentRef.setInput('max', extra.max);
  f.detectChanges();
  return f;
}

describe('Sparkline', () => {
  it('says there is no data for an empty list', () => {
    expect(render([]).nativeElement.textContent).toContain('No data');
  });

  it('draws a line through every value, rising values going up the picture', () => {
    const f = render([10, 50, 90], { min: 0, max: 100 });
    const pts = (f.nativeElement.querySelector('polyline').getAttribute('points') as string).split(' ').map((p) => p.split(',').map(Number));
    expect(pts.length).toBe(3);
    expect(pts[0][1]).toBeGreaterThan(pts[1][1]); // a bigger y is lower on the page
    expect(pts[1][1]).toBeGreaterThan(pts[2][1]);
    expect(pts[0][0]).toBeLessThan(pts[2][0]);
  });

  it('draws only a dot for a single value', () => {
    const f = render([70]);
    expect(f.nativeElement.querySelector('polyline')).toBeNull();
    expect(f.nativeElement.querySelector('circle')).not.toBeNull();
  });

  it('does not break when every value is the same', () => {
    const pts = render([60, 60, 60]).nativeElement.querySelector('polyline').getAttribute('points') as string;
    expect(pts).not.toContain('NaN');
  });

  it('describes itself for screen readers', () => {
    expect(render([20, 80]).nativeElement.querySelector('svg').getAttribute('aria-label')).toBe('Trend of 2 values, from 20 to 80');
  });
});
