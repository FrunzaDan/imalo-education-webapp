import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of, shareReplay } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { School } from '../interfaces/school';

@Injectable({
  providedIn: 'root',
})
export class SchoolsService {
  private readonly http = inject(HttpClient);
  private schoolsUrl = '../../assets/schools.json';

  // Cache the loaded schools
  private schoolsCache$: Observable<School[]> | null = null;

  getSchools(): Observable<School[]> {
    if (!this.schoolsCache$) {
      this.schoolsCache$ = this.http.get<School[]>(this.schoolsUrl).pipe(
        shareReplay(1), // caches the result for all subscribers
        catchError((error) => {
          console.error('Failed to load schools:', error);
          return of([]); // fallback to empty array
        }),
      );
    }
    return this.schoolsCache$;
  }

  getSchoolById(schoolId: number | string): Observable<School | null> {
    const targetId = Number(schoolId);
    return this.getSchools().pipe(
      map((schools) => {
        const school = schools.find((school) => school.schoolId === targetId) || null;
        if (!school) {
          console.warn(`School with ID ${targetId} not found in schools.json`);
        }
        return school;
      }),
    );
  }
}
