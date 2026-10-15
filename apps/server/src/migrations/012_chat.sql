-- El chat de la ciudad: un solo canal para todos. Se guardan los últimos mensajes (el servidor borra los viejos).
-- El nombre y la pandilla se copian al mandarlo: así el chat se lee igual aunque después cambien.
CREATE TABLE chat (
  id serial PRIMARY KEY,
  t bigint NOT NULL,
  player_id int NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  name text NOT NULL,
  gang text,
  msg text NOT NULL
);
