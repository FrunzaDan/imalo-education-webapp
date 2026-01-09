import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class HealthService {
  private readonly healthUrl = environment.baseUrlScholars;

  constructor(private readonly http: HttpClient) {}

  /**
   * Checks if the API is reachable and responding.
   * @returns Observable<boolean> - true if API is healthy, false otherwise
   */
  checkApiHealth(): Observable<boolean> {
    return this.http.get<void>(this.healthUrl, { observe: 'response' }).pipe(
      map((response: HttpResponse<void>) => response.ok), // cleaner than status check
      catchError((error) => {
        this.logHealthError(error);
        return of(false);
      }),
    );
  }

  /** Logs health check errors in a consistent format */
  private logHealthError(error: any) {
    console.error(
      `API health check failed! | URL: ${this.healthUrl} | Error: ${
        error.name ?? 'Unknown'
      } | Message: ${error.message ?? 'No message'}${
        error.status ? ` | Status: ${error.status}` : ''
      }`,
    );
  }
}
