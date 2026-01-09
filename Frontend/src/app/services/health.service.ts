import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class HealthService {
  private readonly healthUrl = environment.baseUrlScholars; // easy to change later

  constructor(private readonly http: HttpClient) {}

  /**
   * Checks if the API is reachable and responding.
   * @returns Observable<boolean> - true if API is healthy, false otherwise
   */
  checkApiHealth(): Observable<boolean> {
    return this.http.get<void>(this.healthUrl, { observe: 'response' }).pipe(
      map((response: HttpResponse<void>) => {
        return response.status >= 200 && response.status < 300;
      }),
      catchError((error) => {
        const errorMsg = [
          'API health check failed!',
          `URL: ${this.healthUrl}`,
          `Error: ${error.name}`,
          `Message: ${error.message}`,
          error.status ? `Status: ${error.status}` : '',
        ]
          .filter(Boolean)
          .join(' | ');

        console.error(errorMsg);
        return of(false);
      }),
    );
  }
}
