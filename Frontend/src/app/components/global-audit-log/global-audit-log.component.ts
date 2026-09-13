import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { GlobalAuditLogService } from '../../services/global-audit-log.service';
import { NotificationService } from '../../services/notification.service';
import { GlobalAuditLogEntry } from '../../interfaces/global-audit-log-entry';

@Component({
  selector: 'app-global-audit-log',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './global-audit-log.component.html',
  styleUrls: ['./global-audit-log.component.css'],
})
export class GlobalAuditLogComponent implements OnInit {
  private readonly globalAuditLogService = inject(GlobalAuditLogService);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);

  readonly entries = this.globalAuditLogService.entries;
  readonly loading = this.globalAuditLogService.loading;
  readonly error = this.globalAuditLogService.error;
  readonly totalItems = this.globalAuditLogService.totalItems;

  readonly pageSize = 20;
  readonly currentPage = signal(1);
  readonly clearing = signal(false);

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalItems() / this.pageSize)),
  );

  ngOnInit(): void {
    this.fetchAuditLog();
  }

  goToPage(page: number): void {
    const target = Math.min(Math.max(page, 1), this.totalPages());
    if (target === this.currentPage()) return;
    this.currentPage.set(target);
    this.fetchAuditLog();
  }

  // A deleted scholar has no name to link to (see GlobalAuditLogEntry) — only
  // navigate when there's still a scholar record behind the ID.
  navigateToScholar(entry: GlobalAuditLogEntry): void {
    if (!entry.firstName && !entry.lastName) return;
    this.router.navigate(['/scholars', entry.scholarId]);
  }

  scholarLabel(entry: GlobalAuditLogEntry): string {
    if (!entry.firstName && !entry.lastName) {
      return `(deleted scholar ${entry.scholarId})`;
    }
    return `${entry.firstName ?? ''} ${entry.lastName ?? ''}`.trim();
  }

  trackByAuditId(_: number, entry: GlobalAuditLogEntry): number {
    return entry.auditId;
  }

  clearAuditLog(): void {
    if (!confirm('Are you sure you want to permanently delete the entire audit log?')) {
      return;
    }

    this.clearing.set(true);
    this.globalAuditLogService.clearAuditLog().subscribe({
      next: () => {
        this.clearing.set(false);
        this.notificationService.show('Audit log cleared successfully.');
        this.currentPage.set(1);
        this.fetchAuditLog();
      },
      error: (err) => {
        this.clearing.set(false);
        console.error('Failed to clear audit log:', err.message);
        this.notificationService.show('Failed to clear audit log. See console for details.', 'error');
      },
    });
  }

  private fetchAuditLog(): void {
    this.globalAuditLogService.loadAllAuditLog({
      pageNumber: this.currentPage(),
      pageSize: this.pageSize,
    });
  }
}
