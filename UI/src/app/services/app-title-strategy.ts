import { inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

const APP_NAME = 'Imalo Education Webapp';

// "<page> · Imalo Education Webapp" — each route's `title` says where you
// are, the suffix says which app (WCAG 2.4.2 Page Titled).
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const pageTitle = this.buildTitle(snapshot);
    this.title.setTitle(pageTitle ? `${pageTitle} · ${APP_NAME}` : APP_NAME);
  }
}
