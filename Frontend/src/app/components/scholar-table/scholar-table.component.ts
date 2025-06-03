import { Component, OnInit } from '@angular/core';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { SortingService } from '../../services/sorting.service';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { CommonModule } from '@angular/common';
import { forkJoin, Observable } from 'rxjs'; // Import Observable
import { map } from 'rxjs/operators'; // Only need map, switchMap is no longer needed here
import { RouterModule } from '@angular/router';

// Define the type for the transformed scholar data once for clarity
interface TransformedScholarData {
  id: string;
  name: string;
  schoolName: string;
  grade: number;
  schoolColor: string;
  birthDate: string;
  textColor: string;
}

@Component({
  imports: [CommonModule, RouterModule],
  selector: 'app-scholar-table',
  templateUrl: './scholar-table.component.html',
  styleUrls: ['./scholar-table.component.css'],
})
export class ScholarTableComponent implements OnInit {
  scholars: Scholar[] = []; // You might not need to store this directly if `scholarData` is primary
  schools: Map<string, School> = new Map(); // You might not need to store this directly either
  scholarData: TransformedScholarData[] = []; // Use the defined interface

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
        // Use a single map operator to process both streams
        map(({ scholars, schools }) => {
          // Create the schools map directly within this operator's scope
          const schoolsMap = new Map(
            schools.map((school) => [school.id.toString(), school]),
          );

          // Transform scholar data using the local schoolsMap
          return scholars.map((scholar) => {
            const school = schoolsMap.get(scholar.schoolId.toString());
            const schoolName = school ? school.name : 'Unknown';
            const schoolColor = school ? school.color : '#FFFFFF';
            const textColor = this.getTextColor(schoolColor);

            return {
              id: scholar.id,
              name: `${scholar.firstName} ${scholar.lastName}`,
              schoolName,
              grade: scholar.grade,
              schoolColor,
              birthDate: new Date(scholar.DateOfBirth).toLocaleDateString(
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
        // Assign the fully transformed data to scholarData in the subscribe callback
        this.scholarData = transformedData;
      });
  }

  // Moved out to ensure no reliance on component properties
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
      column as keyof TransformedScholarData, // Use the new interface for keyof
      type,
      this.isAscending,
    );
  }
}
