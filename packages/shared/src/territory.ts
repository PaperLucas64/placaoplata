/* Territorio: los barrios de Buenos Aires y la influencia de cada pandilla en ellos.
   La influencia la generan los jugadores trabajando para una pandilla y se va gastando (la mitad por semana).
   El barrio es de la pandilla con más influencia. Cada barrio de tu pandilla te da +2% de plata. */
import { GANG_KEYS } from "./gangs.js";
import { GEO_PLACES } from "./geo-data.js";
import { gangOf } from "./rules.js";
import type { Gang, PlayerState } from "./types.js";

export const BARRIOS = Object.keys(GEO_PLACES); // los barrios de Capital (ver tools/geo/capital.py)
/* el barrio de cada pandilla (ahí suman sus misiones de la historia y sus encargos) */
export const HOME_BARRIO: Record<Gang, string> = { familia: "Puerto Madero", sindicato: "Chacarita", barra: "Núñez", amarillos: "Balvanera" };

export const TURF_HALF_LIFE = 7 * 24 * 3_600_000; // la influencia pierde la mitad por semana
export const TURF_MIN = 10;                        // por debajo de esto, el barrio no es de nadie
export const TURF_BONUS = 0.02;                    // +2% de plata por barrio de tu pandilla

/* presencia de base de cada pandilla (personajes del juego): para que el mapa no arranque vacío; no se gasta */
export const TURF_BASE: Record<string, Partial<Record<Gang, number>>> = {
  /* La Familia: el puerto y la plata */
  "Puerto Madero": { familia: 30, sindicato: 8 }, "Recoleta": { familia: 15 }, "San Nicolás": { familia: 12, amarillos: 8 },
  "Monserrat": { familia: 12 }, "Belgrano": { familia: 12, barra: 8 }, "Retiro": { familia: 10, amarillos: 10 },
  /* El Sindicato: talleres, galpones y vías */
  "Chacarita": { sindicato: 30, amarillos: 8 }, "La Paternal": { sindicato: 15 }, "Villa Ortúzar": { sindicato: 12 },
  "Agronomía": { sindicato: 10 }, "Villa General Mitre": { sindicato: 10 }, "Villa Santa Rita": { sindicato: 10 }, "Villa Urquiza": { sindicato: 8, amarillos: 10 },
  /* La Barra: los clubes */
  "Núñez": { barra: 30, familia: 8 }, "Villa Crespo": { barra: 12, sindicato: 8 }, "Caballito": { barra: 12, amarillos: 8 },
  "Flores": { barra: 12, sindicato: 8 }, "Vélez Sarsfield": { barra: 15 }, "Villa Luro": { barra: 10 }, "Saavedra": { barra: 12 },
  "Villa Devoto": { barra: 10, familia: 8 }, "Villa del Parque": { barra: 10 }, "Monte Castro": { barra: 8, sindicato: 8 },
  /* Los Amarillos: remiserías y avenidas */
  "Balvanera": { amarillos: 30, familia: 8 }, "Almagro": { amarillos: 15 }, "Palermo": { amarillos: 12, barra: 8 },
  "Colegiales": { amarillos: 12 }, "Coghlan": { amarillos: 10 }, "Villa Pueyrredón": { amarillos: 10 }, "Parque Chas": { amarillos: 8, sindicato: 8 },
  "Versalles": { amarillos: 8 }, "Floresta": { amarillos: 10 }, "Liniers": { amarillos: 10, sindicato: 12 }, "Villa Real": { amarillos: 8 }
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
