-- Cruces en el mapa: salir a buscar a alguien (caza) o cruzarse por casualidad (cruce). Se resuelven a su hora.
CREATE TABLE chases (
  id serial PRIMARY KEY,
  kind text NOT NULL,                 -- 'caza' o 'cruce'
  attacker_id int NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  target_id int NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  meet_at bigint NOT NULL,            -- cuándo se cruzan
  place text NOT NULL,                -- cerca de dónde
  target_since bigint NOT NULL,       -- la misión del otro (si la abandonó, no hay cruce)
  target_until bigint NOT NULL,
  attacker_since bigint,              -- para los cruces: la misión del que la empezó
  resolved boolean NOT NULL DEFAULT false
);
CREATE INDEX chases_due ON chases (resolved, meet_at);

-- Vecinos que juegan solos (bots): se ven como jugadores, pero los maneja el servidor
ALTER TABLE players ADD COLUMN bot boolean NOT NULL DEFAULT false;
