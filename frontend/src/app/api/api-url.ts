import { InjectionToken } from '@angular/core';

/** Adres backendu. Testy i wdrożenie za Nginx podmieniają go przez `providers`. */
export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:8000',
});
