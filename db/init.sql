CREATE TABLE users (
    id            serial PRIMARY KEY,
    email         text UNIQUE NOT NULL,
    password_hash text NOT NULL,                          -- bcrypt (NFR3)
    is_admin      boolean NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE channels (                                   -- gdzie wysyłać powiadomienia
    id      serial PRIMARY KEY,
    user_id int NOT NULL REFERENCES users ON DELETE CASCADE,
    kind    text NOT NULL CHECK (kind IN ('email', 'discord', 'telegram')),
    target  text NOT NULL                                 -- adres e-mail, webhook albo chat_id
);

CREATE TABLE alerts (
    id         serial PRIMARY KEY,
    user_id    int NOT NULL REFERENCES users ON DELETE CASCADE,
    channel_id int NOT NULL REFERENCES channels ON DELETE CASCADE,
    variable   text NOT NULL CHECK (variable IN ('temperature_2m', 'pressure_msl')),
    lat_min    real NOT NULL, lat_max real NOT NULL,      -- punkt: min = max (FR6)
    lon_min    real NOT NULL, lon_max real NOT NULL,
    op         char(1) NOT NULL CHECK (op IN ('<', '>')),
    threshold  real NOT NULL,                             -- np. temperatura < 0
    valid_from timestamptz, valid_to timestamptz,         -- przedział czasu; NULL = bez ograniczeń
    active     boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE alert_events (                               -- historia wysłanych alertów (FR8), blokuje duplikaty
    id         serial PRIMARY KEY,
    alert_id   int NOT NULL REFERENCES alerts ON DELETE CASCADE,
    valid_time timestamptz NOT NULL,
    value      real NOT NULL,
    sent_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (alert_id, valid_time)
);

CREATE TABLE forecast (                                   -- najnowsza prognoza: wartość w punkcie siatki i godzinie
    variable   text NOT NULL,
    lat        real NOT NULL,
    lon        real NOT NULL,
    valid_time timestamptz NOT NULL,
    value      real NOT NULL,
    PRIMARY KEY (variable, lat, lon, valid_time)
);

CREATE TABLE jobs (                                       -- przebiegi odświeżania i przeliczania (FR14)
    id          serial PRIMARY KEY,
    kind        text NOT NULL CHECK (kind IN ('refresh', 'recompute')),
    started_at  timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    status      text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ok', 'error')),
    message     text
);
