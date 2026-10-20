/* El mapa de Buenos Aires: suma la influencia que generan los jugadores y calcula de quién es cada barrio.
   Se guarda en la base; la foto del mapa se cachea un minuto porque la piden todos los jugadores. */
import { BARRIOS, decayed, GANG_KEYS, ownerOf, TURF_BASE, type Gang, type PlayerState } from "@pop/shared";
import type { Db, Queryable } from "./db.js";

export interface BarrioView { barrio: string; owner: Gang | null; points: Record<Gang, number> }

export function makeTerritory(db: Db) {
  let cache: { at: number; map: BarrioView[]; owned: Record<Gang, number> } | null = null;

  async function load(now = Date.now()) {
    const r = await db.query<{ barrio: string; gang: Gang; points: number; updated_at: string }>(`SELECT * FROM territory`);
    const map: BarrioView[] = BARRIOS.map(barrio => {
      const points = Object.fromEntries(GANG_KEYS.map(g => [g, TURF_BASE[barrio]?.[g] ?? 0])) as Record<Gang, number>;
      for (const row of r.rows.filter(x => x.barrio === barrio)) points[row.gang] += decayed(Number(row.points), now - Number(row.updated_at));
      for (const g of GANG_KEYS) points[g] = Math.round(points[g] * 10) / 10;
      return { barrio, owner: ownerOf(points), points };
    });
    const owned = Object.fromEntries(GANG_KEYS.map(g => [g, map.filter(b => b.owner === g).length])) as Record<Gang, number>;
    cache = { at: now, map, owned };
    return cache;
  }
  const snapshot = async () => (cache && Date.now() - cache.at < 60_000 ? cache : load());

  /* Pasa la influencia anotada en el estado del jugador al mapa (dentro de la misma transacción).
     Puede ser negativa (trabajo sucio para la policía): nunca baja de cero. */
  async function drain(q: Queryable, s: PlayerState, now: number) {
    const items = s.influence;
    if (!items?.length) return;
    s.influence = [];
    for (const it of items) {
      await q.query(
        `INSERT INTO territory (barrio, gang, points, updated_at) VALUES ($1, $2, GREATEST(0, $3::double precision), $4)
         ON CONFLICT (barrio, gang) DO UPDATE
           SET points = GREATEST(0, territory.points * power(0.5, ($4 - territory.updated_at)::double precision / $5) + $3::double precision),
               updated_at = $4`,
        [it.barrio, it.gang, it.pts, now, 7 * 24 * 3_600_000]);
    }
    cache = null; // el mapa cambió
  }

  return { snapshot, drain };
}
