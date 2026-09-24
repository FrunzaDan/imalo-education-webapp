import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Scholar } from '../interfaces/scholar';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class ScholarService {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);
  private readonly apiUrl = `${environment.apiUrl}/api/scholars`;

  getScholars(): Observable<Scholar[]> {
    return this.http.get<Scholar[]>(this.apiUrl);
  }

  getScholar(scholarId: string): Observable<Scholar> {
    return this.http.get<Scholar>(this.urlWithId(scholarId));
  }

  createScholar(scholar: Scholar): Observable<Scholar> {
    return this.createScholarSilently(scholar).pipe(
      tap(() => this.notificationService.show('Scholar added successfully.')),
    );
  }

  createScholarSilently(scholar: Scholar): Observable<Scholar> {
    return this.http.post<Scholar>(this.apiUrl, scholar);
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
    return `${this.apiUrl}/${scholarId}`;
  }
}
