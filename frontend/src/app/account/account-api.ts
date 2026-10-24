import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_URL } from '../api/api-url';
import { withAuth } from '../session/auth-interceptor';

export interface Credentials {
  email: string;
  password: string;
}

export interface User {
  id: number;
  email: string;
  isAdmin: boolean;
  createdAt: Date;
}

interface TokenResponse {
  token: string;
}

interface UserResponse {
  id: number;
  email: string;
  is_admin: boolean;
  created_at: string;
}

/** Operacje konta w backendzie. Nie zapisuje tokenu: robi to strona przez `Session.start`. Bez cache, bo dane konta mają być świeże. */
@Service()
export class AccountApi {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  /** Zakłada konto. Backend od razu zwraca token, więc rejestracja oznacza też zalogowanie. */
  register(credentials: Credentials): Observable<string> {
    return this.http
      .post<TokenResponse>(`${this.apiUrl}/auth/register`, credentials)
      .pipe(map((response) => response.token));
  }

  login(credentials: Credentials): Observable<string> {
    return this.http
      .post<TokenResponse>(`${this.apiUrl}/auth/login`, credentials)
      .pipe(map((response) => response.token));
  }

  /** Konto zalogowanego użytkownika. Wymaga tokenu, więc wolno je wołać tylko z chronionych stron. */
  me(): Observable<User> {
    return this.http.get<UserResponse>(`${this.apiUrl}/me`, { context: withAuth() }).pipe(
      map((response) => ({
        id: response.id,
        email: response.email,
        isAdmin: response.is_admin,
        createdAt: new Date(response.created_at),
      })),
    );
  }
}
