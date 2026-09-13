import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  templateUrl: './notification.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './notification.component.css',
})
export class NotificationComponent {
  private readonly notificationService = inject(NotificationService);

  readonly notifications = this.notificationService.notifications;

  dismiss(id: number): void {
    this.notificationService.dismiss(id);
  }
}
