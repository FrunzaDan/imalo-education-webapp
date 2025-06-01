import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs'; // Corrected import: use 'rxjs' directly
import { map } from 'rxjs/operators'; // Import the 'map' operator

import { Scholar } from '../interfaces/scholar';

@Injectable({
  providedIn: 'root',
})
export class ScholarsService {
  private scholarsUrl = '../../assets/scholars.json'; // Path to your scholars JSON

  constructor(private http: HttpClient) {}

  getScholars(): Observable<Scholar[]> {
    return this.http.get<Scholar[]>(this.scholarsUrl);
  }

  getScholarById(id: string): Observable<Scholar | null> {
    return this.http.get<Scholar[]>(this.scholarsUrl).pipe(
      map((scholars: Scholar[]) => {
        const scholar = scholars.find((s) => s.id === id);
        return scholar || null;
      }),
    );
  }
}
