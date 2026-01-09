import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class HealthService {
  constructor(private http: HttpClient) {}

  checkApiHealth() {
    return this.http.get(environment.baseUrlScholars).pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }
}
