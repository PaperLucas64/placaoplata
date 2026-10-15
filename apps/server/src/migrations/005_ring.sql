-- Torneo del Ring: inscriptos de cada temporada (jugadores o boxeadores del barrio), peleas, temporadas e historial
CREATE TABLE ring_entry (
  id serial PRIMARY KEY,
  season text NOT NULL,
  player_id int REFERENCES players(id) ON DELETE CASCADE,
  npc text,
  lvl int NOT NULL,
  points int NOT NULL DEFAULT 0,
  wins int NOT NULL DEFAULT 0,
  losses int NOT NULL DEFAULT 0,
  opponents jsonb NOT NULL DEFAULT '[]',
  joined_at bigint NOT NULL
);
CREATE UNIQUE INDEX ring_entry_player ON ring_entry (season, player_id);
CREATE INDEX ring_entry_season ON ring_entry (season);

CREATE TABLE ring_match (
  id serial PRIMARY KEY,
  season text NOT NULL,
  round int NOT NULL,
  a_id int NOT NULL,
  b_id int,
  winner_id int,
  at bigint NOT NULL
);
CREATE INDEX ring_match_season ON ring_match (season, round);

CREATE TABLE ring_season (
  season text PRIMARY KEY,
  rounds_done int NOT NULL DEFAULT 0,
  closed boolean NOT NULL DEFAULT false
);

CREATE TABLE ring_history (
  season text NOT NULL,
  player_id int NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  place int NOT NULL,
  points int NOT NULL,
  entrants int NOT NULL,
  PRIMARY KEY (season, player_id)
);
