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

@Injectable({
  providedIn: 'root',
})
export class ScholarsService {
  private baseUrl = environment.baseUrlScholars;

  private jsonHeaders = {
    headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
  };

  constructor(private http: HttpClient) {}

  getScholars(): Observable<Scholar[]> {
    return this.http
      .get<Scholar[]>(this.baseUrl)
      .pipe(catchError(this.handleError<Scholar[]>('getScholars')));
  }

  getScholarById(id: string): Observable<Scholar> {
    const url = `${this.baseUrl}/${id}`;
    return this.http
      .get<Scholar>(url)
      .pipe(catchError(this.handleError<Scholar>(`getScholarById id=${id}`)));
  }

  createScholar(scholar: Scholar): Observable<Scholar> {
    return this.http
      .post<Scholar>(this.baseUrl, scholar, this.jsonHeaders)
      .pipe(catchError(this.handleError<Scholar>('createScholar')));
  }

  updateScholar(scholar: Scholar): Observable<Scholar> {
    if (!scholar.id) {
      throw new Error('Cannot update scholar without an ID');
    }
    const url = `${this.baseUrl}/${scholar.id}`;
    return this.http
      .put<Scholar>(url, scholar, this.jsonHeaders)
      .pipe(
        catchError(this.handleError<Scholar>(`updateScholar id=${scholar.id}`)),
      );
  }

  deleteScholar(id: string): Observable<void> {
    const url = `${this.baseUrl}/${id}`;
    return this.http
      .delete<void>(url)
      .pipe(catchError(this.handleError<void>(`deleteScholar id=${id}`)));
  }

  private handleError<T>(operation = 'operation') {
    return (error: HttpErrorResponse): Observable<T> => {
      let userFriendlyMessage = `${operation} failed: ${error.message}`;

      if (error.error && typeof error.error === 'object') {
        if (error.error.errors) {
          const validationErrors = Object.values(error.error.errors)
            .flat()
            .join('; ');

          userFriendlyMessage = `${operation} failed: Validation errors - ${validationErrors}`;
        } else if (error.error.message) {
          userFriendlyMessage = `${operation} failed: ${error.error.message}`;
        }
      }

      console.error(userFriendlyMessage, error);

      return throwError(() => new Error(userFriendlyMessage));
    };
  }
}
