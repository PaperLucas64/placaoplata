/* Acciones del jugador. Cada una valida, cambia el estado y devuelve lo que la pantalla tiene que mostrar.
   El servidor es el único que las ejecuta de verdad; el azar llega como `rng`. */
import { AMBUSH_CHANCE, AMBUSH_MAX_CATCHUP, ATTACK_EVERY, DUEL_COST, MIN_HP_TO_FIGHT, SALARY_EVERY, SCOUT_COST } from "./config.js";
import { FOES, MISSIONS, RANKS, RING, SHOP, STAT_NAMES, TUT, VALIJA } from "./data.js";
import {
  addHeat, battle, clamp, finishBusy, foeSide, gainXp, getMission, guardiaTime, healCost, trainTime, itemLocked, jobList, lawyerCost, log, maxHp, money,
  pick, playerFighter, rankOf, rnd, salary, salaryLeft, scaledEnemy, trainCost
} from "./rules.js";
import type { Action, ActionResult, Mission, PlayerState, Rng, Side, Target } from "./types.js";

export interface Ctx { now: number; rng: Rng }
const fail = (error: string): ActionResult => ({ error });

export function addRespect(s: PlayerState, now: number, n: number) {
  const before = rankOf(s);
  s.respect = Math.max(0, s.respect + n);
  const after = rankOf(s);
  if (s.side && after > before) log(s, now, `Ascendiste: ahora sos ${RANKS[s.side][after]}.`, "gold");
}

export function canStart(s: PlayerState, m: Mission) {
  if (s.mis) return false;
  if (m.id === "valija") return !s.c.valija && !s.side;
  const list = s.side ? MISSIONS[s.side] : [], i = list.indexOf(m);
  return i >= 0 && !s.done[m.id] && rankOf(s) >= m.rank && list.slice(0, i).every(x => s.done[x.id]);
}

export const npcTarget = (rng: Rng, side: Side, lvl: number, name = pick(rng, FOES[foeSide(side)])): Target => {
  const l = Math.max(1, lvl + rnd(rng, -2, lvl < 8 ? 1 : 2)); // a nivel bajo, un nivel pesa mucho
  return { kind: "npc", name, lvl: l, gold: rnd(rng, l * 20, l * 55) };
};

/* Mientras entrenás o estás internado no podés hacer estas cosas */
const BLOCKED_WHEN_BUSY = new Set<Action["type"]>(["job", "train", "spar", "mstart", "mstep", "duel", "scout", "guardia", "heal"]);
const busyText = (s: PlayerState) => s.busy?.kind === "gym" ? "Estás entrenando en el gimnasio." : "Estás internado en la guardia.";

