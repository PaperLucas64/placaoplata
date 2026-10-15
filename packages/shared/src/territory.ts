/* Territorio: los 12 barrios de Maires y la influencia de cada pandilla en ellos.
   La influencia la generan los jugadores trabajando para una pandilla y se va gastando (la mitad por semana).
   El barrio es de la pandilla con más influencia. Cada barrio de tu pandilla te da +2% de plata. */
import { GANG_KEYS } from "./gangs.js";
import { gangOf } from "./rules.js";
import type { Gang, PlayerState } from "./types.js";

export const BARRIOS = ["La Bocota", "Puerto Mareo", "San Telmón", "Palermo Soja", "Villa Crespa", "Barrancas", "Florida Vieja",
  "Once y Medio", "Mataderos", "Recoleta Bien", "Liniers Sur", "Pompeya Chica"];
/* el barrio de cada pandilla (ahí suman sus misiones de la historia y sus encargos) */
export const HOME_BARRIO: Record<Gang, string> = { familia: "Puerto Mareo", sindicato: "Barrancas", barra: "La Bocota", amarillos: "Once y Medio" };

export const TURF_HALF_LIFE = 7 * 24 * 3_600_000; // la influencia pierde la mitad por semana
export const TURF_MIN = 10;                        // por debajo de esto, el barrio no es de nadie
export const TURF_BONUS = 0.02;                    // +2% de plata por barrio de tu pandilla

/* presencia de base de cada pandilla (personajes del juego): para que el mapa no arranque vacío; no se gasta */
export const TURF_BASE: Record<string, Partial<Record<Gang, number>>> = {
  "La Bocota": { barra: 30, familia: 8 }, "Puerto Mareo": { familia: 30, sindicato: 10 }, "San Telmón": { familia: 12, amarillos: 10 },
  "Palermo Soja": { amarillos: 12, barra: 8 }, "Villa Crespa": { barra: 12, sindicato: 8 }, "Barrancas": { sindicato: 30, barra: 8 },
  "Florida Vieja": { familia: 10, amarillos: 12 }, "Once y Medio": { amarillos: 30, familia: 8 }, "Mataderos": { sindicato: 12, barra: 10 },
  "Recoleta Bien": { familia: 12 }, "Liniers Sur": { amarillos: 10, sindicato: 12 }, "Pompeya Chica": { barra: 10, sindicato: 10 }
};

/* lo que hizo el jugador queda anotado acá y el servidor lo suma al mapa */
export function addInfluence(s: PlayerState, gang: Gang | null | undefined, barrio: string, pts: number) {
  if (!gang || !BARRIOS.includes(barrio) || !pts) return; // negativo: trabajo sucio contra esa pandilla
  (s.influence ??= []).push({ gang, barrio, pts });
}
/* multiplicador de plata por los barrios de tu pandilla (s.turf lo completa el servidor) */
export const turfMult = (s: PlayerState) => (gangOf(s) ? 1 + (s.turf ?? 0) * TURF_BONUS : 1);

/* influencia que queda después de `ms` milisegundos */
export const decayed = (pts: number, ms: number) => pts * Math.pow(0.5, Math.max(0, ms) / TURF_HALF_LIFE);

export function ownerOf(points: Partial<Record<Gang, number>>): Gang | null {
  const sorted = GANG_KEYS.map(g => [g, points[g] ?? 0] as const).sort((a, b) => b[1] - a[1]);
  return sorted[0][1] >= TURF_MIN && sorted[0][1] > sorted[1][1] ? sorted[0][0] : null;
}
