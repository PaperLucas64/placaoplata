CREATE TABLE users (
  id serial PRIMARY KEY,
  username text NOT NULL,
  pass_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_username_key ON users (lower(username));

CREATE TABLE sessions (
  token text PRIMARY KEY,
  user_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

-- El estado completo del personaje vive en `state` (jsonb). Las columnas sueltas son copias
-- para poder buscar rivales y armar el ranking sin leer el json.
CREATE TABLE players (
  id serial PRIMARY KEY,
  user_id int NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  side text,
  lvl int NOT NULL DEFAULT 1,
  respect int NOT NULL DEFAULT 0,
  gold int NOT NULL DEFAULT 0,
  state jsonb NOT NULL,
  last_seen timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX players_side_lvl ON players (side, lvl);
CREATE INDEX players_respect ON players (respect DESC);

-- Historial de peleas entre jugadores (y para no atacar al mismo todo el tiempo)
CREATE TABLE pvp_log (
  id serial PRIMARY KEY,
  attacker_id int NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  defender_id int NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  attacker_won boolean NOT NULL,
  gold int NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pvp_log_attacker ON pvp_log (attacker_id, at DESC);
