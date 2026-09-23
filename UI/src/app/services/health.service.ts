import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { catchError, map, Observable, of, switchMap, timer } from 'rxjs';
import { environment } from '../../environments/environment';

const POLL_INTERVAL_MS = 15000;

@Injectable({
  providedIn: 'root',
})
export class HealthService {
  private readonly healthUrl = `${environment.apiUrl}/health`;

  constructor(private readonly http: HttpClient) {}

  /**
   * Checks if the API is reachable and responding.
   * @returns Observable<boolean> - true if API is healthy, false otherwise
   */
  checkApiHealth(): Observable<boolean> {
    return this.http
      .get(this.healthUrl, { observe: 'response', responseType: 'text' })
      .pipe(
        map((response: HttpResponse<string>) => response.ok), // cleaner than status check
        catchError((error: HttpErrorResponse) => {
          this.logHealthError(error);
          return of(false);
        }),
      );
  }

  /**
   * Re-checks API health every POLL_INTERVAL_MS (starting immediately), so a
   * status shown in the UI reflects the API coming up or going down after the
   * initial load, not just its state at app startup.
   */
  pollApiHealth(): Observable<boolean> {
    return timer(0, POLL_INTERVAL_MS).pipe(
      switchMap(() => this.checkApiHealth()),
    );
  }

  /** Logs health check errors in a consistent format */
  private logHealthError(error: HttpErrorResponse) {
    console.error(
      `API health check failed! | URL: ${this.healthUrl} | Error: ${
        error.name
      } | Message: ${error.message}${
        error.status ? ` | Status: ${error.status}` : ''
      }`,
    );
  }
}
