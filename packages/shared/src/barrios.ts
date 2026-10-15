/* Cómo es cada barrio: de eso dependen los precios de las casas y qué servicios tiene (salita o clínica). */
export type Tier = "humilde" | "medio" | "rico";
const RICO = ["Puerto Mareo", "Reloquita", "Palermo Soja", "Belgranito", "Ñuñez", "Coglán", "Colegas", "Villa Devota"];
const HUMILDE = ["Liniers Sur", "Villa Lurio", "Versalles Chico", "Floreros", "Florestita", "La Paterna", "Villa Santa Rata", "Villa Mitrecito", "Monte Castrito", "Salida"];
export const tierOf = (barrio: string): Tier => (RICO.includes(barrio) ? "rico" : HUMILDE.includes(barrio) ? "humilde" : "medio");
export const TIER_NAME: Record<Tier, string> = { humilde: "Barrio humilde", medio: "Barrio de clase media", rico: "Barrio caro" };
