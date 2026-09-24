import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of, shareReplay } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { School } from '../interfaces/school';

@Injectable({
  providedIn: 'root',
})
export class SchoolService {
  private readonly http = inject(HttpClient);
  private schoolsUrl = '../../assets/schools.json';

  // Cache the loaded schools
  private schoolsCache$: Observable<School[]> | null = null;

  getSchools(): Observable<School[]> {
    if (!this.schoolsCache$) {
      this.schoolsCache$ = this.http.get<School[]>(this.schoolsUrl).pipe(
        shareReplay(1), // caches the result for all subscribers
        // Falls back to an empty list; apiLoggerInterceptor has already logged
        // the failed request.
        catchError(() => of([])),
      );
    }
    return this.schoolsCache$;
  }

  getSchool(schoolId: number | string): Observable<School | null> {
    const targetId = Number(schoolId);
    return this.getSchools().pipe(
      map((schools) => {
        const school =
          schools.find((school) => school.schoolId === targetId) || null;
        if (!school) {
          console.warn(`School with ID ${targetId} not found in schools.json`);
        }
        return school;
      }),
    );
  }
}
