import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Scholar } from '../interfaces/scholar';

@Injectable({ providedIn: 'root' })
export class ScholarsService {
  private baseUrl = environment.baseUrlScholars;
  private jsonHeaders = new HttpHeaders({ 'Content-Type': 'application/json' });

  constructor(private http: HttpClient) {}

  // ---- CRUD METHODS ----

  getScholars(): Observable<Scholar[]> {
    return this.request<Scholar[]>(this.baseUrl, 'getScholars');
  }

  getScholarById(id: string): Observable<Scholar> {
    return this.request<Scholar>(this.urlWithId(id), `getScholarById id=${id}`);
  }

  createScholar(scholar: Scholar): Observable<Scholar> {
    return this.http
      .post<Scholar>(this.baseUrl, scholar, { headers: this.jsonHeaders })
      .pipe(catchError(this.handleError<Scholar>('createScholar')));
  }

  updateScholar(scholar: Scholar): Observable<Scholar> {
    if (!scholar.id) {
      return throwError(() => new Error('Cannot update scholar without an ID'));
    }
    return this.http
      .put<Scholar>(this.urlWithId(scholar.id), scholar, {
        headers: this.jsonHeaders,
      })
      .pipe(
        catchError(this.handleError<Scholar>(`updateScholar id=${scholar.id}`)),
      );
  }

  deleteScholar(id: string): Observable<void> {
    return this.http
      .delete<void>(this.urlWithId(id))
      .pipe(catchError(this.handleError<void>(`deleteScholar id=${id}`)));
  }

  // ---- HELPERS ----

  private urlWithId(id: string) {
    return `${this.baseUrl}/${id}`;
  }

  private request<T>(url: string, operation: string): Observable<T> {
    return this.http
      .get<T>(url)
      .pipe(catchError(this.handleError<T>(operation)));
  }

  private handleError<T>(operation = 'operation') {
    return (error: HttpErrorResponse): Observable<T> => {
      let message = `${operation} failed: ${error.message}`;

      // Optional chaining for brevity
      if (error.error?.errors) {
        const validationErrors = Object.values(error.error.errors)
          .flat()
          .join('; ');
        message = `${operation} failed: Validation errors - ${validationErrors}`;
      } else if (error.error?.message) {
        message = `${operation} failed: ${error.error.message}`;
      }

      console.error(message, error);
      return throwError(() => new Error(message));
    };
  }
}
