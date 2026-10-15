-- El barrio «Recoleta Bien» pasa a llamarse «Reloquita»: en las partidas guardadas, el mapa, las misiones de a dos y los cruces
UPDATE players SET state = replace(state::text, 'Recoleta Bien', 'Reloquita')::jsonb WHERE state::text LIKE '%Recoleta Bien%';
UPDATE territory SET barrio = 'Reloquita' WHERE barrio = 'Recoleta Bien';
UPDATE coop SET mission = replace(mission::text, 'Recoleta Bien', 'Reloquita')::jsonb WHERE mission::text LIKE '%Recoleta Bien%';
UPDATE chases SET place = 'Reloquita' WHERE place = 'Recoleta Bien';
