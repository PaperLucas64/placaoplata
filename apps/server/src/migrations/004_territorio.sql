-- Influencia de cada pandilla en cada barrio. Se guarda el valor y cuándo se actualizó:
-- al leer o sumar, se le descuenta lo que se gastó con el tiempo (la mitad por semana).
CREATE TABLE territory (
  barrio text NOT NULL,
  gang text NOT NULL,
  points double precision NOT NULL DEFAULT 0,
  updated_at bigint NOT NULL,
  PRIMARY KEY (barrio, gang)
);
