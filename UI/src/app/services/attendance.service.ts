import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AttendanceRecord } from '../interfaces/attendance-record';
import { ScholarAttendance } from '../interfaces/scholar-attendance';
import { environment } from '../../environments/environment';
import { catchHttpError } from '../utils/http-error';

@Injectable({
  providedIn: 'root',
})
export class AttendanceService {
  // Base API endpoint
  private baseUrl = `${environment.apiUrl}/api/scholars`;

  constructor(private http: HttpClient) {}

  // ----------------------------
  // Fetch all scholars' attendance
  // ----------------------------
  // No caching here: this list is read by the attendance dashboard right after
  // per-scholar edits get saved elsewhere, so a stale cached copy would show
  // pre-edit data. It's a small local dataset — refetching is cheap.
  getAllScholarAttendance(): Observable<ScholarAttendance[]> {
    return this.http
      .get<ScholarAttendance[]>(`${this.baseUrl}/attendance`)
      .pipe(catchHttpError('getAllScholarAttendance'));
  }

  // ----------------------------
  // Fetch a single scholar's attendance
  // ----------------------------
  getAttendanceByScholarId(scholarId: string): Observable<AttendanceRecord[]> {
    return this.http
      .get<AttendanceRecord[]>(`${this.baseUrl}/${scholarId}/attendance`)
      .pipe(catchHttpError(`getAttendanceByScholarId scholarId=${scholarId}`));
  }

  // ----------------------------
  // Create or update attendance for a scholar
  // ----------------------------
  saveAttendance(
    scholarId: string,
    attendance: AttendanceRecord[],
  ): Observable<any> {
    return this.http
      .post(`${this.baseUrl}/${scholarId}/attendance`, attendance)
      .pipe(catchHttpError(`saveAttendance scholarId=${scholarId}`));
  }

  // ----------------------------
  // Delete attendance for a scholar
  // ----------------------------
  deleteAttendance(scholarId: string): Observable<any> {
    return this.http
      .delete(`${this.baseUrl}/${scholarId}/attendance`)
      .pipe(catchHttpError(`deleteAttendance scholarId=${scholarId}`));
  }
}
