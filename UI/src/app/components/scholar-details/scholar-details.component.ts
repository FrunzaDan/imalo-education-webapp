import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { ScholarService } from '../../services/scholar.service';
import { SchoolService } from '../../services/school.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { AuditLogService } from '../../services/audit-log.service';
import { auditActionLabel } from '../../utils/audit-action-label';
import { WEEK_DAYS } from '../../constants/week-days';
import { extractErrorMessage } from '../../utils/extract-error-message';

@Component({
  selector: 'app-scholar-details',
  imports: [DatePipe, TitleCasePipe, RouterLink],
  templateUrl: './scholar-details.component.html',
  styleUrl: './scholar-details.component.css',
})
export class ScholarDetailsComponent {
  private readonly scholarService = inject(ScholarService);
  private readonly schoolService = inject(SchoolService);
  private readonly router = inject(Router);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly auditLogService = inject(AuditLogService);

  readonly scholarId = input<string>();

  private readonly scholarResource = rxResource({
    params: () => this.scholarId(),
    stream: ({ params: scholarId }) =>
      this.scholarService.getScholar(scholarId),
  });
  readonly scholar = computed(() =>
    this.scholarResource.hasValue() ? this.scholarResource.value() : null,
  );
  readonly loadError = computed(() => {
    const error = this.scholarResource.error();
    return error
      ? extractErrorMessage(
          error as HttpErrorResponse,
          'Failed to load scholar',
        )
      : null;
  });

  private readonly schoolResource = rxResource({
    params: () => this.scholar()?.schoolId || undefined,
    stream: ({ params: schoolId }) => this.schoolService.getSchool(schoolId),
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
      if (scholarId)
        untracked(() => this.auditLogService.loadAuditLog(scholarId));
    });
  }

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

    this.scholarService.deleteScholar(scholar.scholarId).subscribe({
      next: () => this.router.navigate(['/scholars']),
      error: (error: HttpErrorResponse) => {
        this.deleting.set(false);
        this.deleteError.set(
          extractErrorMessage(error, 'Failed to delete scholar'),
        );
      },
    });
  }
}
