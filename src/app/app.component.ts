import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GanttChartComponent } from './components/gantt-chart/gantt-chart.component';
import { NavbarComponent } from './components/navbar/navbar.component';

@Component({
  selector: 'app-root',
  imports: [NavbarComponent, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'ImaloEducationWebapp';
}
