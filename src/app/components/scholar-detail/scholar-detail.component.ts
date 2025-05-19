import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { WeekDays } from '../../constants/week-days'; // adjust path as needed
import { PickUpSchedule } from '../../interfaces/pick-up-schedule';

@Component({
  selector: 'app-scholar-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scholar-detail.component.html',
  styleUrls: ['./scholar-detail.component.css'],
})
export class ScholarDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private scholarsService = inject(ScholarsService);
  private schoolsService = inject(SchoolsService);

  scholar: Scholar | null = null;
  school: School | null = null;

  daysOfWeek: (keyof PickUpSchedule)[] = Object.values(WeekDays);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.scholarsService.getScholars().subscribe((scholars) => {
      this.scholar = scholars.find((s) => s.id === id) || null;

      if (this.scholar) {
        this.schoolsService.getSchools().subscribe((schools) => {
          this.school =
            schools.find(
              (school) => school.id.toString() === this.scholar!.schoolId,
            ) || null;
        });
      }
    });
  }
}
