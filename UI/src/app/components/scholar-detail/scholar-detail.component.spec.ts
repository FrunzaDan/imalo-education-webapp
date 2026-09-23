import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ScholarDetailComponent } from './scholar-detail.component';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { AuditLogService } from '../../services/audit-log.service';
import { ConfirmModalService } from '../../services/confirm-modal.service';
import { NotificationService } from '../../services/notification.service';
import type { Scholar } from '../../interfaces/scholar';
import type { School } from '../../interfaces/school';

// Covers the id-input + rxResource loading: scholar by id, then its school, plus the
// audit-log load, and the failure / no-school paths.

const SCHOLAR: Scholar = {
  scholarId: 'scholar-1',
  firstName: 'Ana',
  lastName: 'Popescu',
  pickupSchedule: null,
  schoolId: 1,
  grade: 3,
  birthDate: '2016-01-01',
};
const SCHOOL: School = { schoolId: 1, name: 'Test School', color: '#336699', lunchPrice: 15, transportPrice: 10 };

async function setup(options: { scholar?: Scholar; loadError?: boolean } = {}) {
  const getScholarById = vi.fn(() =>
    options.loadError
      ? throwError(() => new Error('getScholarById id=scholar-1 failed: Scholar not found.'))
      : of(options.scholar ?? SCHOLAR),
  );
  const getSchoolById = vi.fn(() => of(SCHOOL));
  const loadAuditLog = vi.fn();

  TestBed.configureTestingModule({
    imports: [ScholarDetailComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: ScholarsService, useValue: { getScholarById } },
      { provide: SchoolsService, useValue: { getSchoolById } },
      {
        provide: AuditLogService,
        useValue: { entries: () => [], loading: () => false, error: () => null, loadAuditLog },
      },
      { provide: ConfirmModalService, useValue: { confirm: vi.fn() } },
      { provide: NotificationService, useValue: { show: vi.fn() } },
    ],
  });

  const fixture = TestBed.createComponent(ScholarDetailComponent);
  fixture.componentRef.setInput('scholarId', 'scholar-1');
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, getScholarById, getSchoolById, loadAuditLog };
}

describe('ScholarDetailComponent', () => {
  it('loads the scholar by the bound id, then its school, and the audit log', async () => {
    const { component, getScholarById, getSchoolById, loadAuditLog, fixture } = await setup();

    expect(getScholarById).toHaveBeenCalledWith('scholar-1');
    expect(getSchoolById).toHaveBeenCalledWith(1);
    expect(loadAuditLog).toHaveBeenCalledWith('scholar-1');
    expect(component.scholar()).toEqual(SCHOLAR);
    expect(component.school()).toEqual(SCHOOL);
    expect(fixture.nativeElement.textContent).toContain('Test School');
  });

  it('does not look up a school when the scholar has none', async () => {
    const { component, getSchoolById } = await setup({ scholar: { ...SCHOLAR, schoolId: null } });

    expect(component.scholar()).not.toBeNull();
    expect(getSchoolById).not.toHaveBeenCalled();
    expect(component.school()).toBeNull();
  });

  it('shows the load error instead of "Loading…" forever when the scholar fails to load', async () => {
    const { component, fixture, getSchoolById } = await setup({ loadError: true });

    expect(component.scholar()).toBeNull();
    expect(component.loadError()).toContain('Scholar not found');
    expect(fixture.nativeElement.textContent).toContain('Failed to load scholar.');
    expect(fixture.nativeElement.textContent).not.toContain('Loading scholar details');
    expect(getSchoolById).not.toHaveBeenCalled();
  });

  it('sends the user to the update page for this scholar', async () => {
    const { component } = await setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    component.navigateToUpdateScholar();

    expect(navigate).toHaveBeenCalledWith(['/scholars/update', 'scholar-1']);
  });
});
