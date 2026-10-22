# Kwestie do ustalenia

Problemy i pytania znalezione przy pracy nad projektem, które wymagają decyzji zespołu albo zmiany w kodzie.

## K1. Brak wiadomości testowej dla kanału

- **Dotyczy:** backend (kanały, powiadomienia)
- **Zgłoszone:** 2026-10-19, przy przeglądzie backendu pod frontend
- **Status:** otwarte

### Problem

Użytkownik dodaje kanał Telegram, wpisując ręcznie swój `chat_id` (`POST /channels`, `backend/app/api/schemas.py:13`). Backend nie sprawdza, czy ten `chat_id` jest poprawny ani czy użytkownik napisał wcześniej do bota. Telegram nie pozwala botowi zacząć rozmowy, więc bez tego wiadomości nie dojdą.

Błąd wychodzi dopiero przy pierwszym alercie. `notify.send` rzuca wyjątek, który kończy się wpisem w logach serwera (`backend/app/jobs/alerts.py:31-32`). Godziny nie trafiają do `alert_events`, więc backend próbuje ponownie przy każdym odświeżeniu, bez końca i po cichu. Użytkownik nie dowie się, że jego kanał nie działa.

### Możliwe rozwiązanie

Endpoint `POST /channels/{id}/test`, który wysyła krótką wiadomość testową przez `notify.send`:

- Gdy wysyłka się uda, zwraca 200.
- Gdy się nie uda, zwraca 400 z opisem z Telegrama, na przykład `chat not found` (zły `chat_id` albo brak rozmowy z botem) albo `bot was blocked by the user`. Ten opis jest bezpieczny do pokazania, bo `notify.telegram` celowo nie umieszcza w błędzie URL-a z tokenem (`backend/app/notify.py:10-11`).

Frontend pokaże przycisk „Wyślij wiadomość testową” zaraz po dodaniu kanału i przy każdym kanale na liście. Można też wysyłać test automatycznie przy `POST /channels` i odrzucać kanał, który nie działa.

Dalszy krok, poza tą kwestią: automatyczne podpinanie Telegrama linkiem `t.me/<bot>?start=<kod>`, żeby użytkownik w ogóle nie wpisywał `chat_id`.

**Ustalenie po stronie frontendu (2026-10-20):** wiadomość testowa jest wymagana w v1 (FR-009 w shape-notes), więc ta kwestia blokuje przepływ alertu na obronie. Podpinanie linkiem to późniejsze rozszerzenie.

## K2. Edycja alertu nie czyści historii wysłanych godzin

- **Dotyczy:** backend (alerty)
- **Zgłoszone:** 2026-10-19, przy przeglądzie backendu pod frontend
- **Status:** otwarte

### Problem

Backend nie wysyła drugi raz tej samej godziny tego samego alertu. Pilnuje tego tabela `alert_events` z ograniczeniem `UNIQUE (alert_id, valid_time)` (`db/init.sql:38`) oraz warunek `NOT EXISTS` w `alert_hits()` (`backend/app/db.py:52`). Kluczem jest `alert_id`, a `PUT /alerts/{id}` (`backend/app/api/crud.py:30`) zmienia wiersz w miejscu i zostawia to samo `id`. Godziny wysłane przed edycją zostają więc zablokowane także dla nowego warunku.

### Przykład

1. Użytkownik ma alert „temperatura < 0 °C w Lublinie”. Dostaje wiadomość o mrozie w środę 20:00–08:00.
2. Zmienia w alercie miejsce na Kraków.
3. W Krakowie też jest mróz w środę 20:00–08:00, ale wiadomość nie przychodzi, bo te godziny są już w `alert_events` dla tego `alert_id`.

To samo dzieje się przy zmianie zmiennej, progu albo operatora.

### Możliwe rozwiązania

Blokada powinna się resetować tylko przy zmianie samego warunku (zmienna, miejsce, operator, próg, okno czasu). Zmiana kanału albo włączenie i wyłączenie alertu (`active`) nie powinny jej ruszać.

1. **Edycja warunku tworzy nowy alert.** Stary jest wyłączany i zostaje razem z historią (FR8). Frontend musi obsłużyć zmianę `id` po edycji, a na liście ukrywać stare wersje.
2. **Czyszczenie `alert_events` przy zmianie warunku.** To jeden `DELETE` w `update`, ale znika historia tego alertu, więc kłóci się z FR8.
3. **Wersja alertu.** Kolumna `version` w `alerts` rośnie przy zmianie warunku, `alert_events` zapisuje wersję, a blokada działa na `(alert_id, version, valid_time)`. `id` i historia zostają, kosztem małej zmiany schematu.

**Ustalenie po stronie frontendu (2026-10-20):** zmiana kanału i włączanie/wyłączanie alertu będą w UI od razu, bo K2 ich nie dotyczy. Edycja warunku czeka na tę poprawkę (FR-013 w shape-notes). Usunięcie alertu i utworzenie go od nowa nie jest obejściem, bo usunięcie kasuje też historię alertu (`ON DELETE CASCADE`, `db/init.sql:34`).

