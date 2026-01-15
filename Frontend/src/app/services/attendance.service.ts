import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, shareReplay, map } from 'rxjs';
import { AttendanceRecord } from '../interfaces/attendance-record';
import { ScholarAttendance } from '../interfaces/scholar-attendance';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AttendanceService {
  // Base API endpoint
  private baseUrl = environment.baseUrlScholars;

  // Optional cache for all attendance data
  private attendanceCache$: Observable<ScholarAttendance[]> | null = null;

  constructor(private http: HttpClient) {}

  // ----------------------------
  // Fetch all scholars' attendance
  // ----------------------------
  getAllScholarAttendance(): Observable<ScholarAttendance[]> {
    if (!this.attendanceCache$) {
      this.attendanceCache$ = this.http
        .get<ScholarAttendance[]>(`${this.baseUrl}/attendance`)
        .pipe(shareReplay(1)); // cache for all subscribers
    }
    return this.attendanceCache$;
  }

  // ----------------------------
  // Fetch a single scholar's attendance
  // ----------------------------
  getAttendanceByScholarId(scholarId: string): Observable<AttendanceRecord[]> {
    return this.http.get<AttendanceRecord[]>(
      `${this.baseUrl}/${scholarId}/attendance`,
    );
  }

  // ----------------------------
  // Create or update attendance for a scholar
  // ----------------------------
  saveAttendance(
    scholarId: string,
    attendance: AttendanceRecord[],
  ): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/${scholarId}/attendance`,
      attendance,
    );
  }

  // ----------------------------
  // Delete attendance for a scholar
  // ----------------------------
  deleteAttendance(scholarId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${scholarId}/attendance`);
  }

  // ----------------------------
  // Optional: get only present days
  // ----------------------------
  getPresentDaysByScholarId(scholarId: string): Observable<AttendanceRecord[]> {
    return this.getAttendanceByScholarId(scholarId).pipe(
      map((records) =>
        records.filter((r) => r.lunchCost > 0 || r.transportCost > 0),
      ),
    );
  }
}
