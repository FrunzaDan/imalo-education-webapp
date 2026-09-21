import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { NotificationService } from '../../services/notification.service';
import { ConfirmModalService } from '../../services/confirm-modal.service';
import { AuditLogService } from '../../services/audit-log.service';
import { WeekDays } from '../../constants/week-days';
import { PickUpSchedule } from '../../interfaces/pick-up-schedule';

@Component({
  selector: 'app-scholar-detail',
  imports: [DatePipe, TitleCasePipe, RouterModule],
  templateUrl: './scholar-detail.component.html',
  styleUrl: './scholar-detail.component.css',
})
export class ScholarDetailComponent {
  private readonly scholarsService = inject(ScholarsService);
  private readonly schoolsService = inject(SchoolsService);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly confirmModalService = inject(ConfirmModalService);
  private readonly auditLogService = inject(AuditLogService);

  // Bound from the `:id` route param by withComponentInputBinding() in
  // app.config.ts — and, unlike route.snapshot, follows the param if it changes.
  readonly id = input<string>();

  // reading a resource's value() while it is in the error state throws, so
  // scholar()/school() go through hasValue() and fall back to null.
  private readonly scholarResource = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => this.scholarsService.getScholarById(id),
  });
  readonly scholar = computed(() =>
    this.scholarResource.hasValue() ? this.scholarResource.value() : null,
  );
  readonly loadError = computed(() => this.scholarResource.error()?.message ?? null);

  // Idle (no request) until the scholar has loaded and has a school.
  private readonly schoolResource = rxResource({
    params: () => this.scholar()?.schoolId || undefined,
    stream: ({ params: schoolId }) => this.schoolsService.getSchoolById(schoolId),
  });
  readonly school = computed(() =>
    this.schoolResource.hasValue() ? this.schoolResource.value() : null,
  );

  readonly auditLog = this.auditLogService.entries;
  readonly auditLogLoading = this.auditLogService.loading;
  readonly auditLogError = this.auditLogService.error;

  daysOfWeek: (keyof PickUpSchedule)[] = Object.values(WeekDays);

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) untracked(() => this.auditLogService.loadAuditLog(id));
    });
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

  async deleteScholar(): Promise<void> {
    const scholar = this.scholar();
    if (!scholar?.id) return;

    const confirmed = await this.confirmModalService.confirm(
      `Are you sure you want to delete ${scholar.firstName} ${scholar.lastName}?`,
      { title: 'Delete scholar', confirmText: 'Delete', variant: 'danger' },
    );
    if (!confirmed) return;

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
