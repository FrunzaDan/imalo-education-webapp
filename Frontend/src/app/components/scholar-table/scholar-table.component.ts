import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { SortingService } from '../../services/sorting.service';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { CommonModule } from '@angular/common';
import { forkJoin, Observable } from 'rxjs'; // Import Observable
import { map } from 'rxjs/operators'; // Only need map, switchMap is no longer needed here
import { RouterModule } from '@angular/router';

interface TransformedScholarData {
  id: string;
  name: string;
  schoolName: string;
  grade: number | null;
  schoolColor: string;
  birthDate: string;
  textColor: string;
}

@Component({
  imports: [CommonModule, RouterModule],
  selector: 'app-scholar-table',
  templateUrl: './scholar-table.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./scholar-table.component.css'],
})
export class ScholarTableComponent implements OnInit {
  scholars: Scholar[] = [];
  schools: Map<string, School> = new Map();
  scholarData: TransformedScholarData[] = [];

  currentSortColumn: string = '';
  isAscending: boolean = true;

  constructor(
    private scholarsService: ScholarsService,
    private schoolsService: SchoolsService,
    private sortingService: SortingService,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    forkJoin({
      scholars: this.scholarsService.getScholars(),
      schools: this.schoolsService.getSchools(),
    })
      .pipe(
        map(({ scholars, schools }) => {
          const schoolsMap = new Map(
            schools.map((school) => [school.id.toString(), school]),
          );

          return scholars.map((scholar) => {
            const school = schoolsMap.get(scholar.schoolId?.toString() ?? '');
            const schoolName = school ? school.name : 'Unknown';
            const schoolColor = school ? school.color : '#FFFFFF';
            const textColor = this.getTextColor(schoolColor);

            return {
              id: scholar.id,
              name: `${scholar.firstName} ${scholar.lastName}`,
              schoolName,
              grade: scholar.grade,
              schoolColor,
              birthDate: new Date(scholar.dateOfBirth).toLocaleDateString(
                'en-GB',
                {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                },
              ),
              textColor,
            };
          });
        }),
      )
      .subscribe((transformedData: TransformedScholarData[]) => {
        this.scholarData = transformedData;
      });
  }

  public getTextColor(backgroundColor: string): string {
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return brightness < 128 ? 'white' : 'black';
  }

  sortData(column: string, type: 'string' | 'number' | 'date'): void {
    if (this.currentSortColumn === column) {
      this.isAscending = !this.isAscending;
    } else {
      this.currentSortColumn = column;
      this.isAscending = true;
    }

    this.scholarData = this.sortingService.sort(
      this.scholarData,
      column as keyof TransformedScholarData,
      type,
      this.isAscending,
    );
  }
}
