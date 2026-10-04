import { Component, computed, input, signal } from '@angular/core';

export interface HeatCell {
  value: number;
  title: string;
}

export interface HeatmapData {
  rowLabels: string[];
  columnLabels: string[];
  /** `cells[row][column]`; null leaves a gap (e.g. a day outside the year). */
  cells: (HeatCell | null)[][];
}

interface CellView extends HeatCell {
  level: number;
  column: number;
}

const LEVELS = 4;

/** 0 for nothing, otherwise 1–4 by the value's share of the maximum. */
export function heatLevel(value: number, max: number): number {
  return value <= 0 || max <= 0 ? 0 : Math.ceil((value / max) * LEVELS);
}

@Component({
  selector: 'app-heatmap',
  templateUrl: './heatmap.component.html',
  styleUrl: './heatmap.component.css',
  host: { '[style.--heat-color]': 'color()' },
})
export class HeatmapComponent {
  readonly data = input.required<HeatmapData>();
  readonly color = input('var(--chartColor1)');
  /** Wide cells with the number printed in them, for small grids. */
  readonly showValues = input(false);
  readonly hint = input('Hover a cell for details.');
  readonly ariaLabel = input('Heatmap');
  readonly emptyMessage = input('No data yet.');

  readonly active = signal<string | null>(null);
  readonly levels = Array.from({ length: LEVELS + 1 }, (_, i) => i);

  private readonly max = computed(() =>
    Math.max(
      0,
      ...this.data().cells.flatMap((row) => row.map((c) => c?.value ?? 0)),
    ),
  );

  readonly isEmpty = computed(() => this.max() === 0);

  readonly rows = computed(() => {
    const max = this.max();
    const { rowLabels, cells } = this.data();
    return rowLabels.map((label, row) => ({
      label,
      cells: (cells[row] ?? []).map((cell, column): CellView | null =>
        cell ? { ...cell, level: heatLevel(cell.value, max), column } : null,
      ),
    }));
  });

  setActive(title: string | null): void {
    this.active.set(title);
  }
}
