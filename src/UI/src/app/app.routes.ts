import { Routes } from '@angular/router';
import { unsavedChangesGuard } from './services/unsaved-changes.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    title: 'Dashboard',
    loadComponent: () =>
      import('./components/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
  },
  {
    path: 'scholars',
    title: 'Scholars',
    loadComponent: () =>
      import('./components/scholar-list/scholar-list.component').then(
        (m) => m.ScholarListComponent,
      ),
  },
  {
    path: 'create-scholar',
    title: 'Add scholar',
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./components/scholar-form/scholar-form.component').then(
        (m) => m.ScholarFormComponent,
      ),
  },
  {
    path: 'scholars/:scholarId',
    title: 'Scholar details',
    loadComponent: () =>
      import('./components/scholar-details/scholar-details.component').then(
        (m) => m.ScholarDetailsComponent,
      ),
  },
  {
    path: 'scholars/update/:scholarId',
    title: 'Edit scholar',
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./components/scholar-form/scholar-form.component').then(
        (m) => m.ScholarFormComponent,
      ),
  },
  {
    path: 'pickup-time',
    title: 'Pickup time',
    loadComponent: () =>
      import('./components/gantt-chart/gantt-chart.component').then(
        (m) => m.GanttChartComponent,
      ),
  },
  {
    path: 'attendance',
    title: 'Attendance',
    loadComponent: () =>
      import('./components/attendance/attendance.component').then(
        (m) => m.AttendanceComponent,
      ),
  },
  {
    path: 'attendance/:scholarId',
    title: 'Scholar attendance',
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./components/attendance-per-scholar/attendance-per-scholar.component').then(
        (m) => m.AttendancePerScholarComponent,
      ),
  },
  {
    path: 'charts',
    title: 'Charts',
    loadComponent: () =>
      import('./components/charts/charts.component').then(
        (m) => m.ChartsComponent,
      ),
  },
  {
    path: 'audit-log',
    title: 'Audit log',
    loadComponent: () =>
      import('./components/global-audit-log/global-audit-log.component').then(
        (m) => m.GlobalAuditLogComponent,
      ),
  },
  {
    path: 'about',
    title: 'About',
    loadComponent: () =>
      import('./components/about/about.component').then(
        (m) => m.AboutComponent,
      ),
  },
  {
    path: '**',
    title: 'Page not found',
    loadComponent: () =>
      import('./components/page-not-found/page-not-found.component').then(
        (m) => m.PageNotFoundComponent,
      ),
  },
];
