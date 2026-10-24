import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../session/session';
import { AppHeader } from './app-header';

describe('AppHeader', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => localStorage.clear());

  /** Tekst przycisków i linków w nagłówku, np. ['Jak to działa?', 'Zaloguj się', 'Załóż konto']. */
  function renderedActions(): string[] {
    const fixture = TestBed.createComponent(AppHeader);
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('a[hlmBtn], button');
    return Array.from(items as NodeListOf<HTMLElement>).map((item) => item.textContent!.trim());
  }

  it('gość widzi „Zaloguj się” i „Załóż konto”', () => {
    const actions = renderedActions();

    expect(actions).toContain('Zaloguj się');
    expect(actions).toContain('Załóż konto');
    expect(actions).not.toContain('Wyloguj');
  });

  it('zalogowany widzi „Moje konto” i „Wyloguj”', () => {
    TestBed.inject(Session).start('jwt-token');

    const actions = renderedActions();

    expect(actions).toContain('Moje konto');
    expect(actions).toContain('Wyloguj');
    expect(actions).not.toContain('Zaloguj się');
  });
});
