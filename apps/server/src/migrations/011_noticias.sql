-- Noticias locales: lo que pasa en la ciudad (abajo del mapa, como el diario del SimCity)
CREATE TABLE news (
  id serial PRIMARY KEY,
  t bigint NOT NULL,
  msg text NOT NULL
);
CREATE INDEX news_t ON news (t DESC);
