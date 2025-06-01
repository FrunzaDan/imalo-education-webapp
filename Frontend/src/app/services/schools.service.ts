import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { School } from '../interfaces/school';

@Injectable({
  providedIn: 'root',
})
export class SchoolsService {
  private schoolsUrl = '../../assets/schools.json';

  constructor(private http: HttpClient) {}

  getSchools(): Observable<School[]> {
    return this.http.get<School[]>(this.schoolsUrl);
  }

  getSchoolById(id: string): Observable<School | null> {
    return this.http.get<School[]>(this.schoolsUrl).pipe(
      map((schools: School[]) => {
        const school = schools.find((s) => s.id.toString() === id);
        return school || null;
      }),
    );
  }
}
