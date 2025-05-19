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
        map((params) => params.get('id')),
        filter((id): id is string => id !== null), // narrow type to string
        switchMap((id) =>
          this.scholarsService.getScholars().pipe(
            map((scholars) => scholars.find((s) => s.id === id) || null),
            tap((scholar) => (this.scholar = scholar)),
            switchMap((scholar) => {
              if (!scholar) return of(null);
              return this.schoolsService.getSchools().pipe(
                map(
                  (schools) =>
                    schools.find(
                      (school) => school.id.toString() === scholar.schoolId,
                    ) || null,
                ),
                tap((school) => (this.school = school)),
              );
            }),
          ),
        ),
      )
      .subscribe();
  }
}
