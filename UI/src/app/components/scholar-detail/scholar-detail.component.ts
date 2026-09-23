import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { AuditLogService } from '../../services/audit-log.service';
import { auditActionLabel } from '../../utils/audit-action-label';
import { WEEK_DAYS } from '../../constants/week-days';
import { extractErrorMessage } from '../../utils/extract-error-message';

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
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly auditLogService = inject(AuditLogService);

  // Bound from the `:scholarId` route param by withComponentInputBinding() in
  // app.config.ts — and, unlike route.snapshot, follows the param if it changes.
  readonly scholarId = input<string>();

  // reading a resource's value() while it is in the error state throws, so
  // scholar()/school() go through hasValue() and fall back to null.
  private readonly scholarResource = rxResource({
    params: () => this.scholarId(),
    stream: ({ params: scholarId }) => this.scholarsService.getScholarById(scholarId),
  });
  readonly scholar = computed(() =>
    this.scholarResource.hasValue() ? this.scholarResource.value() : null,
  );
  readonly loadError = computed(() => {
    const error = this.scholarResource.error();
    return error ? extractErrorMessage(error as HttpErrorResponse, 'Failed to load scholar') : null;
  });

  // Idle (no request) until the scholar has loaded and has a school.
  private readonly schoolResource = rxResource({
    params: () => this.scholar()?.schoolId || undefined,
    stream: ({ params: schoolId }) => this.schoolsService.getSchoolById(schoolId),
  });
  readonly school = computed(() =>
    this.schoolResource.hasValue() ? this.schoolResource.value() : null,
  );

  readonly auditActionLabel = auditActionLabel;
  readonly auditLog = this.auditLogService.entries;
  readonly auditLogLoading = this.auditLogService.loading;
  readonly auditLogError = this.auditLogService.error;

  readonly daysOfWeek = WEEK_DAYS;

  readonly deleting = signal(false);
  readonly deleteError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const scholarId = this.scholarId();
      if (scholarId) untracked(() => this.auditLogService.loadAuditLog(scholarId));
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
    if (!scholar?.scholarId) return;

    this.router.navigate(['/scholars/update', scholar.scholarId]);
  }

  async deleteScholar(): Promise<void> {
    const scholar = this.scholar();
    if (!scholar?.scholarId) return;

    const confirmed = await this.confirmDialogService.confirm(
      `Are you sure you want to delete ${scholar.firstName} ${scholar.lastName}?`,
      { title: 'Delete scholar?', confirmLabel: 'Delete', variant: 'danger' },
    );
    if (!confirmed) return;

    this.deleting.set(true);
    this.deleteError.set(null);

    this.scholarsService.deleteScholar(scholar.scholarId).subscribe({
      next: () => this.router.navigate(['/scholars']),
      error: (error: HttpErrorResponse) => {
        this.deleting.set(false);
        this.deleteError.set(extractErrorMessage(error, 'Failed to delete scholar'));
      },
    });
  }
}
