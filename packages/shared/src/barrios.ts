/* Cómo es cada barrio: de eso dependen los precios de las casas y qué servicios tiene (salita o clínica). */
export type Tier = "humilde" | "medio" | "rico";
const RICO = ["Puerto Madero", "Recoleta", "Palermo", "Belgrano", "Núñez", "Coghlan", "Colegiales", "Villa Devoto"];
const HUMILDE = ["Liniers", "Villa Luro", "Versalles", "Flores", "Floresta", "La Paternal", "Villa Santa Rita", "Villa General Mitre", "Monte Castro", "Retiro"];
export const tierOf = (barrio: string): Tier => (RICO.includes(barrio) ? "rico" : HUMILDE.includes(barrio) ? "humilde" : "medio");
export const TIER_NAME: Record<Tier, string> = { humilde: "Barrio humilde", medio: "Barrio de clase media", rico: "Barrio caro" };
