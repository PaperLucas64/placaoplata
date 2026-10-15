-- Amigos: a pide, b acepta
CREATE TABLE friends (
  a_id int NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  b_id int NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (a_id, b_id)
);
CREATE INDEX friends_b ON friends (b_id);

-- Misiones de a dos: invited -> waiting (aceptada, esperando que los dos estén libres) -> running -> done
-- (o declined / cancelled). La misión generada se guarda acá para que los dos vean lo mismo.
CREATE TABLE coop (
  id serial PRIMARY KEY,
  host_id int NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  guest_id int NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  mission jsonb NOT NULL,
  status text NOT NULL DEFAULT 'invited',
  since bigint, until bigint,
  done int NOT NULL DEFAULT 0, ok int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coop_guest ON coop (guest_id, status);
CREATE INDEX coop_host ON coop (host_id, status);
