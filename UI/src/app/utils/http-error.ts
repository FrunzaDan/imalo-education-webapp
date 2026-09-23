import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

// Every API error body is RFC 9457 Problem Details (application/problem+json,
// see ai_docs/api.md "Error handling"). A validation failure is the
// ValidationProblemDetails variant, with per-field messages under "errors".
interface ProblemDetails {
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
}

// Turns an HttpErrorResponse into one human-readable line: the validation
// messages, else the problem's detail (or title), else a generic line when
// there's no body at all (e.g. a network-level failure).
export function extractHttpErrorMessage(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return 'Could not reach the server. It may be offline.';
  }

  const problem = error.error as ProblemDetails | null;

  if (problem?.errors) {
    const validationErrors = Object.values(problem.errors).flat().join('; ');
    return `Validation errors - ${validationErrors}`;
  }

  return (
    problem?.detail ??
    problem?.title ??
    `Request failed (${error.status}). Please try again.`
  );
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
