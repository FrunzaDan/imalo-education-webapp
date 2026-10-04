import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AttendanceRecord } from '../interfaces/attendance-record';
import { ScholarAttendance } from '../interfaces/scholar-attendance';
import { environment } from '../../environments/environment';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);
  private readonly apiUrl = `${environment.apiUrl}/api/scholars`;

  getAllAttendance(): Observable<ScholarAttendance[]> {
    return this.http.get<ScholarAttendance[]>(`${this.apiUrl}/attendance`);
  }

  getAttendance(scholarId: string): Observable<AttendanceRecord[]> {
    return this.http.get<AttendanceRecord[]>(
      `${this.apiUrl}/${scholarId}/attendance`,
    );
  }

  saveAttendance(
    scholarId: string,
    attendance: AttendanceRecord[],
  ): Observable<void> {
    return this.saveAttendanceSilently(scholarId, attendance).pipe(
      tap(() =>
        this.notificationService.show('Attendance saved successfully.'),
      ),
    );
  }

  saveAttendanceSilently(
    scholarId: string,
    attendance: AttendanceRecord[],
  ): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/${scholarId}/attendance`,
      attendance,
    );
  }

  deleteAttendance(scholarId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${scholarId}/attendance`);
  }
}
