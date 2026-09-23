import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AttendanceRecord } from '../interfaces/attendance-record';
import { ScholarAttendance } from '../interfaces/scholar-attendance';
import { environment } from '../../environments/environment';
import { NotificationService } from './notification.service';

// Same conventions as ScholarsService: errors surface as HttpErrorResponse,
// a successful save confirms itself with a toast (skipped by *Silently).
@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);
  private readonly baseUrl = `${environment.apiUrl}/api/scholars`;

  // No caching here: this list is read by the attendance dashboard right after
  // per-scholar edits get saved elsewhere, so a stale cached copy would show
  // pre-edit data. It's a small local dataset — refetching is cheap.
  getAllScholarAttendance(): Observable<ScholarAttendance[]> {
    return this.http.get<ScholarAttendance[]>(`${this.baseUrl}/attendance`);
  }

  getAttendanceByScholarId(scholarId: string): Observable<AttendanceRecord[]> {
    return this.http.get<AttendanceRecord[]>(`${this.baseUrl}/${scholarId}/attendance`);
  }

  // Replaces the scholar's whole attendance list (the API answers 204).
  saveAttendance(scholarId: string, attendance: AttendanceRecord[]): Observable<void> {
    return this.saveAttendanceSilently(scholarId, attendance).pipe(
      tap(() => this.notificationService.show('Attendance saved successfully.')),
    );
  }

  saveAttendanceSilently(scholarId: string, attendance: AttendanceRecord[]): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${scholarId}/attendance`, attendance);
  }

  deleteAttendance(scholarId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${scholarId}/attendance`);
  }
}
