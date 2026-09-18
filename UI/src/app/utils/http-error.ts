import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

// Turns an HttpErrorResponse into one human-readable line, covering every shape
// the API actually returns (see ai_docs/api.md): a per-field validation-errors
// dict from ModelState, a plain { message }, or neither (network-level failure).
export function extractHttpErrorMessage(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return 'Could not reach the server. It may be offline.';
  }

  if (error.error?.errors) {
    const validationErrors = Object.values(error.error.errors).flat().join('; ');
    return `Validation errors - ${validationErrors}`;
  }

  if (error.error?.message) {
    return error.error.message;
  }

  return `Request failed (${error.status}). Please try again.`;
}

// Shared catchError operator for the "stateless CRUD" services (ScholarsService,
// AttendanceService): logs the failure and rethrows an Error whose message is
// safe to show a user directly (e.g. via NotificationService), prefixed with
// which operation failed. Services that keep their own loading/error signal
// state (AuditLogService, GlobalAuditLogService) use extractHttpErrorMessage
// directly instead, since they store the message rather than rethrow it.
export function catchHttpError<T>(operation: string) {
  return catchError<T, Observable<T>>((error: HttpErrorResponse) => {
    const message = `${operation} failed: ${extractHttpErrorMessage(error)}`;
    console.error(message, error);
    return throwError(() => new Error(message));
  });
}
