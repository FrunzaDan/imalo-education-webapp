import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Scholar } from '../interfaces/scholar';
import { Observable } from 'rxjs/internal/Observable';

@Injectable({
  providedIn: 'root',
})
export class ScholarsService {
  constructor(private http: HttpClient) {}

  getScholars(): Observable<Scholar[]> {
    return this.http.get<Scholar[]>('../../assets/scholars.json');
  }
}
