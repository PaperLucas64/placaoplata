/* Resumen corto del bot para iterar el balance: npm run brief */
import { play, summarize } from "./playthrough.js";
import type { Gang } from "@pop/shared";
const N = 20;
for (const gang of ["familia", "sindicato", "barra", "amarillos"] as Gang[]) {
  const r = summarize(Array.from({ length: N }, (_, i) => play(gang, 1000 + i)));
  const total = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  const share = (o: Record<string, number>) => Object.entries(o).filter(([, v]) => v / total(o) > 0.01).map(([k, v]) => `${k} ${Math.round(v / total(o) * 100)}%`).join(", ");
  console.log(`\n${gang.toUpperCase()}  (energía gastada hasta cada cosa) · afinidad final con su pandilla: ${r.share}%`);
  console.log(" niveles  ", [5, 10, 15, 20].map(l => `nv${l}:${r.levels[l] ?? "-"}`).join("  "), "  | final nivel", r.final.lvl);
  console.log(" atributo ", Object.entries(r.statsAtLvl).map(([l, v]) => `nv${l}:${v}`).join("  "));
  console.log(" rangos   ", Object.entries(r.ranks).map(([k, v]) => `${k}:${v ?? "-"}`).join("  "));
  console.log(" misiones ", Object.entries(r.events).filter(([k]) => k.startsWith("misión")).map(([k, v]) => `${k.slice(7)}:${v}`).join("  "));
  console.log(" salen bien", Object.entries(r.fights).filter(([k]) => k.startsWith("misión") || k.startsWith("calle ")).map(([k, v]) => `${k.replace("misión ", "")}:${v}%`).join("  "));
  console.log(" peleas   ", Object.entries(r.fights).filter(([k]) => !k.startsWith("misión") && !k.startsWith("calle ")).map(([k, v]) => `${k}:${v}%`).join("  "));
  console.log(" horas    ", Object.entries(r.hours).map(([k, v]) => `${k}:${v}h`).join("  "), `  | entrenando ~${r.gymShare}% del tiempo`);
  console.log(" entra    ", share(r.goldIn));
  console.log(" sale     ", share(r.goldOut));
}
