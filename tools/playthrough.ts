/* Bot que juega Placa o Plata de punta a punta con las reglas reales, para medir el balance.
   Uso: npm run playthrough            (resumen de 30 partidas por bando)
        npm run playthrough -- --json  (datos crudos, para el documento de balance)
   Juega como una persona razonable: hace el tutorial, se cura cuando está golpeado, entrena parejo,
   compra equipo cuando le conviene, hace misiones cuando puede y pelea en la calle contra rivales accesibles. */
import {
  ambushCatchUp, applyAction, canStart, ENERGY_EVERY, ENERGY_MAX, gearVal, getMission, healCost, itemLocked, jobList, maxHp,
  MISSIONS, newPlayer, npcTarget, rankOf, regen, salaryLeft, SHOP, TARGETS, trainCost, TUT, VALIJA,
  type Action, type PlayerState, type Rng, type Side, type StatKey
} from "@pop/shared";

const seeded = (seed: number): Rng => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export interface Run {
  side: Side;
  /* energía gastada acumulada al llegar a cada nivel / rango / hito */
  lvlAt: Record<number, number>; rankAt: Record<number, number>; events: Record<string, number>;
  fights: Record<string, { w: number; n: number }>;
  goldIn: Record<string, number>; goldOut: Record<string, number>;
  final: { lvl: number; respect: number; gold: number; stats: Record<StatKey, number>; energy: number };
  statsAtLvl: Record<number, number>; // promedio de fue/dur/ref/agu por nivel
}

const COMBAT: StatKey[] = ["fue", "dur", "ref", "agu"];

export function play(side: Side, seed: number, maxEnergy = 8000): Run {
  const rng = seeded(seed);
  let now = 0, spent = 0;
  const s = newPlayer("Bot", now);
  const run: Run = { side, lvlAt: { 1: 0 }, rankAt: {}, events: {}, fights: {}, goldIn: {}, goldOut: {}, final: null!, statsAtLvl: {} };
  const fight = (k: string, won: boolean) => { const f = (run.fights[k] ??= { w: 0, n: 0 }); f.n++; if (won) f.w++; };
  const avgCombat = () => COMBAT.reduce((a, k) => a + s.stats[k], 0) / COMBAT.length;

  /* ejecuta una acción y lleva la contabilidad */
  const act = (a: Action, tag = a.type) => {
    const e0 = s.energy, g0 = s.gold, l0 = s.lvl, r0 = rankOf(s);
    const res = applyAction(s, a, { now, rng });
    if (res.error) return false;
    spent += Math.max(0, e0 - s.energy);
    const dg = s.gold - g0;
    if (dg > 0) run.goldIn[tag] = (run.goldIn[tag] ?? 0) + dg;
    if (dg < 0) run.goldOut[tag] = (run.goldOut[tag] ?? 0) - dg;
    if (res.fight) fight(tag, res.fight.won);
    else if (res.mission && a.type === "mstep") fight(`prueba ${tag.slice(7)}`, res.mission.ok);
    for (let l = l0 + 1; l <= s.lvl; l++) { run.lvlAt[l] = spent; run.statsAtLvl[l] = avgCombat(); }
    if (s.side && rankOf(s) > r0) for (let r = r0 + 1; r <= rankOf(s); r++) run.rankAt[r] = spent;
    return true;
  };
  const refill = () => { while (s.side && s.targets.length < TARGETS) s.targets.push(npcTarget(rng, s.side, s.lvl)); };
  const mark = (k: string) => { run.events[k] ??= spent; };

  for (let guard = 0; guard < 200_000 && spent < maxEnergy; guard++) {
    regen(s, now);
    const g0 = s.gold; ambushCatchUp(s, { now, rng });
    if (s.gold < g0) run.goldOut.emboscadas = (run.goldOut.emboscadas ?? 0) + g0 - s.gold;
    refill();

    /* tutorial y elección */
    if (TUT[s.tut]?.goal(s)) { act({ type: "claimTut" }, "tutorial"); if (s.tutDone) mark("tutorial"); continue; }
    if (s.tabs.includes("guardia") && !s.seenTab.guardia) { act({ type: "seen", tab: "guardia" }); continue; }
    if (s.tutDone && !s.side) { act({ type: "side", side }); mark("bando"); refill(); continue; }
    if (s.side === "placa" && !salaryLeft(s, now)) { act({ type: "salary" }, "sueldo"); continue; }
    if (s.side === "plata" && s.heat >= 60 && act({ type: "lawyer" }, "abogado")) continue;

    /* curarse */
    if (s.hp <= maxHp(s) * 0.5) {
      if (s.potions && act({ type: "kit" })) continue;
      if (healCost(s) <= s.gold * 0.5 && act({ type: "heal" }, "guardia")) continue;
    }

    /* gastar plata: primero el siguiente escalón de equipo (ahorrando si hace falta), después entrenar lo más bajo */
    const upgrade = SHOP.filter(it => it.slot !== "consumible" && (!it.side || it.side === s.side) && !itemLocked(s, it)
      && it.val >= gearVal(s, it.slot) + 2).sort((a, b) => a.price - b.price)[0]; // el siguiente escalón, no el más caro
    if (upgrade && upgrade.price <= s.gold && act({ type: "buy", id: upgrade.id }, "equipo")) continue;
    /* ahorra si el ítem cuesta como mucho ~2,5 sesiones de trabajo */
    const best = jobList(s).filter(j => j.lvl <= s.lvl).at(-1)!;
    const perSession = ENERGY_MAX * (best.gold[0] + best.gold[1]) / 2 / best.cost;
    const saving = upgrade && upgrade.price <= perSession * 2.5 ? upgrade.price : 0;
    const low = [...COMBAT].sort((a, b) => s.stats[a] - s.stats[b])[0];
    const k: StatKey = s.stats.lab < s.stats[low] - 2 ? "lab" : low;
    if (trainCost(s.stats[k]) <= s.gold - 20 - saving && act({ type: "train", stat: k }, "gimnasio")) continue;

    /* tutorial: comprar algo y pelear el ring */
    if (s.tut === 2 && !s.c.buy && act({ type: "buy", id: s.gold >= 30 ? "llave" : "campera" }, "equipo")) continue;
    if (s.tut === 3 && s.energy >= 3 && s.hp > maxHp(s) * 0.5 && act({ type: "spar", i: 0 }, "ring")) continue;

    /* misiones */
    if (s.mis) {
      const st = getMission(s.mis.id)!.steps[s.mis.step];
      if (s.energy >= st.energy && s.hp > maxHp(s) * 0.5) {
        const id = s.mis.id;
        if (act({ type: "mstep" }, `misión ${id}`) && !s.mis) mark(`misión ${id}`);
        continue;
      }
      now += ENERGY_EVERY; continue; // en misión: esperar energía o vida en vez de gastarla en otra cosa
    } else {
      const next = s.side ? MISSIONS[s.side].find(m => canStart(s, m)) : canStart(s, VALIJA) && s.tut === 5 ? VALIJA : undefined;
      if (next && s.hp > maxHp(s) * 0.5 && act({ type: "mstart", id: next.id })) continue;
    }

    /* la calle: rivales de nivel parecido, más o menos la mitad de la energía */
    if (s.side && s.energy >= 3 && s.hp > maxHp(s) * 0.5 && rng() < 0.5) {
      const i = s.targets.findIndex(t => t.lvl <= s.lvl + 1);
      if (i >= 0 && act({ type: "duel", i }, "calle")) { refill(); continue; }
    }

    /* trabajar: el que más paga por energía */
    const job = jobList(s).filter(j => j.lvl <= s.lvl && j.cost <= s.energy).sort((a, b) => (b.gold[0] + b.gold[1]) / b.cost - (a.gold[0] + a.gold[1]) / a.cost)[0];
    if (job && (!s.tutDone || s.side) && act({ type: "job", id: job.id }, "trabajo")) continue;
    if (job && s.tut <= 1 && act({ type: "job", id: job.id }, "trabajo")) continue;

    now += Math.max(1, ENERGY_MAX - s.energy) * ENERGY_EVERY; // fin de la sesión: vuelve con la energía llena
  }
  run.final = { lvl: s.lvl, respect: s.respect, gold: s.gold, stats: { ...s.stats }, energy: spent };
  return run;
}

