import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, shareReplay, map } from 'rxjs';
import { AttendanceRecord } from '../interfaces/attendance-record';
import { ScholarAttendance } from '../interfaces/scholar-attendance';

@Injectable({
  providedIn: 'root',
})
export class AttendanceService {
  private attendanceDataUrl = '../../assets/scholar-attendance-data.json';

  // Cache the JSON data to avoid multiple HTTP calls
  private attendanceCache$: Observable<ScholarAttendance[]> | null = null;

  constructor(private http: HttpClient) {}

  getAllScholarAttendance(): Observable<ScholarAttendance[]> {
    if (!this.attendanceCache$) {
      this.attendanceCache$ = this.http
        .get<ScholarAttendance[]>(this.attendanceDataUrl)
        .pipe(shareReplay(1)); // caches the result for all subscribers
    }
    return this.attendanceCache$;
  }

  getAttendanceByScholarId(scholarId: string): Observable<AttendanceRecord[]> {
    return this.getAllScholarAttendance().pipe(
      map(
        (allAttendanceData) =>
          allAttendanceData.find((data) => data.scholarId === scholarId)
            ?.attendance ?? [], // return empty array if not found
      ),
    );
  }
}