export function applyAction(s: PlayerState, a: Action, { now, rng }: Ctx): ActionResult {
  finishBusy(s, now);
  if (s.busy && BLOCKED_WHEN_BUSY.has(a.type)) return fail(`${busyText(s)} Esperá a que termine o cancelalo.`);
  switch (a.type) {
    case "seen": { s.seenTab[a.tab] = true; return {}; }

    case "claimTut": {
      const t = TUT[s.tut];
      if (!t || !t.goal(s)) return fail("Todavía no terminaste el encargo.");
      s.gold += t.reward.gold; gainXp(s, now, t.reward.xp);
      log(s, now, `Marga te pagó ${money(t.reward.gold)} por «${t.title}».`, "gold");
      s.tut++;
      const nx = TUT[s.tut];
      if (nx) { if (!s.tabs.includes(nx.tab)) s.tabs.push(nx.tab); }
      else s.tutDone = true;
      return {};
    }

    case "job": {
      const j = jobList(s).find(x => x.id === a.id);
      if (!j) return fail("Ese trabajo no existe.");
      if (s.lvl < j.lvl) return fail(`Pide nivel ${j.lvl}.`);
      if (s.energy < j.cost) return fail("No te alcanza la energía.");
      s.energy -= j.cost;
      /* la plata: con calor alto es más fácil que te agarren (con 50 de calor, ~1 de cada 7 golpes) */
      if (s.side === "plata" && rng() < s.heat / 400 + j.risk * 0.01) {
        const fine = Math.min(s.gold, Math.round(s.gold * 0.1) + s.lvl * 5);
        s.gold -= fine; addHeat(s, -35);
        log(s, now, `${j.name}: te agarró la policía. Pagaste ${money(fine)} de fianza y pasaste la noche en un calabozo.`, "bad");
      } else if (rng() < [0, 0.06, 0.18, 0.3][j.risk]) {
        const dmg = Math.round(maxHp(s) * 0.14 * j.risk);
        s.hp = Math.max(1, s.hp - dmg);
        log(s, now, `${j.name}: ${j.fail} Perdiste ${dmg} de vida.`, "bad");
      } else {
        const gold = Math.round(rnd(rng, ...j.gold) * (1 + s.stats.lab * 0.015));
        const xp = rnd(rng, ...j.xp);
        s.gold += gold; gainXp(s, now, xp); s.c.jobs++;
        if (j.resp) addRespect(s, now, j.resp);
        if (j.heat) addHeat(s, j.heat);
        log(s, now, `${j.name}: +${money(gold)}, +${xp} XP${j.resp ? `, +${j.resp} de respeto` : ""}.`, "good");
      }
      return {};
    }

    case "train": {
      if (!(a.stat in s.stats)) return fail("Ese atributo no existe.");
      const c = trainCost(s.stats[a.stat]);
      if (s.gold < c) return fail("No te alcanza la plata.");
      /* se paga ahora y el punto llega cuando termina el entrenamiento (tiempo de verdad) */
      const t = trainTime(s.stats[a.stat]);
      s.gold -= c;
      s.busy = { kind: "gym", since: now, until: now + t, stat: a.stat };
      log(s, now, `Empezaste a entrenar ${STAT_NAMES[a.stat].toLowerCase()} (−${money(c)}). Termina en ${Math.round(t / 60_000)} min.`);
      return {};
    }

    case "buy": {
      const it = SHOP.find(i => i.id === a.id);
      if (!it || (it.side && it.side !== s.side)) return fail("Eso no se vende acá.");
      if (itemLocked(s, it)) return fail("Todavía no te lo venden.");
      if (s.gold < it.price) return fail("No te alcanza la plata.");
      if (it.slot !== "consumible" && s.gear[it.slot] === it.id) return fail("Ya lo tenés.");
      s.gold -= it.price; s.c.buy++;
      if (it.slot === "consumible") { s.potions++; log(s, now, "Compraste un botiquín."); }
      else { s.gear[it.slot] = it.id; log(s, now, `Te llevaste ${it.name.toLowerCase()} (−${money(it.price)}).`, "gold"); }
      return {};
    }

    case "kit": {
      if (!s.potions) return fail("No tenés botiquines.");
      s.potions--; s.c.heal++;
      const h = Math.round(maxHp(s) * 0.5); s.hp = Math.min(maxHp(s), s.hp + h);
      log(s, now, `Usaste un botiquín: +${h} de vida.`, "good");
      return {};
    }

    case "heal": {
      const c = healCost(s);
      if (!c) return fail("Estás entero.");
      if (s.gold < c) return fail("No te alcanza la plata.");
      s.gold -= c; s.hp = maxHp(s); s.c.heal++;
      log(s, now, `En la clínica te atendieron al toque (−${money(c)}).`);
      return {};
    }

    case "guardia": {
      if (s.hp >= maxHp(s)) return fail("Estás entero.");
      const t = guardiaTime(s);
      s.busy = { kind: "guardia", since: now, until: now + t, hpFrom: s.hp };
      log(s, now, `Entraste a la guardia del hospital. Es gratis, pero te dan el alta en ${Math.max(1, Math.round(t / 60_000))} min.`);
      return {};
    }

    case "cancel": {
      const b = s.busy;
      if (!b) return fail("No estás haciendo nada.");
      s.busy = null;
      if (b.kind === "gym") log(s, now, "Cortaste el entrenamiento. La plata no se devuelve.", "bad");
      else {
        /* te vas antes: te llevás la parte de la curación que alcanzaste */
        const done = (now - b.since) / Math.max(1, b.until - b.since);
        s.hp = Math.min(maxHp(s), Math.round(b.hpFrom + (maxHp(s) - b.hpFrom) * done)); s.tHeal = now;
        log(s, now, "Te fuiste de la guardia antes del alta.");
      }
      return {};
    }

    case "spar": {
      const m = RING[a.i];
      if (!m || s.lvl < m.lvl) return fail("Ese rival no pelea con vos todavía.");
      if (s.energy < 3 || s.hp < 2) return fail("No estás para pelear.");
      s.energy -= 3;
      const e = scaledEnemy(rng, m.name, Math.max(m.lvl, s.lvl), m.mult);
      const fight = battle(rng, playerFighter(s), e);
      s.hp = Math.max(1, fight.p.hp);
      const gold = Math.round(e.max * 0.4 * m.mult), xp = Math.round(8 + m.lvl * 4 * m.mult);
      if (fight.won) { s.gold += gold; gainXp(s, now, xp); s.wins++; s.c.spar++; log(s, now, `Le ganaste a ${m.name}: +${money(gold)} de la bolsa, +${xp} XP.`, "good"); }
      else { s.losses++; gainXp(s, now, Math.round(xp / 3)); log(s, now, `${m.name} te ganó por puntos. Algo aprendiste.`, "bad"); }
      return { fight };
    }

    case "mstart": {
      const m = getMission(a.id);
      if (!m || !canStart(s, m)) return fail("Esa misión no está disponible.");
      s.mis = { id: m.id, step: 0 };
      log(s, now, `Empezaste la misión «${m.title}».`, "gold");
      return {};
    }

    case "mstep": {
      if (!s.mis) return fail("No estás en ninguna misión.");
      const M = getMission(s.mis.id)!, st = M.steps[s.mis.step];
      if (s.energy < st.energy || s.hp < 2) return fail("No estás para seguir.");
      s.energy -= st.energy;
      let ok: boolean, text: string, fight;
      if (st.fight) {
        fight = battle(rng, playerFighter(s), scaledEnemy(rng, st.fight.name, s.lvl, st.fight.mult));
        s.hp = Math.max(1, fight.p.hp);
        ok = fight.won; text = (ok ? st.win : st.lose) ?? "";
      } else if (st.auto) { ok = true; text = st.ok ?? ""; }
      else {
        const chance = clamp(50 + (s.stats[st.stat!] - st.diff!) * 7, 15, 95);
        ok = rng() * 100 < chance;
        if (!ok && st.dmg) s.hp = Math.max(1, s.hp - Math.round(maxHp(s) * st.dmg));
        text = (ok ? st.ok : st.ko) ?? "";
      }
      if (ok) {
        gainXp(s, now, 4); s.mis.step++;
        if (s.mis.step >= M.steps.length) {
          s.mis = null;
          log(s, now, `Terminaste la misión «${M.title}».`, "gold");
          if (M.id === VALIJA.id) { s.c.valija = 1; text = M.outro; }
          else {
            const r = M.reward!;
            s.done[M.id] = true; s.gold += r.gold; gainXp(s, now, r.xp); addRespect(s, now, r.resp);
            if (r.heat) addHeat(s, r.heat);
            text = `${M.outro} Cobraste ${money(r.gold)}, +${r.xp} XP y +${r.resp} de respeto.`;
          }
        }
      }
      return { fight, mission: { ok, text } };
    }

    case "side": {
      if (!s.tutDone || s.side) return fail("Eso ya está decidido.");
      if (a.side !== "placa" && a.side !== "plata") return fail("Elegí un bando.");
      s.side = a.side; s.tSalary = now - SALARY_EVERY; s.tAttack = now; s.tHeat = now;
      for (const k of ["calle", "ranking"] as const) if (!s.tabs.includes(k)) s.tabs.push(k);
      log(s, now, a.side === "placa"
        ? "Aceptaste la placa. La comisaria Ríos te da una placa con tu nombre mal escrito y un escritorio que cojea."
        : "Aceptaste la plata. La Señora te da un celular viejo y una sola regla: nunca preguntes de dónde sale la plata.", "gold");
      return {};
    }

    case "salary": {
      if (s.side !== "placa") return fail("No cobrás sueldo.");
      if (salaryLeft(s, now)) return fail("Todavía no es día de cobro.");
      const g = salary(s); s.gold += g; s.tSalary = now;
      log(s, now, `Cobraste el sueldo: ${money(g)}.`, "gold");
      return {};
    }

    case "lawyer": {
      const c = lawyerCost(s);
      if (s.side !== "plata" || !s.heat) return fail("No necesitás abogado.");
      if (s.gold < c) return fail("No te alcanza la plata.");
      s.gold -= c; addHeat(s, -40);
      log(s, now, `El abogado de La Señora hizo unas llamadas (−${money(c)}). Bajó el calor.`);
      return {};
    }

    /* scout y duel contra jugadores reales necesitan la base de datos: el servidor los completa */
    case "scout": {
      if (!s.side) return fail("Primero elegí bando.");
      if (s.energy < SCOUT_COST) return fail("No te alcanza la energía.");
      s.energy -= SCOUT_COST;
      return {};
    }

    case "duel": {
      const err = checkDuel(s, a.i);
      if (err) return fail(err);
      const t = s.targets[a.i];
      if (t.kind !== "npc") return fail("Los duelos contra jugadores los resuelve el servidor.");
      s.energy -= DUEL_COST;
      s.targets.splice(a.i, 1);
      const fight = battle(rng, playerFighter(s), scaledEnemy(rng, t.name, t.lvl, 0.95));
      s.hp = Math.max(1, fight.p.hp);
      duelOutcome(s, t, fight.won, now, t.gold);
      return { fight };
    }
  }
}

