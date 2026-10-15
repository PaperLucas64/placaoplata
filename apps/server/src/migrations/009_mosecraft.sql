-- Monsefrat pasa a llamarse Mosecraft
UPDATE players SET state = replace(state::text, 'Monsefrat', 'Mosecraft')::jsonb WHERE state::text LIKE '%Monsefrat%';
UPDATE territory SET barrio = 'Mosecraft' WHERE barrio = 'Monsefrat';
UPDATE chases SET place = 'Mosecraft' WHERE place = 'Monsefrat';
