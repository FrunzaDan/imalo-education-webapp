import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { School } from '../interfaces/school';

@Injectable({
  providedIn: 'root',
})
export class SchoolsService {
  private schoolsUrl = '../../assets/schools.json';

  constructor(private http: HttpClient) {}

  getSchools(): Observable<School[]> {
    return this.http.get<School[]>(this.schoolsUrl).pipe(
      catchError((error) => {
        console.error('Failed to load schools:', error);
        return of([]);
      }),
    );
  }

  getSchoolById(id: number | string): Observable<School | null> {
    const targetId = Number(id);
    return this.http.get<School[]>(this.schoolsUrl).pipe(
      map((schools: School[]) => {
        const school = schools.find((s) => s.id === targetId);
        if (!school) {
          console.error(`School with ID ${targetId} not found in schools.json`);
        }
        return school || null;
      }),
      catchError((error) => {
        console.error(`Failed to fetch schools to find ID ${targetId}:`, error);
        return of(null);
      }),
    );
  }
}
