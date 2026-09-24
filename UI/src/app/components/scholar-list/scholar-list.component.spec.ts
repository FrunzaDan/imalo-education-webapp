import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ScholarListComponent } from './scholar-list.component';
import { ScholarService } from '../../services/scholar.service';
import { SchoolService } from '../../services/school.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { NotificationService } from '../../services/notification.service';
import type { Scholar } from '../../interfaces/scholar';
import type { School } from '../../interfaces/school';

const SCHOOL: School = {
  schoolId: 1,
  name: 'Scoala 1',
  color: '#000000',
  lunchPrice: 15,
  transportPrice: 10,
};

const buildScholar = (overrides: Partial<Scholar> = {}): Scholar => ({
  scholarId: 'scholar-1',
  firstName: 'Ana',
  lastName: 'Popescu',
  pickupSchedule: null,
  schoolId: 1,
  grade: 3,
  birthDate: '2018-05-01',
  motherFirstName: null,
  motherLastName: null,
  motherPhoneNumber: null,
  fatherFirstName: null,
  fatherLastName: null,
  fatherPhoneNumber: null,
  ...overrides,
});

const ANA = buildScholar();
const BOGDAN = buildScholar({
  scholarId: 'scholar-2',
  firstName: 'Bogdan',
  grade: 1,
  schoolId: null,
});

async function setup(
  options: { scholars?: Scholar[]; loadError?: boolean } = {},
) {
  const getScholars = vi.fn(() =>
    options.loadError
      ? throwError(
          () =>
            new HttpErrorResponse({ status: 500, statusText: 'Server Error' }),
        )
      : of(options.scholars ?? [ANA, BOGDAN]),
  );
  const deleteScholarSilently = vi.fn(() => of(undefined));
  const confirm = vi.fn(() => Promise.resolve(true));
  const show = vi.fn();

  TestBed.configureTestingModule({
    imports: [ScholarListComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      {
        provide: ScholarService,
        useValue: { getScholars, deleteScholarSilently },
      },
      { provide: SchoolService, useValue: { getSchools: () => of([SCHOOL]) } },
      { provide: ConfirmDialogService, useValue: { confirm } },
      { provide: NotificationService, useValue: { show } },
    ],
  });

  const fixture = TestBed.createComponent(ScholarListComponent);
  await fixture.whenStable();

  return {
    fixture,
    component: fixture.componentInstance,
    getScholars,
    deleteScholarSilently,
    show,
  };
}

describe('ScholarListComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows one row per scholar, with the school joined in', async () => {
    const { component } = await setup();

    expect(component.loading()).toBe(false);
    expect(component.sortedRows().map((s) => [s.name, s.schoolName])).toEqual([
      ['Ana Popescu', 'Scoala 1'],
      ['Bogdan Popescu', 'Unknown'],
    ]);
  });

  it('shows the load error instead of the table', async () => {
    const { fixture, component } = await setup({ loadError: true });
    const el: HTMLElement = fixture.nativeElement;

    expect(component.loadError()).toBe(
      'Failed to load scholars (500). Please try again.',
    );
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Failed to load scholars',
    );
    expect(el.querySelector('table')).toBeNull();
  });

  it('sorts by a column, and reverses it when the same column is clicked again', async () => {
    const { component } = await setup();

    component.setSort('grade');
    expect(component.sortedRows().map((s) => s.grade)).toEqual([1, 3]);

    component.setSort('grade');
    expect(component.sortedRows().map((s) => s.grade)).toEqual([3, 1]);
    expect(component.sortDirection()).toBe('desc');
  });

  it('sorts birth dates chronologically, not by their display text', async () => {
    const { component } = await setup({
      scholars: [
        buildScholar({ scholarId: 'a', birthDate: '2017-12-01' }),
        buildScholar({ scholarId: 'b', birthDate: '2018-02-01' }),
      ],
    });

    component.setSort('birthDate');

    expect(component.sortedRows().map((s) => s.scholarId)).toEqual(['a', 'b']);
  });

  it('sorts from a header button and reports the sort on the header', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    const gradeHeader = Array.from(el.querySelectorAll('th')).find((th) =>
      th.textContent?.includes('Grade'),
    )!;

    expect(gradeHeader.getAttribute('aria-sort')).toBe('none');

    gradeHeader.querySelector('button')!.click();
    await fixture.whenStable();

    expect(gradeHeader.getAttribute('aria-sort')).toBe('ascending');
    expect(el.querySelector('caption')?.textContent).toContain(
      'sorted by grade ascending',
    );
  });

  it('links each scholar by name and announces the result count', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    const link = el.querySelector<HTMLAnchorElement>('tbody a')!;

    expect(link.textContent?.trim()).toBe('Ana Popescu');
    expect(link.getAttribute('href')).toBe('/scholars/scholar-1');
    expect(el.querySelector('[role="status"]')?.textContent).toContain(
      '2 scholars found',
    );
  });

  it('filters the displayed rows by the search term', async () => {
    const { component } = await setup();

    component.searchForm.term().value.set('bog');

    expect(component.visibleRows().map((s) => s.name)).toEqual([
      'Bogdan Popescu',
    ]);
  });

  it('deletes the selected scholars, reloads the list and clears the selection', async () => {
    const { fixture, component, getScholars, deleteScholarSilently, show } =
      await setup();
    component.toggleSelection(ANA.scholarId, true);
    getScholars.mockReturnValue(of([BOGDAN]));

    await component.bulkDeleteSelected();
    await fixture.whenStable();

    expect(deleteScholarSilently).toHaveBeenCalledWith(ANA.scholarId);
    expect(show).toHaveBeenCalledWith('Deleted 1 scholar.', 'success');
    expect(getScholars).toHaveBeenCalledTimes(2);
    expect(component.sortedRows().map((s) => s.scholarId)).toEqual([
      BOGDAN.scholarId,
    ]);
    expect(component.selectedScholarIds().size).toBe(0);
  });
});
