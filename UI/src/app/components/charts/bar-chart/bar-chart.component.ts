import { Component, computed, input, signal } from '@angular/core';
import { formatTick, niceMax } from '../../../utils/chart-scale';

export interface BarChartPoint {
  key: string;
  label: string;
  value: number;
  // Present only for a two-series (stacked) chart.
  value2?: number;
}

interface BarSegment {
  y: number;
  height: number;
  series: 'a' | 'b';
  rounded: boolean;
}

interface TooltipRow {
  label: string;
  value: string;
  series: 'a' | 'b';
}

export interface BarViewModel {
  key: string;
  label: string;
  x: number;
  bandX: number;
  total: number;
  segments: BarSegment[];
  tooltipRows: TooltipRow[];
  labelTop: number | null;
  labelText: string;
}

const BAND_WIDTH = 40;
const BAR_WIDTH = 22;
const PLOT_HEIGHT = 160;
const TOP_PADDING = 28;
const AXIS_HEIGHT = 24;
// A label longer than this doesn't fit horizontally in one band at the
// default width without colliding with its neighbors (e.g. school names) —
// tip it on its side instead, like a normal chart's category axis.
const ROTATE_LABEL_THRESHOLD = 10;
const ROTATED_AXIS_HEIGHT = 64;
// Left margin reserved for the y-axis tick labels ("0", "50", "1.2k", ...) so
// the first bar — painted after them — doesn't cover them. Also wide enough
// that a rotated x-axis label on the first bar (which trails up and to the
// left from its tick) doesn't get clipped by the SVG's left edge.
const LEFT_PADDING = 24;
const SEGMENT_GAP = 2;
const MIN_CHART_WIDTH = 320;

// Bar / stacked-bar chart, rendered as inline SVG using the app's own design
// tokens (cyan-main = series a, orange-text = series b — the only two colors
// from styles.css that pass the dataviz categorical checks at full-size fill:
// see the Charts feature note in ai_docs/angular-frontend.md).
@Component({
  selector: 'app-bar-chart',
  imports: [],
  templateUrl: './bar-chart.component.html',
  styleUrl: './bar-chart.component.css',
})
export class BarChartComponent {
  readonly points = input.required<BarChartPoint[]>();
  readonly series1Label = input.required<string>();
  readonly series2Label = input<string | null>(null);
  readonly formatValue = input<(value: number) => string>((value) =>
    String(value),
  );
  readonly emptyMessage = input('No data for this period.');

  readonly hoveredKey = signal<string | null>(null);

  readonly plotHeight = PLOT_HEIGHT;
  readonly axisY = TOP_PADDING + PLOT_HEIGHT;

  readonly hasData = computed(() =>
    this.points().some((p) => p.value + (p.value2 ?? 0) > 0),
  );

  readonly rotateLabels = computed(() =>
    this.points().some((p) => p.label.length > ROTATE_LABEL_THRESHOLD),
  );

  readonly svgHeight = computed(
    () =>
      PLOT_HEIGHT +
      TOP_PADDING +
      (this.rotateLabels() ? ROTATED_AXIS_HEIGHT : AXIS_HEIGHT),
  );

  private readonly leftPadding = computed(() => LEFT_PADDING);

  readonly svgWidth = computed(() =>
    Math.max(
      this.points().length * BAND_WIDTH + this.leftPadding(),
      MIN_CHART_WIDTH,
    ),
  );

  private readonly niceMaxValue = computed(() =>
    niceMax(
      Math.max(0, ...this.points().map((p) => p.value + (p.value2 ?? 0))),
    ),
  );

  readonly gridLines = computed(() => {
    const max = this.niceMaxValue();
    return [0, 0.5, 1].map((fraction) => ({
      y: TOP_PADDING + PLOT_HEIGHT * (1 - fraction),
      label: formatTick(max * fraction),
    }));
  });

  readonly bars = computed<BarViewModel[]>(() => {
    const max = this.niceMaxValue();
    const pts = this.points();
    const formatter = this.formatValue();
    const series1 = this.series1Label();
    const series2 = this.series2Label();
    const leftPadding = this.leftPadding();
    const maxTotal = Math.max(0, ...pts.map((p) => p.value + (p.value2 ?? 0)));

    return pts.map((point, index) => {
      const total = point.value + (point.value2 ?? 0);
      const bandX = index * BAND_WIDTH + leftPadding;
      const x = bandX + (BAND_WIDTH - BAR_WIDTH) / 2;

      // Fixed stack order, never swapped: series b (bottom) under series a (top).
      const raw = (
        [
          { value: point.value2 ?? 0, series: 'b' as const },
          { value: point.value, series: 'a' as const },
        ] satisfies { value: number; series: 'a' | 'b' }[]
      ).filter((entry) => entry.value > 0);

      const gap = raw.length === 2 ? SEGMENT_GAP : 0;
      let cursor = this.axisY;
      const segments: BarSegment[] = raw.map((entry, i) => {
        const height = (entry.value / max) * PLOT_HEIGHT;
        cursor -= height;
        const segment: BarSegment = {
          y: cursor,
          height,
          series: entry.series,
          rounded: i === raw.length - 1,
        };
        cursor -= i < raw.length - 1 ? gap : 0;
        return segment;
      });

      const tooltipRows: TooltipRow[] =
        point.value2 === undefined
          ? [{ label: series1, value: formatter(point.value), series: 'a' }]
          : [
              { label: series1, value: formatter(point.value), series: 'a' },
              {
                label: series2 ?? '',
                value: formatter(point.value2),
                series: 'b',
              },
            ];

      const isMax = total === maxTotal && total > 0;

      return {
        key: point.key,
        label: point.label,
        x,
        bandX,
        total,
        segments,
        tooltipRows,
        labelTop: isMax ? (segments.at(-1)?.y ?? null) : null,
        labelText: formatter(total),
      };
    });
  });

  readonly hoveredBar = computed(() => {
    const key = this.hoveredKey();
    return key ? (this.bars().find((b) => b.key === key) ?? null) : null;
  });

  setHovered(key: string): void {
    this.hoveredKey.set(key);
  }

  clearHovered(key: string): void {
    if (this.hoveredKey() === key) this.hoveredKey.set(null);
  }

  barWidth = BAR_WIDTH;
  bandWidth = BAND_WIDTH;
}
