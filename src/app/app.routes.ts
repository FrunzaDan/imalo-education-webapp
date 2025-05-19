import { Routes } from '@angular/router';
import { ScholarTableComponent } from './components/scholar-table/scholar-table.component';
import { GanttChartComponent } from './components/gantt-chart/gantt-chart.component';
import { AttendanceComponent } from './components/attendance/attendance.component';
import { ScholarDetailComponent } from './components/scholar-detail/scholar-detail.component';

export const routes: Routes = [
  { path: '', component: ScholarTableComponent },
  { path: 'scholars', component: ScholarTableComponent },
  { path: 'scholars/:id', component: ScholarDetailComponent },
  { path: 'pickup-time', component: GanttChartComponent },
  { path: 'attendance', component: AttendanceComponent },
];
