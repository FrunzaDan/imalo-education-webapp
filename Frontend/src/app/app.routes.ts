import { Routes } from '@angular/router';
import { ScholarTableComponent } from './components/scholar-table/scholar-table.component';
import { GanttChartComponent } from './components/gantt-chart/gantt-chart.component';
import { AttendanceComponent } from './components/attendance/attendance.component';
import { ScholarDetailComponent } from './components/scholar-detail/scholar-detail.component';
import { AttendancePerScholarComponent } from './components/attendance-per-scholar/attendance-per-scholar.component';
import { ScholarFormComponent } from './components/scholar-form/scholar-form.component';
import { NotFoundComponent } from './components/not-found/not-found.component';
import { AboutComponent } from './components/about/about.component';
import { GlobalAuditLogComponent } from './components/global-audit-log/global-audit-log.component';

export const routes: Routes = [
  { path: '', component: ScholarTableComponent },
  { path: 'scholars', component: ScholarTableComponent },
  { path: 'create-scholar', component: ScholarFormComponent },
  { path: 'scholars/:id', component: ScholarDetailComponent },
  { path: 'scholars/update/:id', component: ScholarFormComponent },
  { path: 'pickup-time', component: GanttChartComponent },
  { path: 'attendance', component: AttendanceComponent },
  { path: 'attendance/:id', component: AttendancePerScholarComponent },
  { path: 'audit-log', component: GlobalAuditLogComponent },
  { path: 'about', component: AboutComponent },
  { path: '**', component: NotFoundComponent },
];
