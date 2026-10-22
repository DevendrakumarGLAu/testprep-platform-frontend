import { Component, DestroyRef, ElementRef, effect, inject, input, viewChild } from '@angular/core';
import {
  ArcElement, BarController, BarElement, CategoryScale, Chart, DoughnutController, Filler, Legend, LineController,
  LineElement, LinearScale, PointElement, Tooltip,
} from 'chart.js';

Chart.register(
  BarController, BarElement, LineController, LineElement, PointElement, DoughnutController, ArcElement,
  CategoryScale, LinearScale, Tooltip, Legend, Filler,
);

export interface ChartSeries {
  label: string;
  data: number[];
  color?: string;
}

/**
 * Resolves a CSS custom property to a plain rgb() colour. Material's tokens use light-dark(),
 * which canvas cannot parse, so let the browser compute it on a probe element.
 */
function token(name: string, fallback: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${name}, ${fallback})`;
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || fallback;
}

function withAlpha(color: string, alpha: number): string {
  const n = color.match(/[\d.]+/g);
  return n && n.length >= 3 ? `rgba(${n[0]}, ${n[1]}, ${n[2]}, ${alpha})` : color;
}

/** Thin chart.js wrapper that follows the app's Material colours. */
@Component({
  selector: 'app-chart',
  template: `<div class="box" [style.height.px]="height()"><canvas #canvas role="img" [attr.aria-label]="label()"></canvas></div>`,
  styles: `.box { position: relative; width: 100%; } canvas { max-width: 100%; }`,
})
export class ChartComponent {
  type = input.required<'bar' | 'line' | 'doughnut'>();
  labels = input.required<string[]>();
  series = input.required<ChartSeries[]>();
  label = input('Chart');
  height = input(240);
  horizontal = input(false);
  /** Upper bound for the value axis, e.g. 100 for percentages. */
  max = input<number | undefined>(undefined);

  private canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart;

  constructor() {
    effect(() => {
      const type = this.type();
      const labels = this.labels();
      const series = this.series();
      const horizontal = this.horizontal();
      const max = this.max();
      this.chart?.destroy();

      const primary = token('--mat-sys-primary', '#1a56a0');
      const text = token('--mat-sys-on-surface-variant', '#555');
      const grid = token('--mat-sys-outline-variant', '#ddd');
      const palette = [primary, token('--mat-sys-tertiary', '#2e7d32'), '#e08a00', '#8e24aa', '#00897b', '#c62828'];

      const datasets = series.map((s, i) => {
        const color = s.color ?? palette[i % palette.length];
        return type === 'doughnut'
          ? { label: s.label, data: s.data, backgroundColor: labels.map((_, j) => palette[j % palette.length]) }
          : {
              label: s.label, data: s.data, borderColor: color, backgroundColor: type === 'line' ? withAlpha(color, 0.18) : color,
              fill: type === 'line', tension: 0.3, borderWidth: type === 'line' ? 2 : 0, borderRadius: 4,
              pointRadius: type === 'line' ? 3 : 0,
            };
      });

      this.chart = new Chart(this.canvas().nativeElement, {
        type,
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: horizontal ? 'y' : 'x',
          plugins: { legend: { display: series.length > 1 || type === 'doughnut', labels: { color: text } } },
          scales:
            type === 'doughnut'
              ? {}
              : {
                  x: { grid: { color: horizontal ? grid : 'transparent' }, ticks: { color: text, maxRotation: 0, autoSkip: true },
                       ...(horizontal ? { beginAtZero: true, max } : {}) },
                  y: { grid: { color: horizontal ? 'transparent' : grid }, ticks: { color: text, precision: 0 },
                       ...(horizontal ? {} : { beginAtZero: true, max }) },
                },
        },
      });
    });
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }
}
