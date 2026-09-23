import { Component, inject, PLATFORM_ID } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { of } from 'rxjs';
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
export class App {
  protected readonly environment = environment;

  private readonly healthService = inject(HealthService);
  private readonly platformId = inject(PLATFORM_ID);

  // Repeated polling only makes sense in the browser — during SSR/prerendering
  // it would keep the app permanently "unstable", which hangs the build's
  // prerender step waiting for a stability signal that never arrives.
  readonly apiAvailable = toSignal(
    isPlatformBrowser(this.platformId)
      ? this.healthService.pollApiHealth()
      : of(true),
    { initialValue: true },
  );
}
