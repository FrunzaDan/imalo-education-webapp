import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/internal/Observable';
import { School } from '../interfaces/school';

@Injectable({
  providedIn: 'root',
})
export class SchoolsService {
  constructor(private http: HttpClient) {}

  getSchools(): Observable<School[]> {
    return this.http.get<School[]>('../../assets/schools.json');
  }
}
