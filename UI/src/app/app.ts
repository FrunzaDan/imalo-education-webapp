import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { environment } from '../environments/environment';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FooterComponent } from './components/footer/footer.component';
import { NotificationComponent } from './components/notification/notification.component';
import { ConfirmModalComponent } from './components/confirm-modal/confirm-modal.component';
import { HealthService } from './services/health.service';

@Component({
  selector: 'app-root',
  imports: [
    NavbarComponent,
    FooterComponent,
    NotificationComponent,
    ConfirmModalComponent,
    RouterOutlet,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  title = 'ImaloEducationWebapp';
  environment = environment;
  apiAvailable = signal(true);

  private healthSubscription?: Subscription;

  constructor(
    private healthService: HealthService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit(): void {
    // Repeated polling only makes sense in the browser — during SSR/prerendering
    // it would keep the zone permanently "unstable", which hangs the build's
    // prerender step waiting for a stability signal that never arrives.
    if (!isPlatformBrowser(this.platformId)) return;

    this.healthSubscription = this.healthService
      .pollApiHealth()
      .subscribe((status) => {
        this.apiAvailable.set(status);
      });
  }

  ngOnDestroy(): void {
    this.healthSubscription?.unsubscribe();
  }
}
