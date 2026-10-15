/* Simulador de peleas: miles de peleas con las fórmulas reales del juego.
   Uso: npm run sim
   El "jugador típico" sale de tools/playthrough.ts: el atributo de combate promedio es ~1,4 × nivel
   y el equipo, el que se puede comprar a ese nivel. */
import { battle, maxHp, RING, scaledEnemy, type Fighter } from "@pop/shared";

const N = 4000;
export function typical(lvl: number): Fighter {
  const st = Math.max(5, Math.round(lvl * 1.4));
  const max = maxHp({ lvl, stats: { fue: st, dur: st, ref: st, agu: st, lab: st } });
  const arma = lvl < 3 ? 3 : lvl < 6 ? 7 : lvl < 9 ? 13 : lvl < 13 ? 20 : 21;
  const armadura = lvl < 3 ? 2 : lvl < 6 ? 6 : lvl < 9 ? 11 : lvl < 13 ? 16 : 24;
  return { name: "Jugador", hp: max, max, fue: st, dur: st, ref: st, arma, armadura };
}
const winPct = (lvl: number, eLvl: number, mult: number) => {
  let w = 0;
  for (let i = 0; i < N; i++) if (battle(Math.random, typical(lvl), scaledEnemy(Math.random, "Rival", eLvl, mult)).won) w++;
  return Math.round(w / N * 100);
};
const bar = (p: number) => `${String(p).padStart(3)}%  ${"█".repeat(Math.round(p / 5))}`;

console.log("La calle: nivel del rival comparado con el tuyo (jugador típico de nivel 5 / 12 / 20)");
for (const d of [-2, -1, 0, 1, 2, 3]) {
  console.log(`  ${d >= 0 ? "+" : ""}${d}`.padEnd(6), [5, 12, 20].map(l => `${String(winPct(l, l + d, 0.95)).padStart(3)}%`).join("   "));
}
console.log("\nRing (al nivel en que se destraba cada rival, y 3 niveles después)");
for (const m of RING) console.log(`  ${m.name.padEnd(24)} nv${m.lvl}: ${bar(winPct(m.lvl, m.lvl, m.mult))}   nv${m.lvl + 3}: ${winPct(m.lvl + 3, m.lvl + 3, m.mult)}%`);
