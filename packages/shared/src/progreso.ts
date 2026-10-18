/* Qué destraba cada nivel y cada rango, sacado de los datos (para festejarlo y para mostrar lo que viene) */
import { HOUSE_TYPES } from "./casas.js";
import { JOBS, SHOP } from "./data.js";
import { GOLPES, MISSIONS, RANK_AT } from "./gangs.js";
import { VEHICLES } from "./geo.js";
import { PROPS } from "./negocios.js";
import type { Gang } from "./types.js";

export interface Unlock { kind: "laburo" | "golpe" | "equipo" | "casa" | "negocio" | "vehículo"; name: string }

/* lo que aparece justo en ese nivel */
export function unlocksAt(lvl: number): Unlock[] {
  if (lvl <= 1) return [];
  return [
    ...JOBS.filter(j => j.lvl === lvl).map(j => ({ kind: "laburo" as const, name: j.name })),
    ...GOLPES.filter(j => j.lvl === lvl).map(j => ({ kind: "golpe" as const, name: j.name })),
    ...SHOP.filter(it => it.lvl === lvl && !it.event && !it.rank && it.slot !== "consumible").map(it => ({ kind: "equipo" as const, name: it.name })),
    ...Object.values(HOUSE_TYPES).filter(h => h.lvl === lvl).map(h => ({ kind: "casa" as const, name: h.name })),
    ...PROPS.filter(p => p.lvl === lvl).map(p => ({ kind: "negocio" as const, name: p.name })),
    ...Object.values(VEHICLES).filter(v => v.lvl === lvl).map(v => ({ kind: "vehículo" as const, name: v.name }))
  ];
}
/* el próximo nivel que trae algo nuevo (hasta 60) */
export function nextUnlock(lvl: number): { lvl: number; items: Unlock[] } | null {
  for (let n = lvl + 1; n <= 60; n++) { const items = unlocksAt(n); if (items.length) return { lvl: n, items }; }
  return null;
}
/* las misiones de la historia de una pandilla que piden ese rango */
export const missionsAtRank = (g: Gang, rank: number) => MISSIONS[g].filter(m => m.rank === rank);
/* cuánto respeto falta para el próximo rango (null si ya sos Capo) */
export const respectToNext = (respect: number) => { const next = RANK_AT.find(r => r > respect); return next === undefined ? null : next - respect; };
