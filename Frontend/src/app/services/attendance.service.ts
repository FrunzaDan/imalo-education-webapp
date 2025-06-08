import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AttendanceRecord } from '../interfaces/attendance-record';
import { ScholarAttendance } from '../interfaces/scholar-attendance';

@Injectable({
  providedIn: 'root',
})
export class AttendanceService {
  private attendanceDataUrl = '../../assets/scholar-attendance-data.json';

  constructor(private http: HttpClient) {}
  getAllScholarAttendance(): Observable<ScholarAttendance[]> {
    return this.http.get<ScholarAttendance[]>(this.attendanceDataUrl);
  }

  getAttendanceByScholarId(
    scholarId: string,
  ): Observable<AttendanceRecord[] | undefined> {
    return this.http.get<ScholarAttendance[]>(this.attendanceDataUrl).pipe(
      map((allAttendanceData: ScholarAttendance[]) => {
        const scholarEntry = allAttendanceData.find(
          (data) => data.scholarId === scholarId,
        );
        return scholarEntry ? scholarEntry.attendance : undefined;
      }),
    );
  }
}
