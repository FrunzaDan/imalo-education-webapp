import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { NavbarComponent } from './components/navbar/navbar.component';
import { HealthService } from './services/health.service';

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

  constructor(private healthService: HealthService) {}

  ngOnInit(): void {
    this.healthService.checkApiHealth().subscribe((status) => {
      this.apiAvailable = status;
    });
  }
}
