import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GanttChartComponent } from './components/gantt-chart/gantt-chart.component';

@Component({
  selector: 'app-root',
  imports: [GanttChartComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'ImaloEducationWebapp';
}
