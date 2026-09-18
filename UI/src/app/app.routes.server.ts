import { RenderMode, ServerRoute } from '@angular/ssr';

// Data-driven pages (anything that calls the API) render per-request instead
// of prerendering at build time — the build previously tried to prerender
// the scholar list and failed if the API wasn't running during the build.
// The create form and the About page have no data dependency on load (About
// only calls the API when its buttons are clicked), so both are fine to prerender.
export const serverRoutes: ServerRoute[] = [
  { path: 'create-scholar', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Server },
];
