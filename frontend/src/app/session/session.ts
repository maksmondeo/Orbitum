import { computed, Service, signal } from '@angular/core';
import { isTokenValid } from './token-expiry';

const STORAGE_KEY = 'orbitum.token';

/** Dlaczego sesja się skończyła: użytkownik kliknął „Wyloguj” albo token wygasł. */
export type EndReason = 'logout' | 'expired';

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (token === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Przeglądarka blokuje localStorage: sesja trwa do odświeżenia strony.
  }
}

/** Jedyne źródło prawdy o tym, czy ktoś jest zalogowany. Nie zna sieci ani routera. */
@Service()
export class Session {
  private readonly tokenState = signal<string | null>(null);
  private readonly endReasonState = signal<EndReason | null>(null);

  readonly token = this.tokenState.asReadonly();
  readonly isLoggedIn = computed(() => this.tokenState() !== null);
  /** Powód ostatniego zakończenia sesji. `null` po zalogowaniu i zanim sesja się skończyła. */
  readonly endReason = this.endReasonState.asReadonly();

  constructor() {
    const stored = readStoredToken();
    if (stored === null) return;

    if (isTokenValid(stored, new Date())) this.tokenState.set(stored);
    else this.end('expired');
  }

  /** Czy token jest i jeszcze nie wygasł. Zalogowany (`isLoggedIn`) może mieć token, który już wygasł. */
  hasValidToken(now = new Date()): boolean {
    const token = this.tokenState();
    return token !== null && isTokenValid(token, now);
  }

  start(token: string): void {
    this.tokenState.set(token);
    this.endReasonState.set(null);
    writeStoredToken(token);
  }

  /** Usuwa token tylko z przeglądarki. Po K6 (unieważnianie tokenu) dojdzie tu `POST /auth/logout`. */
  end(reason: EndReason): void {
    this.tokenState.set(null);
    this.endReasonState.set(reason);
    writeStoredToken(null);
  }
}