export function checkDuel(s: PlayerState, i: number): string | null {
  if (s.busy) return `${busyText(s)} Esperá a que termine o cancelalo.`;
  if (!s.side || !s.targets[i]) return "Ese rival ya no está.";
  if (s.energy < DUEL_COST) return "No te alcanza la energía.";
  if (s.hp < maxHp(s) * MIN_HP_TO_FIGHT) return "Estás muy golpeado para salir a pelear.";
  return null;
}

/* Premio o castigo de una pelea en la calle. `loot` es lo que lleva encima el rival. */
export function duelOutcome(s: PlayerState, t: { name: string; lvl: number }, won: boolean, now: number, loot: number, bonusResp = 0) {
  const p = s.side === "placa";
  if (won) {
    const gold = p ? Math.round(loot * 0.2) + t.lvl * 6 : Math.round(loot * 0.35);
    const xp = 6 + t.lvl * 2, r = clamp(4 + (t.lvl - s.lvl) * 2, 1, 12) + bonusResp;
    s.gold += gold; gainXp(s, now, xp); addRespect(s, now, r); s.c.duelW++;
    if (!p) addHeat(s, 5);
    log(s, now, p ? `Arrestaste a ${t.name}: ${money(gold)} de recompensa, +${xp} XP, +${r} de respeto.`
                  : `Le ganaste a ${t.name} y le sacaste ${money(gold)}. +${xp} XP, +${r} de respeto.`, "good");
    return gold;
  }
  s.c.duelL++; addRespect(s, now, -2);
  log(s, now, p ? `${t.name} se te escapó y te dejó en el piso. −2 de respeto.`
                : `${t.name} te redujo; te soltaste y saliste corriendo. −2 de respeto.`, "bad");
  return 0;
}

