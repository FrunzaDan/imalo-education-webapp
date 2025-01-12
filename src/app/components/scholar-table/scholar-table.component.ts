import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { CommonModule } from '@angular/common';

@Component({
  imports: [CommonModule],
  selector: 'app-scholar-table',
  templateUrl: './scholar-table.component.html',
  styleUrls: ['./scholar-table.component.css'],
})
export class ScholarTableComponent implements OnInit {
  scholars: Scholar[] = [];
  schools: Map<string, School> = new Map();
  scholarData: {
    name: string;
    schoolName: string;
    grade: number;
    schoolColor: string;
    birthDate: string;
  }[] = [];

  constructor(
    private scholarsService: ScholarsService,
    private schoolsService: SchoolsService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    forkJoin({
      scholars: this.scholarsService.getScholars(),
      schools: this.schoolsService.getSchools(),
    }).subscribe(({ scholars, schools }) => {
      this.scholars = scholars;
      this.schools = new Map(
        schools.map((school) => [school.id.toString(), school])
      );
      this.mergeScholarData();
    });
  }

  private mergeScholarData(): void {
    this.scholarData = this.scholars.map((scholar) => {
      const school = this.schools.get(scholar.schoolId.toString());

      return {
        name: `${scholar.firstName} ${scholar.lastName}`,
        schoolName: school ? school.name : 'Unknown',
        grade: scholar.grade,
        schoolColor: school ? school.color : '#FFFFFF', // Default to white if no color
        birthDate: new Date(scholar.birthDate).toLocaleDateString(), // Format the birthdate for display
      };
    });
  }

  getTextColor(backgroundColor: string): string {
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return brightness < 128 ? 'white' : 'black';
  }
}
