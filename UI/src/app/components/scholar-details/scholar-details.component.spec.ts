import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ScholarDetailsComponent } from './scholar-details.component';
import { ScholarService } from '../../services/scholar.service';
import { SchoolService } from '../../services/school.service';
import { AuditLogService } from '../../services/audit-log.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import type { Scholar } from '../../interfaces/scholar';
import type { School } from '../../interfaces/school';

const SCHOLAR: Scholar = {
  scholarId: 'scholar-1',
  firstName: 'Ana',
  lastName: 'Popescu',
  pickupSchedule: null,
  schoolId: 1,
  grade: 3,
  birthDate: '2016-01-01',
  motherFirstName: null,
  motherLastName: null,
  motherPhoneNumber: null,
  fatherFirstName: null,
  fatherLastName: null,
  fatherPhoneNumber: null,
};
const SCHOOL: School = {
  schoolId: 1,
  name: 'Test School',
  color: '#336699',
  lunchPrice: 15,
  transportPrice: 10,
};

async function setup(
  options: {
    scholar?: Scholar;
    loadError?: boolean;
    deleteError?: boolean;
    confirmed?: boolean;
  } = {},
) {
  const getScholar = vi.fn(() =>
    options.loadError
      ? throwError(
          () =>
            new HttpErrorResponse({
              status: 404,
              error: {
                status: 404,
                title: 'Scholar not found.',
                detail: 'Scholar with ID scholar-1 not found.',
              },
            }),
        )
      : of(options.scholar ?? SCHOLAR),
  );
  const getSchool = vi.fn(() => of(SCHOOL));
  const loadAuditLog = vi.fn();
  const deleteScholar = vi.fn(() =>
    options.deleteError
      ? throwError(() => new HttpErrorResponse({ status: 0 }))
      : of(undefined),
  );
  const confirm = vi.fn().mockResolvedValue(options.confirmed ?? true);

  TestBed.configureTestingModule({
    imports: [ScholarDetailsComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: ScholarService, useValue: { getScholar, deleteScholar } },
      { provide: SchoolService, useValue: { getSchool } },
      {
        provide: AuditLogService,
        useValue: {
          entries: () => [],
          loading: () => false,
          error: () => null,
          loadAuditLog,
        },
      },
      { provide: ConfirmDialogService, useValue: { confirm } },
    ],
  });

  const fixture = TestBed.createComponent(ScholarDetailsComponent);
  fixture.componentRef.setInput('scholarId', 'scholar-1');
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return {
    fixture,
    component: fixture.componentInstance,
    getScholar,
    getSchool,
    loadAuditLog,
    deleteScholar,
    confirm,
  };
}

describe('ScholarDetailsComponent', () => {
  it('loads the scholar by the bound id, then its school, and the audit log', async () => {
    const { component, getScholar, getSchool, loadAuditLog, fixture } =
      await setup();

    expect(getScholar).toHaveBeenCalledWith('scholar-1');
    expect(getSchool).toHaveBeenCalledWith(1);
    expect(loadAuditLog).toHaveBeenCalledWith('scholar-1');
    expect(component.scholar()).toEqual(SCHOLAR);
    expect(component.school()).toEqual(SCHOOL);
    expect(fixture.nativeElement.textContent).toContain('Test School');
  });

  it('does not look up a school when the scholar has none', async () => {
    const { component, getSchool } = await setup({
      scholar: { ...SCHOLAR, schoolId: null },
    });

    expect(component.scholar()).not.toBeNull();
    expect(getSchool).not.toHaveBeenCalled();
    expect(component.school()).toBeNull();
  });

  it('shows the load error instead of "Loading…" forever when the scholar fails to load', async () => {
    const { component, fixture, getSchool } = await setup({
      loadError: true,
    });

    expect(component.scholar()).toBeNull();
    expect(component.loadError()).toBe('Scholar with ID scholar-1 not found.');
    expect(
      fixture.nativeElement.querySelector('[role="alert"]')?.textContent,
    ).toContain('Scholar with ID scholar-1 not found.');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Loading scholar details',
    );
    expect(getSchool).not.toHaveBeenCalled();
  });

  it('sends the user to the update page for this scholar', async () => {
    const { component } = await setup();
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);

    component.navigateToUpdateScholar();

    expect(navigate).toHaveBeenCalledWith(['/scholars/update', 'scholar-1']);
  });

  describe('deleteScholar', () => {
    it('asks first, then deletes and returns to the scholar list', async () => {
      const { component, deleteScholar, confirm } = await setup();
      const navigate = vi
        .spyOn(TestBed.inject(Router), 'navigate')
        .mockResolvedValue(true);

      await component.deleteScholar();

      expect(confirm).toHaveBeenCalledWith(
        expect.stringContaining('Ana Popescu'),
        expect.objectContaining({ variant: 'danger' }),
      );
      expect(deleteScholar).toHaveBeenCalledWith('scholar-1');
      expect(navigate).toHaveBeenCalledWith(['/scholars']);
    });

    it('does nothing when the user cancels', async () => {
      const { component, deleteScholar } = await setup({ confirmed: false });

      await component.deleteScholar();

      expect(deleteScholar).not.toHaveBeenCalled();
    });

    it('shows the failure inline and stays on the page', async () => {
      const { component, fixture } = await setup({ deleteError: true });
      const navigate = vi
        .spyOn(TestBed.inject(Router), 'navigate')
        .mockResolvedValue(true);

      await component.deleteScholar();
      fixture.detectChanges();

      expect(component.deleteError()).toBe(
        'Could not reach the server. It may be offline, or your browser may not trust its security certificate.',
      );
      expect(component.deleting()).toBe(false);
      expect(
        fixture.nativeElement.querySelector('.app-alert')?.textContent,
      ).toContain('Could not reach the server');
      expect(navigate).not.toHaveBeenCalled();
    });
  });
});