/* Pelea contra otro jugador de verdad. Cambia los dos estados. */
export function pvp(att: PlayerState, def: PlayerState, { now, rng }: Ctx): ActionResult {
  att.energy -= DUEL_COST;
  const fight = battle(rng, playerFighter(att), playerFighter(def));
  att.hp = Math.max(1, fight.p.hp);
  def.hp = Math.max(1, fight.e.hp);
  const won = fight.won;
  /* lo que se lleva el ganador sale del bolsillo del perdedor */
  const stake = Math.round(def.gold * 0.25);
  const gold = duelOutcome(att, { name: def.name, lvl: def.lvl }, won, now, stake, 2);
  if (won) {
    /* la plata se lleva todo lo que ganó; la placa decomisa una parte y el resto es recompensa del Estado */
    const lost = Math.min(def.gold, att.side === "placa" ? Math.round(stake * 0.2) : gold);
    def.gold -= lost;
    log(def, now, def.side === "placa" ? `${att.name} te emboscó en la calle y se llevó ${money(lost)}.`
                                       : `${att.name} te detuvo y te decomisó ${money(lost)}.`, "bad");
  } else {
    addRespect(def, now, 3);
    log(def, now, def.side === "placa" ? `${att.name} quiso asaltarte y lo dejaste en el piso. +3 de respeto.`
                                       : `${att.name} te quiso detener y te le escapaste a las piñas. +3 de respeto.`, "good");
  }
  def.seenTab.calle = false;
  return { fight };
}

/* Emboscadas de personajes del juego mientras jugás (o mientras no estabas) */
export function ambushCatchUp(s: PlayerState, { now, rng }: Ctx): number {
  if (!s.side) { s.tAttack = now; return 0; }
  const windows = Math.floor((now - s.tAttack) / ATTACK_EVERY);
  if (windows <= 0) return 0;
  s.tAttack += windows * ATTACK_EVERY;
  let hits = 0;
  for (let i = 0; i < Math.min(windows, AMBUSH_MAX_CATCHUP); i++) {
    if (rng() >= AMBUSH_CHANCE || s.hp < maxHp(s) * MIN_HP_TO_FIGHT || s.busy?.kind === "guardia") continue;
    hits++;
    const name = pick(rng, FOES[foeSide(s.side)]);
    const fight = battle(rng, scaledEnemy(rng, name, Math.max(1, s.lvl + rnd(rng, -1, 2)), 0.9), playerFighter(s));
    s.hp = Math.max(1, fight.e.hp);
    if (fight.won) {
      const lost = Math.round(s.gold * 0.08); s.gold -= lost;
      log(s, now, s.side === "placa" ? `${name} te emboscó a la salida de la comisaría y se llevó ${money(lost)}.`
                                     : `${name} te paró en la calle, te revisó y te sacó ${money(lost)}.`, "bad");
    } else {
      addRespect(s, now, 2);
      log(s, now, s.side === "placa" ? `${name} intentó emboscarte, pero lo redujiste. +2 de respeto.`
                                     : `${name} te quiso detener, pero te le escapaste a las piñas. +2 de respeto.`, "good");
    }
    s.seenTab.calle = false;
  }
  return hits;
}