/* ---------- resumen ---------- */
const median = (xs: number[]) => { const a = xs.filter(x => x !== undefined).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };

export function summarize(runs: Run[]) {
  const lv = (l: number) => median(runs.map(r => r.lvlAt[l]));
  const rk = (k: number) => median(runs.map(r => r.rankAt[k]));
  const ev = (k: string) => median(runs.map(r => r.events[k]));
  const fights: Record<string, number> = {};
  for (const k of new Set(runs.flatMap(r => Object.keys(r.fights)))) {
    const w = runs.reduce((a, r) => a + (r.fights[k]?.w ?? 0), 0), n = runs.reduce((a, r) => a + (r.fights[k]?.n ?? 0), 0);
    fights[k] = Math.round(w / n * 100);
  }
  const sum = (key: "goldIn" | "goldOut") => {
    const o: Record<string, number> = {};
    for (const r of runs) for (const [k, v] of Object.entries(r[key])) o[k] = (o[k] ?? 0) + v / runs.length;
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]).sort((a, b) => +b[1] - +a[1]));
  };
  return {
    levels: Object.fromEntries([2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 20].map(l => [l, lv(l)])),
    statsAtLvl: Object.fromEntries([5, 10, 15, 20].map(l => [l, Math.round(median(runs.map(r => r.statsAtLvl[l])) * 10) / 10])),
    ranks: Object.fromEntries([1, 2, 3, 4, 5].map(k => [k, rk(k)])),
    events: Object.fromEntries([...new Set(runs.flatMap(r => Object.keys(r.events)))].map(k => [k, ev(k)])),
    fights, goldIn: sum("goldIn"), goldOut: sum("goldOut"),
    final: { lvl: median(runs.map(r => r.final.lvl)), respect: median(runs.map(r => r.final.respect)) }
  };
}

if (process.argv[1]?.includes("playthrough")) {
  const N = 30;
  const out: Record<string, ReturnType<typeof summarize>> = {};
  for (const side of ["placa", "plata"] as Side[]) out[side] = summarize(Array.from({ length: N }, (_, i) => play(side, 1000 + i)));
  if (process.argv.includes("--json")) console.log(JSON.stringify(out, null, 1));
  else for (const [side, r] of Object.entries(out)) {
    console.log(`\n===== ${side.toUpperCase()} (mediana de ${N} partidas; números = energía gastada) =====`);
    console.log("nivel:", r.levels);
    console.log("atributo de combate promedio por nivel:", r.statsAtLvl);
    console.log("rango:", r.ranks);
    console.log("hitos:", r.events);
    console.log("% victorias:", r.fights);
    console.log("plata que entra:", r.goldIn);
    console.log("plata que sale:", r.goldOut);
    console.log("al final:", r.final);
  }
}
