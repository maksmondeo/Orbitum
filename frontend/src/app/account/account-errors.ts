export interface AccountError {
  /** Pole formularza, którego dotyczy błąd. `null` oznacza błąd całego formularza. */
  field: 'email' | null;
  message: string;
}

/**
 * Status HTTP z logowania albo rejestracji jako polski komunikat. Backend odpowiada po angielsku
 * (np. 400 z tekstem Postgresa o zajętym e-mailu), a użytkownik nie ma tego zobaczyć.
 */
export function accountErrorMessage(status: number, action: 'login' | 'register'): AccountError {
  if (status === 401 && action === 'login') {
    return { field: null, message: 'Zły e-mail albo hasło.' };
  }
  if (status === 400 && action === 'register') {
    return { field: 'email', message: 'Konto z tym adresem e-mail już istnieje. Zaloguj się.' };
  }
  if (status === 0) {
    return { field: null, message: 'Brak połączenia z serwerem. Sprawdź połączenie i spróbuj ponownie.' };
  }
  if (status === 422) {
    return { field: null, message: 'Sprawdź dane w formularzu.' };
  }
  return { field: null, message: 'Coś poszło nie tak. Spróbuj ponownie za chwilę.' };
}
