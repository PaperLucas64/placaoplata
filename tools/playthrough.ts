/* Bot que juega Placa o Plata de punta a punta con las reglas reales, para medir el balance.
   Uso: npm run playthrough            (resumen de partidas enfocadas en cada pandilla)
        npm run playthrough -- --json  (datos crudos, para el documento de balance)
   Juega como una persona razonable: hace el tutorial, se cura cuando está golpeado, entrena parejo,
   compra equipo cuando le conviene, mejora la casa, guarda la plata en la caja fuerte, hace encargos y misiones
   de "su" pandilla y pelea en la calle contra rivales accesibles. */
import {
  affShare, ambushCatchUp, applyAction, boardCatchUp, canStart, energyMax, ENERGY_EVERY, gangOf, gearVal, healCost, HOME, itemLocked,
  meetsReq, missionCatchUp, salidaCatchUp, itemOf, itemPower, type Slot, PROPS, propIncome, missionEnergy, missionReq, nextMissionEvent,
  jobList, maxHp, MISSIONS, newPlayer, nextLevel, npcTarget, rankOf, regen, SHOP, TARGETS, trainCost, TUT, VALIJA,
  hasHouse, needsHouse, lodgingOf, type Action, type Gang, type Rng, type StatKey
} from "@pop/shared";

const seeded = (seed: number): Rng => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export interface Run {
  gang: Gang;
  /* energía gastada acumulada al llegar a cada nivel / rango / hito */
  lvlAt: Record<number, number>; rankAt: Record<number, number>; events: Record<string, number>;
  fights: Record<string, { w: number; n: number }>;
  goldIn: Record<string, number>; goldOut: Record<string, number>;
  final: { lvl: number; respect: number; gold: number; stats: Record<StatKey, number>; energy: number };
  /* horas de reloj (jugador muy activo: vuelve apenas se llena la energía o termina lo que estaba haciendo) */
  hoursAt: Record<string, number>; gymHours: number;
  statsAtLvl: Record<number, number>; // promedio de fue/dur/ref/agu por nivel
  finalShare: number; // parte de la afinidad con su pandilla al final
}

const COMBAT: StatKey[] = ["fue", "dur", "ref", "agu"];

