import { accountErrorMessage } from './account-errors';

describe('accountErrorMessage', () => {
  it('401 przy logowaniu to zły e-mail albo hasło, bez wskazania pola', () => {
    expect(accountErrorMessage(401, 'login')).toEqual({ field: null, message: 'Zły e-mail albo hasło.' });
  });

  it('400 przy rejestracji to zajęty e-mail, przypisany do pola e-mail', () => {
    expect(accountErrorMessage(400, 'register')).toEqual({
      field: 'email',
      message: 'Konto z tym adresem e-mail już istnieje. Zaloguj się.',
    });
  });

  it('status 0 to brak połączenia', () => {
    expect(accountErrorMessage(0, 'login').message).toBe(
      'Brak połączenia z serwerem. Sprawdź połączenie i spróbuj ponownie.',
    );
  });

  it('422 to prośba o sprawdzenie danych', () => {
    expect(accountErrorMessage(422, 'register').message).toBe('Sprawdź dane w formularzu.');
  });

  it('inny błąd, np. 500, dostaje ogólny komunikat', () => {
    expect(accountErrorMessage(500, 'login').message).toBe('Coś poszło nie tak. Spróbuj ponownie za chwilę.');
  });
});
