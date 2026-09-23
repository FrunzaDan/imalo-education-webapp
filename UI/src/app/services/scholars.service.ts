import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Scholar } from '../interfaces/scholar';
import { catchHttpError } from '../utils/http-error';

@Injectable({ providedIn: 'root' })
export class ScholarsService {
  private baseUrl = `${environment.apiUrl}/api/scholars`;
  private jsonHeaders = new HttpHeaders({ 'Content-Type': 'application/json' });

  constructor(private http: HttpClient) {}

  // ---- CRUD METHODS ----

  getScholars(): Observable<Scholar[]> {
    return this.http.get<Scholar[]>(this.baseUrl).pipe(catchHttpError('getScholars'));
  }

  getScholarById(scholarId: string): Observable<Scholar> {
    return this.http
      .get<Scholar>(this.urlWithId(scholarId))
      .pipe(catchHttpError(`getScholarById scholarId=${scholarId}`));
  }

  createScholar(scholar: Scholar): Observable<Scholar> {
    return this.http
      .post<Scholar>(this.baseUrl, scholar, { headers: this.jsonHeaders })
      .pipe(catchHttpError('createScholar'));
  }

  updateScholar(scholar: Scholar): Observable<Scholar> {
    if (!scholar.scholarId) {
      return throwError(() => new Error('Cannot update scholar without an ID'));
    }
    return this.http
      .put<Scholar>(this.urlWithId(scholar.scholarId), scholar, {
        headers: this.jsonHeaders,
      })
      .pipe(catchHttpError(`updateScholar scholarId=${scholar.scholarId}`));
  }

  deleteScholar(scholarId: string): Observable<void> {
    return this.http
      .delete<void>(this.urlWithId(scholarId))
      .pipe(catchHttpError(`deleteScholar scholarId=${scholarId}`));
  }

  // ---- HELPERS ----

  private urlWithId(scholarId: string) {
    return `${this.baseUrl}/${scholarId}`;
  }
}
