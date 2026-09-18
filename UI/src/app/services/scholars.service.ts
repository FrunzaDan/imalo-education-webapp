import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Scholar } from '../interfaces/scholar';
import { catchHttpError } from '../utils/http-error';

@Injectable({ providedIn: 'root' })
export class ScholarsService {
  private baseUrl = environment.baseUrlScholars;
  private jsonHeaders = new HttpHeaders({ 'Content-Type': 'application/json' });

  constructor(private http: HttpClient) {}

  // ---- CRUD METHODS ----

  getScholars(): Observable<Scholar[]> {
    return this.http.get<Scholar[]>(this.baseUrl).pipe(catchHttpError('getScholars'));
  }

  getScholarById(id: string): Observable<Scholar> {
    return this.http
      .get<Scholar>(this.urlWithId(id))
      .pipe(catchHttpError(`getScholarById id=${id}`));
  }

  createScholar(scholar: Scholar): Observable<Scholar> {
    return this.http
      .post<Scholar>(this.baseUrl, scholar, { headers: this.jsonHeaders })
      .pipe(catchHttpError('createScholar'));
  }

  updateScholar(scholar: Scholar): Observable<Scholar> {
    if (!scholar.id) {
      return throwError(() => new Error('Cannot update scholar without an ID'));
    }
    return this.http
      .put<Scholar>(this.urlWithId(scholar.id), scholar, {
        headers: this.jsonHeaders,
      })
      .pipe(catchHttpError(`updateScholar id=${scholar.id}`));
  }

  deleteScholar(id: string): Observable<void> {
    return this.http
      .delete<void>(this.urlWithId(id))
      .pipe(catchHttpError(`deleteScholar id=${id}`));
  }

  // ---- HELPERS ----

  private urlWithId(id: string) {
    return `${this.baseUrl}/${id}`;
  }
}