## K3. Godziny w wiadomości z alertem są w UTC

- **Dotyczy:** backend (treść powiadomień)
- **Zgłoszone:** 2026-10-19, przy przeglądzie backendu pod frontend
- **Status:** otwarte

### Problem

`message()` w `backend/app/jobs/alerts.py:10` formatuje godziny w UTC i dopisuje „UTC”, na przykład „20.10 18:00 – 22.10 06:00 UTC”. Na stronie frontend przelicza czasy z API na czas użytkownika. Wiadomość na Telegramie to gotowy tekst, którego nikt już nie przelicza, więc użytkownik musi sam dodać 2 godziny latem albo 1 godzinę zimą.

### Możliwe rozwiązanie

W `message()`, przed formatowaniem, zamieniać godziny przez `.astimezone(ZoneInfo("Europe/Warsaw"))`, a dopisek „UTC” zastąpić „czasu polskiego”. Lepiej „czasu polskiego” niż „lokalnego”, bo dla kogoś za granicą „lokalny” jest niejednoznaczny. Portal obejmuje tylko Polskę, więc wystarczy jedna stała strefa i nie trzeba zapisywać strefy każdego użytkownika. Baza, API i `alert_events` zostają w UTC.

Przy wdrożeniu sprawdzić, czy obraz `python:3.12-slim` ma bazę stref czasowych dla `zoneinfo`. Jeśli nie ma, `zoneinfo` użyje pakietu `tzdata`, który powinien przyjść razem z pandas.

## K4. Brak resetu hasła (FR2)

- **Dotyczy:** backend (konto użytkownika, wysyłka e-maili)
- **Zgłoszone:** 2026-10-19, przy ustalaniu zakresu frontendu
- **Status:** otwarte

### Problem

FR2 wymaga resetu hasła linkiem wysłanym na e-mail. Backend nie ma takiego endpointu i nie wysyła e-maili, bo `notify.py` obsługuje tylko Telegram. Zalogowany użytkownik zmieni hasło przez `PUT /me` (`backend/app/api/users.py:34`), ale ktoś, kto hasło zapomniał, nie odzyska konta.

Frontend v1 nie obejmuje resetu hasła (Non-Goals w shape-notes, decyzja z 2026-10-20). Na obronie loguje się kontem testowym, więc reset nic nie pokazuje. Kwestia zostaje jako możliwe rozszerzenie.

### Możliwe rozwiązanie

Dwa endpointy: `POST /auth/reset` przyjmuje e-mail i wysyła link z jednorazowym, krótko ważnym tokenem, a `POST /auth/reset/confirm` przyjmuje token i nowe hasło. Wymaga to wysyłki e-maili, która przyda się też dla kanału `email` (FR10).

## K5. API nie podaje, z którego odświeżenia pochodzi prognoza

- **Dotyczy:** backend (API prognozy)
- **Zgłoszone:** 2026-10-19, przy ustalaniu zakresu frontendu
- **Status:** otwarte

### Problem

`GET /forecast` i `GET /forecast/map` (`backend/app/api/forecast.py:21`, `:28`) zwracają same wartości, bez czasu powstania prognozy. Odświeżenie startuje co 6 h według UTC (`backend/app/jobs/runner.py:44`) i podmienia całą prognozę zmiennej (`backend/app/db.py:33`). Kiedy było ostatnie udane odświeżenie, wie tylko tabela `jobs`, a ta jest dostępna wyłącznie dla admina (`/jobs`, `/admin/stats`).

Skutki dla frontendu:

- Użytkownik nie widzi, jak świeża jest prognoza (na przykład „prognoza z 08:05”).
- Frontend nie wie, kiedy dane się zmieniły, więc nie może bezpiecznie trzymać ich w cache dłużej niż przez krótki czas. Odgadywanie z harmonogramu nie działa, bo odświeżenie kończy się w nieznanym momencie, a admin może je uruchomić ręcznie. Wpisanie harmonogramu do frontendu powielałoby też logikę backendu.

### Możliwe rozwiązanie

Dodać do odpowiedzi prognozy czas jej wydania, na przykład `issued_at`. Może to być `slot`, od którego refresh liczy godziny (`backend/app/jobs/refresh.py:20`), albo `finished_at` ostatniego udanego odświeżenia. `/forecast/map` zwraca dziś samą listę, więc zmieni się kształt odpowiedzi na `{issued_at, points: [...]}`. To zmiana kontraktu do uzgodnienia.

Dalszy krok: nagłówki `ETag` (na przykład z `issued_at`) i `Cache-Control`, żeby przeglądarka sama trzymała prognozę w cache do następnego odświeżenia.

## K6. Wylogowanie nie unieważnia tokenu

- **Dotyczy:** backend (uwierzytelnianie)
- **Zgłoszone:** 2026-10-20, przy ustalaniu zakresu frontendu
- **Status:** otwarte

