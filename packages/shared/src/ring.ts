/* Torneo del Ring: una temporada por mes, una ronda por día (a las 00:00 UTC, 21 h de Argentina).
   Rondas suizas: se empareja por puntaje, al azar entre los que van igual y sin repetir rival.
   Las peleas se resuelven solas con los atributos y el equipo de cada uno (tiempo humano: nadie tiene que estar conectado). */
import { pick } from "./rules.js";
import type { Rng } from "./types.js";

const DAY = 24 * 3_600_000;
export const RING_MIN_ENTRANTS = 8;   // si hay menos jugadores, se completa con boxeadores del barrio
export const RING_NPCS = ["Kid Cemento", "La Zurda Paz", "El Toro Medina", "Rocky Balbuena", "El Pibe Ricota", "Mano de Piedra Ibáñez",
  "La Pantera Funes", "Martillo Gómez", "El Oso Pereyra", "Chispa Medina"];

/* temporada = mes en UTC, como "2026-10" */
export const seasonOf = (ms: number) => new Date(ms).toISOString().slice(0, 7);
export const seasonStart = (season: string) => Date.UTC(Number(season.slice(0, 4)), Number(season.slice(5, 7)) - 1, 1);
export const seasonEnd = (season: string) => Date.UTC(Number(season.slice(0, 4)), Number(season.slice(5, 7)), 1);
export const roundsIn = (season: string) => Math.round((seasonEnd(season) - seasonStart(season)) / DAY) - 1;
/* la ronda r (1, 2, …) se pelea al empezar el día r+1 del mes */
export const roundAt = (season: string, r: number) => seasonStart(season) + r * DAY;
export const seasonName = (season: string) => {
  const m = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][Number(season.slice(5, 7)) - 1];
  return `${m} ${season.slice(0, 4)}`;
};

export interface SwissEntry { id: number; points: number; opponents: number[] }
/* Emparejamiento suizo: ordena por puntos (al azar entre iguales) y empareja con el próximo con quien no peleó.
   Si sobra uno, pasa de ronda (gana sin pelear). */
export function swissPairs(entries: SwissEntry[], rng: Rng): [SwissEntry, SwissEntry | null][] {
  const pool = [...entries].map(e => ({ e, r: rng() })).sort((a, b) => b.e.points - a.e.points || a.r - b.r).map(x => x.e);
  const pairs: [SwissEntry, SwissEntry | null][] = [];
  while (pool.length) {
    const a = pool.shift()!;
    let k = pool.findIndex(b => !a.opponents.includes(b.id));
    if (k < 0 && pool.length) k = 0; // ya peleó con todos: se repite
    if (k < 0) { pairs.push([a, null]); break; }
    pairs.push([a, pool.splice(k, 1)[0]]);
  }
  return pairs;
}
/* desempate: suma de los puntos de los rivales que te tocaron (Buchholz) */
export const buchholz = (e: SwissEntry, all: SwissEntry[]) => e.opponents.reduce((a, id) => a + (all.find(x => x.id === id)?.points ?? 0), 0);

/* premios al cerrar la temporada, según el puesto */
export function ringPrize(place: number, lvl: number): { gold: number; resp: number } {
  if (place === 1) return { gold: lvl * 300, resp: 100 };
  if (place === 2) return { gold: lvl * 200, resp: 60 };
  if (place === 3) return { gold: lvl * 120, resp: 40 };
  return { gold: 0, resp: 10 }; // por participar
}
export const npcBoxer = (rng: Rng, used: Set<string>) => pick(rng, RING_NPCS.filter(n => !used.has(n)).length ? RING_NPCS.filter(n => !used.has(n)) : RING_NPCS);
