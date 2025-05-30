import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { WeekDays } from '../../constants/week-days';
import { PickUpSchedule } from '../../interfaces/pick-up-schedule';
import { switchMap, map, filter, tap } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-scholar-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './scholar-detail.component.html',
  styleUrls: ['./scholar-detail.component.css'],
})
export class ScholarDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly scholarsService = inject(ScholarsService);
  private readonly schoolsService = inject(SchoolsService);

  scholar: Scholar | null = null;
  school: School | null = null;

  daysOfWeek: (keyof PickUpSchedule)[] = Object.values(WeekDays);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        // Get the 'id' parameter from the URL
        switchMap((params) => {
          const scholarId = params.get('id');
          if (!scholarId) {
            console.error('Scholar ID not found in route parameters.');
            return of(null); // Return observable of null if no ID
          }
          // Use the new getScholarById method
          return this.scholarsService.getScholarById(scholarId);
        }),
        tap((scholar) => {
          this.scholar = scholar; // Assign the fetched scholar
          if (!scholar) {
            console.warn('Scholar not found for the given ID.');
          }
        }),
        // Now, if a scholar was found, fetch their school
        switchMap((scholar) => {
          if (!scholar) {
            return of(null); // If no scholar, no school to fetch
          }
          // Fetch all schools, then find the one matching the scholar's schoolId
          return this.schoolsService.getSchools().pipe(
            map(
              (schools) =>
                schools.find(
                  (school) => school.id.toString() === scholar.schoolId, // Ensure ID types match
                ) || null,
            ),
          );
        }),
        tap((school) => {
          this.school = school; // Assign the fetched school
          if (!school && this.scholar) {
            console.warn(
              `School with ID ${this.scholar.schoolId} not found for scholar ${this.scholar.firstName} ${this.scholar.lastName}.`,
            );
          }
        }),
      )
      .subscribe(); // Subscribe to kick off the observable chain
  }
}
