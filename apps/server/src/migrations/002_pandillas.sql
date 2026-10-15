-- Fin de la placa y la plata: la columna `side` ahora guarda la pandilla (familia, sindicato, barra, amarillos) o NULL.
-- Los estados se convierten solos al cargarse (upgradeState); acá solo se limpia la columna para el ranking y La calle.
UPDATE players SET side = NULL WHERE side IN ('placa', 'plata');
