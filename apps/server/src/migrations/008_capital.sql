-- Maires pasa a ser solo Capital: se renueva el tablón de la calle (tenía misiones en barrios que ya no están)
UPDATE players SET state = jsonb_set(state, '{tBoard}', '0'::jsonb);
