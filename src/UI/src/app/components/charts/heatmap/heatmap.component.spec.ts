import { TestBed } from '@angular/core/testing';
import { HeatmapComponent, HeatmapData, heatLevel } from './heatmap.component';

describe('heatLevel', () => {
  it('is 0 for nothing and 1–4 by share of the maximum', () => {
    expect(heatLevel(0, 8)).toBe(0);
    expect(heatLevel(1, 8)).toBe(1);
    expect(heatLevel(4, 8)).toBe(2);
    expect(heatLevel(8, 8)).toBe(4);
    expect(heatLevel(3, 0)).toBe(0);
  });
});

describe('HeatmapComponent', () => {
  const data: HeatmapData = {
    rowLabels: ['Mon', 'Tue'],
    columnLabels: ['13:00', '14:00'],
    cells: [
      [
        { value: 4, title: 'Monday at 13:00: 4 scholars' },
        { value: 0, title: 'Monday at 14:00: 0 scholars' },
      ],
      [null, { value: 1, title: 'Tuesday at 14:00: 1 scholar' }],
    ],
  };

  const create = (heatmap: HeatmapData) => {
    const fixture = TestBed.createComponent(HeatmapComponent);
    fixture.componentRef.setInput('data', heatmap);
    fixture.componentRef.setInput('showValues', true);
    fixture.detectChanges();
    return fixture;
  };

  it('draws a cell per value, a gap for null, and prints the values', () => {
    const element: HTMLElement = create(data).nativeElement;

    expect(element.querySelectorAll('.cell:not(.blank)')).toHaveLength(3);
    expect(element.querySelectorAll('.cell.blank')).toHaveLength(1);
    expect(element.querySelector('.cell.level-4')?.textContent).toBe('4');
  });

  it('reads out the hovered cell', () => {
    const fixture = create(data);
    const cell: HTMLElement = fixture.nativeElement.querySelector('.level-4');

    cell.dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.heatmap-readout').textContent,
    ).toContain('Monday at 13:00: 4 scholars');
  });

  it('shows the empty message when every value is zero', () => {
    const element: HTMLElement = create({
      ...data,
      cells: [[{ value: 0, title: 'x' }]],
    }).nativeElement;

    expect(element.textContent).toContain('No data yet.');
  });
});
