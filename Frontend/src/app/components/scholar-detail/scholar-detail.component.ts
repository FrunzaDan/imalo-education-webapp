import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
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
  private readonly router = inject(Router);

  scholar: Scholar | null = null;
  school: School | null = null;

  daysOfWeek: (keyof PickUpSchedule)[] = Object.values(WeekDays);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        // First switchMap: Get scholarId and fetch scholar
        switchMap((params) => {
          const scholarId = params.get('id');
          if (!scholarId) {
            console.error('Scholar ID not found in route parameters.');
            return of(null); // Return observable of null if no ID
          }
          return this.scholarsService.getScholarById(scholarId);
        }),
        // tap: Assign scholar to component property
        tap((fetchedScholar) => {
          this.scholar = fetchedScholar;
          if (!fetchedScholar) {
            console.warn('Scholar not found for the given ID.');
          }
        }),
        // Second switchMap: If scholar found, fetch their school using getSchoolById
        switchMap((scholar) => {
          if (!scholar || !scholar.schoolId) {
            // Check if scholar or schoolId is missing
            return of(null); // If no scholar or schoolId, no school to fetch
          }
          return this.schoolsService.getSchoolById(scholar.schoolId);
        }),
        // tap: Assign school to component property
        tap((fetchedSchool) => {
          this.school = fetchedSchool;
          if (!fetchedSchool && this.scholar) {
            console.warn(
              `School with ID ${this.scholar.schoolId} not found for scholar ${this.scholar.firstName} ${this.scholar.lastName}.`,
            );
          }
        }),
      )
      .subscribe();
  }

  deleteScholar(): void {
    if (!this.scholar?.id) return;

    if (
      !confirm(
        `Are you sure you want to delete ${this.scholar.firstName} ${this.scholar.lastName}?`,
      )
    ) {
      return;
    }

    this.scholarsService.deleteScholar(this.scholar.id).subscribe({
      next: () => {
        console.log(`Scholar ${this.scholar?.id} deleted successfully.`);
        this.router.navigate(['/scholars']);
      },
      error: (err) => {
        console.error('Failed to delete scholar:', err.message);
        alert('Failed to delete scholar. See console for details.');
      },
    });
  }
}
