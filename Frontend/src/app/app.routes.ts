import { Routes } from '@angular/router';
import { ScholarTableComponent } from './components/scholar-table/scholar-table.component';
import { GanttChartComponent } from './components/gantt-chart/gantt-chart.component';
import { AttendanceComponent } from './components/attendance/attendance.component';
import { ScholarDetailComponent } from './components/scholar-detail/scholar-detail.component';
import { AttendancePerScholarComponent } from './components/attendance-per-scholar/attendance-per-scholar.component';
import { ScholarFormComponent } from './components/scholar-form/scholar-form.component';
import { NotFoundComponent } from './components/not-found/not-found.component';

export const routes: Routes = [
  { path: '', component: ScholarTableComponent },
  { path: 'scholars', component: ScholarTableComponent },
  { path: 'create-scholar', component: ScholarFormComponent },
  { path: 'scholars/:id', component: ScholarDetailComponent },
  { path: 'scholars/update/:id', component: ScholarFormComponent },
  { path: 'pickup-time', component: GanttChartComponent },
  { path: 'attendance', component: AttendanceComponent },
  { path: 'attendance/:id', component: AttendancePerScholarComponent },
  { path: '**', component: NotFoundComponent },
];
