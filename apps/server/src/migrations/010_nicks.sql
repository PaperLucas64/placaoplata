-- Los vecinos que juegan solos pasan a tener nicks de usuario (como cualquier jugador)
UPDATE users SET username = 'Malickud' WHERE username = 'Tincho Ferreyra';
UPDATE players SET name = 'Malickud', state = jsonb_set(state, '{name}', to_jsonb('Malickud'::text)) WHERE name = 'Tincho Ferreyra' AND bot;
UPDATE users SET username = 'Bondiabera' WHERE username = 'La Colorada Paz';
UPDATE players SET name = 'Bondiabera', state = jsonb_set(state, '{name}', to_jsonb('Bondiabera'::text)) WHERE name = 'La Colorada Paz' AND bot;
UPDATE users SET username = 'Pochoclo22' WHERE username = 'Pocho Benítez';
UPDATE players SET name = 'Pochoclo22', state = jsonb_set(state, '{name}', to_jsonb('Pochoclo22'::text)) WHERE name = 'Pocho Benítez' AND bot;
UPDATE users SET username = 'Yesiquita' WHERE username = 'Yésica Ramos';
UPDATE players SET name = 'Yesiquita', state = jsonb_set(state, '{name}', to_jsonb('Yesiquita'::text)) WHERE name = 'Yésica Ramos' AND bot;
UPDATE users SET username = 'Nachuflo' WHERE username = 'Nacho del Once';
UPDATE players SET name = 'Nachuflo', state = jsonb_set(state, '{name}', to_jsonb('Nachuflo'::text)) WHERE name = 'Nacho del Once' AND bot;
UPDATE users SET username = 'Juancarlitox' WHERE username = 'Juanca Godoy';
UPDATE players SET name = 'Juancarlitox', state = jsonb_set(state, '{name}', to_jsonb('Juancarlitox'::text)) WHERE name = 'Juanca Godoy' AND bot;
UPDATE users SET username = 'Lalitrona' WHERE username = 'Lali Torres';
UPDATE players SET name = 'Lalitrona', state = jsonb_set(state, '{name}', to_jsonb('Lalitrona'::text)) WHERE name = 'Lali Torres' AND bot;
UPDATE users SET username = 'ChinoLoco_' WHERE username = 'El Chino Acuña';
UPDATE players SET name = 'ChinoLoco_', state = jsonb_set(state, '{name}', to_jsonb('ChinoLoco_'::text)) WHERE name = 'El Chino Acuña' AND bot;
