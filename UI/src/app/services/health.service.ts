import { inject, Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpResponse,
} from '@angular/common/http';
import { catchError, map, Observable, of, switchMap, timer } from 'rxjs';
import { environment } from '../../environments/environment';

const POLL_INTERVAL_MS = 15000;

@Injectable({
  providedIn: 'root',
})
export class HealthService {
  private readonly http = inject(HttpClient);
  private readonly healthUrl = `${environment.apiUrl}/health`;

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

  pollApiHealth(): Observable<boolean> {
    return timer(0, POLL_INTERVAL_MS).pipe(
      switchMap(() => this.checkApiHealth()),
    );
  }

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
