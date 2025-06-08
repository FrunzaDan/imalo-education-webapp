import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GanttChartComponent } from './components/gantt-chart/gantt-chart.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [NavbarComponent, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  title = 'ImaloEducationWebapp';
  environment = environment;
  apiAvailable = true;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    // Check API health by pinging endpoint
    this.http.get(environment.baseUrlScholars).subscribe({
      next: () => (this.apiAvailable = true),
      error: () => (this.apiAvailable = false),
    });
  }
}
