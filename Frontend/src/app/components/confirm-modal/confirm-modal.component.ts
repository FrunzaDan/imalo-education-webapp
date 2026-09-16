import { Component, HostListener, inject } from '@angular/core';
import { ConfirmModalService } from '../../services/confirm-modal.service';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  templateUrl: './confirm-modal.component.html',
  styleUrl: './confirm-modal.component.css',
})
export class ConfirmModalComponent {
  private readonly confirmModalService = inject(ConfirmModalService);

  readonly state = this.confirmModalService.state;
  readonly closing = this.confirmModalService.closing;

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.state() && !this.closing()) {
      this.cancel();
    }
  }

  confirm(): void {
    this.confirmModalService.respond(true);
  }

  cancel(): void {
    this.confirmModalService.respond(false);
  }
}
