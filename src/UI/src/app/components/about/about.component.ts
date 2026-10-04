import { Component, inject, signal } from '@angular/core';
import { catchError, concatMap, from, map, of, switchMap, toArray } from 'rxjs';
import { ApiLoggerService } from '../../services/api-logger.service';
import { NotificationService } from '../../services/notification.service';
import { ScholarService } from '../../services/scholar.service';
import { AttendanceService } from '../../services/attendance.service';
import { SchoolService } from '../../services/school.service';
import {
  buildRandomAttendance,
  buildRandomScholar,
} from '../../utils/random-scholar';

const TEST_SCHOLAR_COUNT = 20;

@Component({
  selector: 'app-about',
  imports: [],
  templateUrl: './about.component.html',
  styleUrl: './about.component.css',
})
export class AboutComponent {
  private readonly apiLoggerService = inject(ApiLoggerService);
  private readonly notificationService = inject(NotificationService);
  private readonly scholarService = inject(ScholarService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly schoolService = inject(SchoolService);

  readonly apiLoggingEnabled = this.apiLoggerService.enabled;
  readonly addingTestScholars = signal(false);

  toggleApiLogging(): void {
    this.apiLoggerService.toggle();
    this.notificationService.show(
      `API call logging turned ${this.apiLoggingEnabled() ? 'on' : 'off'}.`,
    );
  }

  addTestScholars(): void {
    if (this.addingTestScholars()) {
      return;
    }
    this.addingTestScholars.set(true);

    this.schoolService.getSchools().subscribe((schools) => {
      if (schools.length === 0) {
        this.addingTestScholars.set(false);
        this.notificationService.show(
          'No schools available, so no test scholars were added.',
          'error',
        );
        return;
      }

      const scholars = Array.from({ length: TEST_SCHOLAR_COUNT }, () =>
        buildRandomScholar(schools),
      );

      from(scholars)
        .pipe(
          concatMap((scholar) =>
            this.scholarService.createScholarSilently(scholar).pipe(
              switchMap((created) => {
                const school = schools.find(
                  (school) => school.schoolId === created.schoolId,
                );
                const attendance = buildRandomAttendance(school);
                return this.attendanceService
                  .saveAttendanceSilently(created.scholarId, attendance)
                  .pipe(
                    catchError((err) => {
                      console.warn(
                        `Created scholar ${created.scholarId} but failed to save its test attendance:`,
                        err,
                      );
                      return of(null);
                    }),
                  );
              }),
              map(() => true),
              catchError((err) => {
                console.warn('Failed to create a test scholar:', err);
                return of(false);
              }),
            ),
          ),
          toArray(),
        )
        .subscribe((results) => {
          this.addingTestScholars.set(false);
          const succeeded = results.filter(Boolean).length;
          const failed = results.length - succeeded;
          this.notificationService.show(
            failed === 0
              ? `Added ${succeeded} test scholars (with random schedules and attendance).`
              : `Added ${succeeded} test scholars; ${failed} could not be added.`,
            failed === 0 ? 'success' : 'error',
          );
        });
    });
  }
}
