import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Scholar } from '../interfaces/scholar';
import { NotificationService } from './notification.service';

// Failed requests surface as the HttpClient's own HttpErrorResponse; callers
// turn that into a message with extractErrorMessage and show it inline.
// A successful change confirms itself with a toast; the *Silently variants
// skip it, for bulk callers that show one summary toast instead.
@Injectable({ providedIn: 'root' })
export class ScholarsService {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);
  private readonly baseUrl = `${environment.apiUrl}/api/scholars`;

  getScholars(): Observable<Scholar[]> {
    return this.http.get<Scholar[]>(this.baseUrl);
  }

  getScholarById(scholarId: string): Observable<Scholar> {
    return this.http.get<Scholar>(this.urlWithId(scholarId));
  }

  createScholar(scholar: Scholar): Observable<Scholar> {
    return this.createScholarSilently(scholar).pipe(
      tap(() => this.notificationService.show('Scholar created successfully.')),
    );
  }

  createScholarSilently(scholar: Scholar): Observable<Scholar> {
    return this.http.post<Scholar>(this.baseUrl, scholar);
  }

  updateScholar(scholar: Scholar): Observable<Scholar> {
    return this.http
      .put<Scholar>(this.urlWithId(scholar.scholarId), scholar)
      .pipe(
        tap(() =>
          this.notificationService.show('Scholar updated successfully.'),
        ),
      );
  }

  deleteScholar(scholarId: string): Observable<void> {
    return this.deleteScholarSilently(scholarId).pipe(
      tap(() => this.notificationService.show('Scholar deleted successfully.')),
    );
  }

  deleteScholarSilently(scholarId: string): Observable<void> {
    return this.http.delete<void>(this.urlWithId(scholarId));
  }

  private urlWithId(scholarId: string): string {
    return `${this.baseUrl}/${scholarId}`;
  }
}
