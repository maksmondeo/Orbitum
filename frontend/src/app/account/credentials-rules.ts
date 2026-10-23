import { minLength, pattern, PathKind, required, SchemaPath, SchemaPathRules } from '@angular/forms/signals';

/**
 * Ten sam wzorzec co `Credentials.email` w `backend/app/api/schemas.py`. Wbudowany `email()` z Signal Forms
 * przepuszcza np. `jan@localhost`, które backend odrzuca (422). Backend i tak waliduje sam,
 * a tu tylko podpowiadamy wcześniej (NFR8).
 */
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Tyle samo co `Credentials.password` w backendzie. Dotyczy też logowania: krótsze hasło dałoby tam 422, a nie 401. */
const MIN_PASSWORD_LENGTH = 8;

/** Reguły pola e-mail wspólne dla logowania i rejestracji. */
export function emailRules<K extends PathKind>(path: SchemaPath<string, SchemaPathRules.Supported, K>): void {
  required(path, { message: 'Podaj adres e-mail.' });
  pattern(path, EMAIL_PATTERN, { message: 'Podaj adres e-mail w formacie nazwa@domena.pl.' });
}

/** Reguły pola hasła wspólne dla logowania i rejestracji. */
export function passwordRules<K extends PathKind>(path: SchemaPath<string, SchemaPathRules.Supported, K>): void {
  required(path, { message: 'Podaj hasło.' });
  minLength(path, MIN_PASSWORD_LENGTH, { message: 'Hasło ma co najmniej 8 znaków.' });
}
