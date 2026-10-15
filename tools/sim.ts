/* Simulador de balance: corre miles de peleas con las fórmulas reales del juego.
   Uso: npm run sim
   Para probar un cambio, tocá packages/shared/src (rules.ts, data.ts) y volvé a correrlo. */
import { battle, maxHp, scaledEnemy, type Fighter } from "@pop/shared";

const N = 4000;
/* un jugador "típico" por nivel: atributos que se pueden pagar entrenando a ese nivel */
function typical(lvl: number, stat: number, arma: number, armadura: number): Fighter {
  const max = maxHp({ lvl, stats: { fue: stat, dur: stat, ref: stat, agu: stat, lab: stat } });
  return { name: "Jugador", hp: max, max, fue: stat, dur: stat, ref: stat, arma, armadura };
}
const CASES: [string, Fighter, number, number][] = [
  ["Ring: sparring (nv1)", typical(1, 5, 0, 0), 1, 0.6],
  ["La valija (nv3)", typical(3, 6, 3, 2), 3, 0.9],
  ["La protección / Ronda (nv6)", typical(6, 9, 7, 6), 6, 0.9],
  ["La calle, rival parejo (nv6)", typical(6, 9, 7, 6), 6, 0.95],
  ["La calle, rival +2 (nv6)", typical(6, 9, 7, 6), 8, 0.95],
  ["Blindado / Allanamiento (nv10)", typical(10, 13, 13, 11), 10, 1.0],
  ["Final de bando (nv16)", typical(16, 18, 20, 16), 16, 1.1]
];

console.log(`${"Pelea".padEnd(34)} gana`);
for (const [name, p, lvl, mult] of CASES) {
  let w = 0;
  for (let i = 0; i < N; i++) if (battle(Math.random, p, scaledEnemy(Math.random, "Rival", lvl, mult)).won) w++;
  const pct = Math.round(w / N * 100);
  console.log(`${name.padEnd(34)} ${String(pct).padStart(3)}%  ${"█".repeat(Math.round(pct / 5))}`);
}