export function play(gang: Gang, seed: number, maxEnergy = 8000): Run {
  const rng = seeded(seed);
  let now = 0, spent = 0;
  const s = newPlayer("Bot", now);
  s.home.spawn = "Almagro"; // siempre el mismo barrio, para que la medición no dependa del azar
  const run: Run = { gang, finalShare: 0, lvlAt: { 1: 0 }, rankAt: {}, events: {}, fights: {}, goldIn: {}, goldOut: {}, final: null!, statsAtLvl: {}, hoursAt: {}, gymHours: 0 };
  const fight = (k: string, won: boolean) => { const f = (run.fights[k] ??= { w: 0, n: 0 }); f.n++; if (won) f.w++; };
  const avgCombat = () => COMBAT.reduce((a, k) => a + s.stats[k], 0) / COMBAT.length;

  /* ejecuta una acción y lleva la contabilidad */
  const act = (a: Action, tag = a.type) => {
    const e0 = s.energy, g0 = s.gold, l0 = s.lvl, r0 = rankOf(s);
    const res = applyAction(s, a, { now, rng });
    s.influence = []; // el bot no tiene mapa: la influencia se descarta
    if (res.error) return false;
    spent += Math.max(0, e0 - s.energy);
    const dg = a.type === "deposit" || a.type === "withdraw" ? 0 : s.gold - g0; // mover plata a la caja no es ganar ni gastar
    if (dg > 0) run.goldIn[tag] = (run.goldIn[tag] ?? 0) + dg;
    if (dg < 0) run.goldOut[tag] = (run.goldOut[tag] ?? 0) - dg;
    if (res.fight) fight(tag, res.fight.won);
    for (let l = l0 + 1; l <= s.lvl; l++) { run.lvlAt[l] = spent; run.statsAtLvl[l] = avgCombat(); run.hoursAt[`nv${l}`] = now / 3_600_000; }
    if (a.type === "train" && s.busy) run.gymHours += (s.busy.until - s.busy.since) / 3_600_000;
    if (s.tutDone && rankOf(s) > r0) for (let r = r0 + 1; r <= rankOf(s); r++) { run.rankAt[r] = spent; run.hoursAt[`rango${r}`] = now / 3_600_000; }
    return true;
  };
  const refill = () => { while (s.tutDone && s.targets.length < TARGETS) s.targets.push(npcTarget(rng, gangOf(s), s.lvl)); };
  const mark = (k: string) => { run.events[k] ??= spent; };

  for (let guard = 0; guard < 200_000 && spent < maxEnergy; guard++) {
    regen(s, now);
    /* en una misión: dejar que se resuelvan las etapas (como hace el servidor) */
    if (s.busy?.kind === "mision") {
      const id = s.busy.id, tag = s.board.some(m => m.id === id) ? `calle ${s.board.find(m => m.id === id)!.difficulty}` : `misión ${id}`;
      const g1 = s.gold, l1 = s.lvl, r1 = rankOf(s), v1 = s.c.valija;
      missionCatchUp(s, { now, rng });
      s.influence = [];
      if (s.busy?.kind !== "mision") {
        const ok = s.c.valija > v1 || s.log.slice(0, 3).some(l => l.msg.includes("salió bien"));
        fight(tag, ok); if (ok) mark(tag);
        if (s.gold > g1) run.goldIn.misiones = (run.goldIn.misiones ?? 0) + s.gold - g1;
        for (let l = l1 + 1; l <= s.lvl; l++) { run.lvlAt[l] = spent; run.statsAtLvl[l] = avgCombat(); run.hoursAt[`nv${l}`] = now / 3_600_000; }
        if (s.tutDone && rankOf(s) > r1) for (let r = r1 + 1; r <= rankOf(s); r++) { run.rankAt[r] = spent; run.hoursAt[`rango${r}`] = now / 3_600_000; }
        continue;
      }
      now = nextMissionEvent(s) ?? s.busy.until; continue;
    }
    if (s.busy?.kind === "guardia") missionCatchUp(s, { now, rng }); // curarse con viaje lo termina missionCatchUp
    if (s.busy?.kind === "salida") { const g2 = s.gold; salidaCatchUp(s, { now, rng }); if (s.gold > g2) run.goldIn.trabajo = (run.goldIn.trabajo ?? 0) + s.gold - g2; }
    if (s.busy) { now = Math.max(now + 1, nextMissionEvent(s) ?? s.busy.until); continue; } // entrenando, curándose o volviendo: esperar
    boardCatchUp(s, { now, rng });
    const g0 = s.gold; ambushCatchUp(s, { now, rng });
    if (s.gold < g0) run.goldOut.emboscadas = (run.goldOut.emboscadas ?? 0) + g0 - s.gold;
    refill();

    /* tutorial */
    if (TUT[s.tut]?.goal(s)) { act({ type: "claimTut" }, "tutorial"); if (s.tutDone) { mark("tutorial"); refill(); } continue; }
    if (s.tabs.includes("guardia") && !s.seenTab.guardia) { act({ type: "seen", tab: "guardia" }); continue; }
    if (gangOf(s) === gang && run.events.pandilla === undefined) { mark("pandilla"); run.hoursAt.pandilla = now / 3_600_000; }
    if (s.tutDone && s.heat >= 60 && act({ type: "lawyer" }, "abogado")) continue;
    /* sin casa: apenas es de una pandilla, duerme gratis en su guarida */
    if (s.tutDone && !hasHouse(s) && gangOf(s) && lodgingOf(s) !== "guarida" && act({ type: "lodge", where: "guarida" }, "vivienda")) continue;
    /* al volver, saca la plata de la caja fuerte para gastarla */
    if (s.home.safe > 0) act({ type: "withdraw", amount: s.home.safe });

    /* curarse */
    if (s.hp <= maxHp(s) * 0.5) {
      if (s.potions && act({ type: "kit" })) continue;
      if (healCost(s) <= s.gold * 0.5 && act({ type: "heal" }, "clinica")) continue;
      if (act({ type: "guardia" }, "guardia")) continue; // gratis, pero lleva tiempo
    }

    /* gastar plata: primero el siguiente escalón de equipo (ahorrando si hace falta), después entrenar lo más bajo */
    const upgrade = SHOP.filter(it => it.slot !== "consumible" && !itemLocked(s, it)
      && itemPower(it) >= itemPower(itemOf(s.gear[it.slot as Slot])) + 2).sort((a, b) => a.price - b.price)[0]; // el siguiente escalón, no el más caro
    if (upgrade && upgrade.price <= s.gold && act({ type: "buy", id: upgrade.id }, "equipo")) continue;
    /* ahorra si el ítem cuesta como mucho ~2,5 sesiones de trabajo */
    const best = jobList(s).filter(j => j.lvl <= s.lvl).at(-1)!;
    const perSession = energyMax(s) * (best.gold[0] + best.gold[1]) / 2 / best.cost;
    const saving = upgrade && upgrade.price <= perSession * 2.5 ? upgrade.price : 0;
    /* negocios: cobra lo juntado y compra el siguiente si no se come más de la mitad de la plata */
    if (s.tutDone) {
      if (PROPS.some(p => s.props?.[p.id] !== undefined && propIncome(p, s.props[p.id], now) >= p.perHour * 6)) act({ type: "collect" }, "negocios");
      const prop = PROPS.find(p => s.props?.[p.id] === undefined && p.lvl <= s.lvl && p.price <= s.gold / 2);
      if (prop && act({ type: "prop", id: prop.id }, "negocios")) continue;
    }
    /* casa: la mejora más barata, si no se come más de un tercio de la plata */
    if (s.tutDone && !s.home.obra) {
      const part = (Object.keys(HOME) as (keyof typeof HOME)[]).map(k => [k, nextLevel(s, k)] as const)
        .filter(([, lv]) => lv && lv.cost <= s.gold / 3).sort((a, b) => a[1]!.cost - b[1]!.cost)[0];
      if (part && act({ type: "build", part: part[0] }, "casa")) continue;
    }
    const low = [...COMBAT].sort((a, b) => s.stats[a] - s.stats[b])[0];
    /* si la próxima misión de su pandilla pide un atributo que no tiene, entrena ese primero */
    const story = s.tutDone ? MISSIONS[gang].find(m => canStart(s, m)) : undefined;
    const lack = story && (Object.entries(missionReq(story)) as [StatKey, number][]).find(([st, v]) => s.stats[st] < v)?.[0];
    const k: StatKey = lack ?? (s.stats.lab < s.stats[low] - 2 ? "lab" : low);
    if (trainCost(s.stats[k]) <= s.gold - 20 - saving && act({ type: "train", stat: k }, "gimnasio")) continue;

    /* tutorial: comprar algo y pelear el ring */
    if (s.tut === 2 && !s.c.buy && act({ type: "buy", id: s.gold >= 30 ? "llave" : "campera" }, "equipo")) continue;
    if (s.tut === 3 && s.energy >= 3 && s.hp > maxHp(s) * 0.5 && act({ type: "spar", i: 0 }, "ring")) continue;

    /* misiones: la de su pandilla apenas puede; si no, a veces una de la calle (la más difícil que puede hacer) */
    const next = story ?? (!s.tutDone && s.tut === 5 && canStart(s, VALIJA) ? VALIJA : undefined);
    if (next && meetsReq(s, next) && s.hp > maxHp(s) * 0.5) {
      if (s.energy >= missionEnergy(next)) { if (act({ type: "mstart", id: next.id })) continue; }
      else { now += ENERGY_EVERY; continue; } // junta energía para la misión
    }
    if (s.tutDone && rng() < 0.35) {
      const street = s.board.filter(m => m.gang && !m.hours).reverse().find(m => meetsReq(s, m) && s.energy >= missionEnergy(m)); // busca respeto: las de pandilla
      if (street && s.hp > maxHp(s) * 0.6 && act({ type: "mstart", id: street.id })) continue;
    }

    /* la calle: rivales de nivel parecido, más o menos la mitad de la energía */
    /* encargos de su pandilla: un tercio de la energía, más o menos */
    if (s.tutDone && s.energy >= 4 && s.hp > maxHp(s) * 0.5 && rng() < 0.3 && act({ type: "encargo", gang }, "encargo")) continue;
    if (s.tutDone && s.energy >= 3 && s.hp > maxHp(s) * 0.5 && rng() < 0.5) {
      const i = s.targets.findIndex(t => t.lvl <= s.lvl + 1);
      if (i >= 0 && act({ type: "duel", i }, "calle")) { refill(); continue; }
    }

    /* trabajar: el que más paga por energía */
    const job = jobList(s).filter(j => j.lvl <= s.lvl && j.cost <= s.energy && (hasHouse(s) || !needsHouse(j))).sort((a, b) => (b.gold[0] + b.gold[1]) / b.cost - (a.gold[0] + a.gold[1]) / a.cost)[0];
    if (job && act({ type: "job", id: job.id }, "trabajo")) continue;

    /* fin de la sesión: guarda lo que puede en la caja fuerte y vuelve con la energía llena */
    if (s.gold > 0) act({ type: "deposit", amount: s.gold });
    now += Math.max(1, energyMax(s) - s.energy) * ENERGY_EVERY;
  }
  run.final = { lvl: s.lvl, respect: s.respect, gold: s.gold + s.home.safe, stats: { ...s.stats }, energy: spent };
  (run as unknown as { state: PlayerState }).state = s; // para depurar
  run.finalShare = affShare(s, gang);
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
    final: { lvl: median(runs.map(r => r.final.lvl)), respect: median(runs.map(r => r.final.respect)) },
    share: Math.round(median(runs.map(r => r.finalShare)) * 100),
    hours: Object.fromEntries(["pandilla", "nv5", "nv10", "nv15", "nv20", "rango1", "rango2", "rango4", "rango5"].map(k => [k, Math.round(median(runs.map(r => r.hoursAt[k])) * 10) / 10])),
    gymShare: Math.round(median(runs.map(r => r.gymHours / Math.max(1e-9, r.hoursAt.nv15 ?? r.hoursAt.nv10 ?? 1))) * 100)
  };
}

if (process.argv[1]?.includes("playthrough")) {
  const N = 30;
  const out: Record<string, ReturnType<typeof summarize>> = {};
  for (const gang of ["familia", "sindicato", "barra", "amarillos"] as Gang[]) out[gang] = summarize(Array.from({ length: N }, (_, i) => play(gang, 1000 + i)));
  if (process.argv.includes("--json")) console.log(JSON.stringify(out, null, 1));
  else for (const [gang, r] of Object.entries(out)) {
    console.log(`\n===== ${gang.toUpperCase()} (mediana de ${N} partidas; números = energía gastada) =====`);
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
