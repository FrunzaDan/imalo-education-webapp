import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs'; // Corrected import: use 'rxjs' directly
import { map } from 'rxjs/operators'; // Import the 'map' operator

import { Scholar } from '../interfaces/scholar';
import { PickUpSchedule } from '../interfaces/pick-up-schedule';

@Injectable({
  providedIn: 'root',
})
export class ScholarsService {
  // Base URL for your API. Match this to your ASP.NET Core API's base URL.
  // For your local setup, it's likely http://localhost:5244/api/Scholars
  private baseUrl = 'http://localhost:5244/api/Scholars';

  // Define headers for JSON content
  private httpOptions = {
    headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
  };

  constructor(private http: HttpClient) {}

  getScholars(): Observable<Scholar[]> {
    return this.http.get<Scholar[]>(this.baseUrl);
  }

  getScholarById(id: string): Observable<Scholar | null> {
    const url = `${this.baseUrl}/${id}`;
    return this.http.get<Scholar>(url).pipe(
      map((scholar) => scholar || null), // Map to null if API returns empty/null
    );
  }

  createScholar(scholar: Scholar): Observable<Scholar> {
    return this.http.post<Scholar>(this.baseUrl, scholar, this.httpOptions);
  }
}
