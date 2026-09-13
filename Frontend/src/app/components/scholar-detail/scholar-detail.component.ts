import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { NotificationService } from '../../services/notification.service';
import { AuditLogService } from '../../services/audit-log.service';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { WeekDays } from '../../constants/week-days';
import { PickUpSchedule } from '../../interfaces/pick-up-schedule';
import { switchMap, map, filter, tap } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-scholar-detail',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, RouterModule],
  templateUrl: './scholar-detail.component.html',
  styleUrls: ['./scholar-detail.component.css'],
})
export class ScholarDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly scholarsService = inject(ScholarsService);
  private readonly schoolsService = inject(SchoolsService);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly auditLogService = inject(AuditLogService);

  scholar = signal<Scholar | null>(null);
  school = signal<School | null>(null);

  readonly auditLog = this.auditLogService.entries;
  readonly auditLogLoading = this.auditLogService.loading;
  readonly auditLogError = this.auditLogService.error;

  daysOfWeek: (keyof PickUpSchedule)[] = Object.values(WeekDays);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        // First switchMap: Get scholarId and fetch scholar
        switchMap((params) => {
          const scholarId = params.get('id');
          if (!scholarId) {
            console.error('Scholar ID not found in route parameters.');
            return of(null); // Return observable of null if no ID
          }
          this.auditLogService.loadAuditLog(scholarId);
          return this.scholarsService.getScholarById(scholarId);
        }),
        // tap: Assign scholar to component property
        tap((fetchedScholar) => {
          this.scholar.set(fetchedScholar);
          if (!fetchedScholar) {
            console.warn('Scholar not found for the given ID.');
          }
        }),
        // Second switchMap: If scholar found, fetch their school using getSchoolById
        switchMap((scholar) => {
          if (!scholar || !scholar.schoolId) {
            // Check if scholar or schoolId is missing
            return of(null); // If no scholar or schoolId, no school to fetch
          }
          return this.schoolsService.getSchoolById(scholar.schoolId);
        }),
        // tap: Assign school to component property
        tap((fetchedSchool) => {
          const scholar = this.scholar();
          this.school.set(fetchedSchool);
          if (!fetchedSchool && scholar) {
            console.warn(
              `School with ID ${scholar.schoolId} not found for scholar ${scholar.firstName} ${scholar.lastName}.`,
            );
          }
        }),
      )
      .subscribe();
  }

  // Composes whatever's actually present — a parent may have a name, a
  // phone number, both, or (if this returns '') neither.
  formatParent(
    firstName?: string | null,
    lastName?: string | null,
    phoneNumber?: string | null,
  ): string {
    const name = [firstName, lastName].filter(Boolean).join(' ');
    if (name && phoneNumber) return `${name} — ${phoneNumber}`;
    return name || phoneNumber || '';
  }

  navigateToUpdateScholar(): void {
    const scholar = this.scholar();
    if (!scholar?.id) return;

    this.router.navigate(['/scholars/update', scholar.id]);
  }

  deleteScholar(): void {
    const scholar = this.scholar();
    if (!scholar?.id) return;

    if (!confirm(`Are you sure you want to delete ${scholar.firstName} ${scholar.lastName}?`)) {
      return;
    }

    this.scholarsService.deleteScholar(scholar.id).subscribe({
      next: () => {
        this.notificationService.show(
          `Scholar ${scholar.firstName} ${scholar.lastName} deleted successfully.`,
        );
        this.router.navigate(['/scholars']);
      },
      error: (err) => {
        console.error('Failed to delete scholar:', err.message);
        this.notificationService.show(
          'Failed to delete scholar. See console for details.',
          'error',
        );
      },
    });
  }
}
