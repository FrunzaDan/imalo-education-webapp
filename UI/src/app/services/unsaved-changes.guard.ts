import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmDialogService } from './confirm-dialog.service';

// Implemented by pages with a form (scholar-form, attendance-per-scholar).
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

// Asks before leaving a page with unsaved edits — covers the nav links and
// browser back/forward. (Closing/reloading the tab isn't a router navigation;
// the components handle that with a `beforeunload` listener.)
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component.hasUnsavedChanges()) return true;

  return inject(ConfirmDialogService).confirm(
    'You have unsaved changes. If you leave this page they will be lost.',
    {
      title: 'Discard changes?',
      confirmLabel: 'Discard changes',
      cancelLabel: 'Keep editing',
      variant: 'danger',
    },
  );
};
