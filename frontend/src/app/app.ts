import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeader } from './app-header/app-header';

/**
 * Powłoka aplikacji: nagłówek i obszar treści dzielą wysokość ekranu. Strona mapy wypełnia obszar
 * treści (`h-full`), pozostałe strony przewijają się w nim.
 */
@Component({
  imports: [RouterOutlet, AppHeader],
  selector: 'app-root',
  template: `
    <div class="flex h-dvh flex-col">
      <app-header class="shrink-0" />
      <div class="min-h-0 flex-1 overflow-y-auto">
        <router-outlet />
      </div>
    </div>
  `,
})
export class App {}
