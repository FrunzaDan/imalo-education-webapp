import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
}

export interface ConfirmState extends ConfirmOptions {
  message: string;
  confirmText: string;
  cancelText: string;
  variant: 'default' | 'danger';
}

// Matches the card's 1s zoom-out/fade-out closing animation — the state is
// kept (with `closing` true) for the duration so the modal can animate out
// before being removed from the DOM.
const CLOSE_ANIMATION_MS = 1000;

@Injectable({ providedIn: 'root' })
export class ConfirmModalService {
  private readonly _state = signal<ConfirmState | null>(null);
  private readonly _closing = signal(false);
  readonly state = this._state.asReadonly();
  readonly closing = this._closing.asReadonly();

  private resolver: ((result: boolean) => void) | null = null;

  // Resolves true/false as soon as the user picks an option — callers don't
  // wait for the closing animation to finish, only the modal's own removal
  // from the DOM is deferred for that.
  confirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
    return new Promise((resolve) => {
      this.resolver?.(false);

      this.resolver = resolve;
      this._closing.set(false);
      this._state.set({
        message,
        title: options.title,
        confirmText: options.confirmText ?? 'Confirm',
        cancelText: options.cancelText ?? 'Cancel',
        variant: options.variant ?? 'default',
      });
    });
  }

  respond(result: boolean): void {
    if (!this.resolver) return;

    const resolve = this.resolver;
    this.resolver = null;
    resolve(result);

    this._closing.set(true);
    setTimeout(() => {
      this._state.set(null);
      this._closing.set(false);
    }, CLOSE_ANIMATION_MS);
  }
}
