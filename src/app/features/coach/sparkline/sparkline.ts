import { Component, computed, input } from '@angular/core';

/** A tiny line chart (an SVG) for a short list of numbers, such as a student's last few scores. */
@Component({
  selector: 'app-sparkline',
  templateUrl: './sparkline.html',
  styleUrl: './sparkline.scss',
})
export class Sparkline {
  values = input<number[]>([]);
  width = input(110);
  height = input(32);
  /** Fix the scale (for example 0 to 100); by default it fits the numbers given. */
  min = input<number | null>(null);
  max = input<number | null>(null);

  private pad = 3;

  /** Points of the line as "x,y x,y ...". */
  points = computed(() => this.coords().map((p) => `${p.x},${p.y}`).join(' '));

  coords = computed(() => {
    const v = this.values();
    if (!v.length) return [];
    const lo = this.min() ?? Math.min(...v);
    const hi = this.max() ?? Math.max(...v);
    const span = hi - lo || 1;
    const w = this.width() - this.pad * 2;
    const h = this.height() - this.pad * 2;
    return v.map((n, i) => ({
      x: round(this.pad + (v.length === 1 ? w / 2 : (i * w) / (v.length - 1))),
      y: round(this.pad + h - ((n - lo) / span) * h),
    }));
  });

  last = computed(() => this.coords().at(-1) ?? null);

  label = computed(() => `Trend of ${this.values().length} values, from ${this.values()[0] ?? 0} to ${this.values().at(-1) ?? 0}`);
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}
