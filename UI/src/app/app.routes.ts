import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./components/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
  },
  {
    path: 'scholars',
    loadComponent: () =>
      import('./components/scholar-table/scholar-table.component').then(
        (m) => m.ScholarTableComponent,
      ),
  },
  {
    path: 'create-scholar',
    loadComponent: () =>
      import('./components/scholar-form/scholar-form.component').then(
        (m) => m.ScholarFormComponent,
      ),
  },
  {
    path: 'scholars/:id',
    loadComponent: () =>
      import('./components/scholar-detail/scholar-detail.component').then(
        (m) => m.ScholarDetailComponent,
      ),
  },
  {
    path: 'scholars/update/:id',
    loadComponent: () =>
      import('./components/scholar-form/scholar-form.component').then(
        (m) => m.ScholarFormComponent,
      ),
  },
  {
    path: 'pickup-time',
    loadComponent: () =>
      import('./components/gantt-chart/gantt-chart.component').then(
        (m) => m.GanttChartComponent,
      ),
  },
  {
    path: 'attendance',
    loadComponent: () =>
      import('./components/attendance/attendance.component').then(
        (m) => m.AttendanceComponent,
      ),
  },
  {
    path: 'attendance/:id',
    loadComponent: () =>
      import(
        './components/attendance-per-scholar/attendance-per-scholar.component'
      ).then((m) => m.AttendancePerScholarComponent),
  },
  {
    path: 'charts',
    loadComponent: () =>
      import('./components/charts/charts.component').then(
        (m) => m.ChartsComponent,
      ),
  },
  {
    path: 'audit-log',
    loadComponent: () =>
      import('./components/global-audit-log/global-audit-log.component').then(
        (m) => m.GlobalAuditLogComponent,
      ),
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./components/about/about.component').then(
        (m) => m.AboutComponent,
      ),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./components/not-found/not-found.component').then(
        (m) => m.NotFoundComponent,
      ),
  },
];