### Problem

Token JWT jest ważny 7 dni (`TOKEN_HOURS`, `backend/app/config.py:11`). Backend sprawdza tylko jego podpis i datę ważności (`backend/app/auth.py:28`). Nie ma endpointu wylogowania ani sposobu, żeby unieważnić wydany token. Wylogowanie we frontendzie usuwa więc token tylko z przeglądarki. Jego kopia, na przykład przechwycona albo z innego urządzenia, działa dalej przez 7 dni. Tak samo jest po zmianie hasła: stare tokeny nadal działają.

Frontend chce, żeby wylogowanie kończyło sesję także po stronie serwera (FR-006 w shape-notes).

### Możliwe rozwiązania

1. **Lista unieważnionych tokenów.** Każdy token dostaje identyfikator (`jti`). `POST /auth/logout` zapisuje go w tabeli, a `current_user` odrzuca tokeny z tej tabeli. Wylogowuje tylko jedno urządzenie, ale wymaga sprzątania wygasłych wpisów.
2. **Wersja tokenów w `users`.** Kolumna, na przykład `tokens_valid_after`. Wylogowanie i zmiana hasła ustawiają ją na `now()`, a `current_user` odrzuca tokeny wydane wcześniej. Prostsze, ale wylogowuje wszystkie urządzenia naraz.
3. **Krótki token dostępu i token odświeżający.** Najbardziej złożone, raczej poza zakresem pracy.

## K7. Zmiana hasła i e-maila bez podania obecnego hasła

- **Dotyczy:** backend (konto użytkownika)
- **Zgłoszone:** 2026-10-20, przy ustalaniu zakresu frontendu
- **Status:** otwarte

### Problem

`PUT /me` (`backend/app/api/users.py:34`) zapisuje nowy e-mail i nowe hasło bez sprawdzenia obecnego hasła. Ktoś z dostępem do zalogowanej przeglądarki albo z przechwyconym tokenem (K6) zmieni hasło i przejmie konto. Do tego e-mail i hasło da się zmienić tylko razem, bo `Credentials` wymaga obu pól.

### Możliwe rozwiązanie

Osobny schemat dla `PUT /me`: wymagane `current_password` oraz opcjonalne `email` i `password`. Backend sprawdza `current_password` przez `check_password` i zmienia tylko podane pola. Frontend dodaje w formularzu konta pole „Obecne hasło”. Po zmianie hasła warto też unieważnić stare tokeny (K6, rozwiązanie 2).

## K8. Admin może odebrać sobie rolę albo usunąć własne konto

- **Dotyczy:** backend (panel administratora)
- **Zgłoszone:** 2026-10-20, przy ustalaniu zakresu frontendu
- **Status:** otwarte

### Problem

`PUT /admin/users/{user_id}` i `DELETE /admin/users/{user_id}` (`backend/app/api/admin.py:27`, `:33`) nie sprawdzają, czy admin działa na własnym koncie. Admin może więc odebrać sobie rolę albo usunąć swoje konto. Jeśli był jedynym adminem, system zostaje bez admina. Po usunięciu konta da się to naprawić rejestracją z `ADMIN_EMAIL`. Po samym odebraniu roli zostaje tylko ręczna zmiana w bazie, bo konto z tym e-mailem już istnieje.

Frontend zablokuje te akcje na własnym koncie (FR-016 w shape-notes). To chroni jednak tylko przed pomyłką w UI, a nie przed żądaniem wysłanym prosto do API.

### Możliwe rozwiązanie

Router ma `admin_user` tylko w `dependencies`, więc endpointy nie znają zalogowanego admina. Wystarczy dodać do obu funkcji parametr `admin=Depends(admin_user)` i zwracać 400, gdy `user_id == admin["id"]`. Łagodniejszy wariant blokuje tylko operację, po której nie zostałby żaden admin.

## K9. Alert z cudzym albo nieistniejącym kanałem kończy się błędem 500

- **Dotyczy:** backend (API alertów)
- **Zgłoszone:** 2026-10-20, przy ustalaniu zakresu frontendu
- **Status:** otwarte

### Problem

`POST /alerts` i `PUT /alerts/{id}` (`backend/app/api/crud.py:25`, `:30`) nie sprawdzają `channel_id`. Ochronę daje złożony klucz obcy `(channel_id, user_id)` w `db/init.sql:29`, więc nie da się podpiąć alertu pod cudzy kanał. Baza odrzuca jednak taki zapis wyjątkiem, którego nikt nie łapie, i API zwraca 500 zamiast błędu walidacji. To samo dzieje się przy kanale, który w międzyczasie usunięto. Frontend nie odróżni wtedy złych danych od awarii serwera.

### Możliwe rozwiązanie

Przed zapisem alertu sprawdzić, czy kanał istnieje i należy do użytkownika, i zwracać 422 (albo 404). Wariant ogólny to handler `IntegrityError` w `main.py`, który zamienia naruszenie klucza obcego na 4xx.
