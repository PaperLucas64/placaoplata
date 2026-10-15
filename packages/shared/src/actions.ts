/* Acciones del jugador. Cada una valida, cambia el estado y devuelve lo que la pantalla tiene que mostrar.
   El servidor es el único que las ejecuta de verdad; el azar llega como `rng`. */
import { AMBUSH_CHANCE, AMBUSH_MAX_CATCHUP, ATTACK_EVERY, DUEL_COST, MIN_HP_TO_FIGHT, SCOUT_COST } from "./config.js";
import { RING, SHOP, STAT_NAMES, TUT, VALIJA } from "./data.js";
import {
  ENCARGO_AFF, ENCARGO_COST, ENCARGOS, GANG_KEYS, GANG_MEMBERS, GANGS, HOME, MISSIONS, POLICE_NAMES
} from "./gangs.js";
import { addInfluence, BARRIOS, HOME_BARRIO, turfMult } from "./territory.js";
import { abandonMission, BOARD_REROLL_COST, CARE_MINS, findMission, meetsReq, missionEnergy, missionPlace, needsTrip, newBoard, POLICE_LVL, startTimedMission } from "./missions.js";
import { arcChapterKey } from "./arcs.js";
import { hasMod, hasVehicle, MODS, nearestCare, travelModes, tripCost, tripMins, VEHICLES, type FromPoint, type ModKey, type TravelMode } from "./geo.js";
import { PROPS, propIncome, propOf } from "./negocios.js";
import { CHASE_NAMES, homePt, nearestPlace, type ChasePlan } from "./route.js";
import { HOUSES, homePlace, houseOf } from "./casas.js";
import { routeTo } from "./geo.js";
import {
  addAff, addHeat, addRespect, battle, clamp, closetSlots, finishBusy, forSale, gainXp, SUPPLEMENT_MAX, supplementCost, supplementsTaken, gangOf, guardiaTime, healCost, isGolpe,
  itemLocked, jobList, lawyerCost, log, maxHp, money, nextLevel, pick, playerFighter, rankOf, rnd, safeCap, scaledEnemy,
  trainCost, trainTime
} from "./rules.js";
import type { Action, ActionResult, Gang, Mission, PlayerState, Rng, Target } from "./types.js";

/* from: si venías volviendo de algo, desde dónde salís (el servidor lo calcula por las cuadras) */
export interface Ctx { now: number; rng: Rng; from?: FromPoint }
const fail = (error: string): ActionResult => ({ error });


/* Las misiones de cada pandilla van en orden y piden rango. Cualquiera puede hacerlas: así se gana afinidad.
   Las de calle están en tu tablón. Los atributos mínimos se chequean aparte (meetsReq). */
export function canStart(s: PlayerState, m: Mission) {
  if (m.id === VALIJA.id) return !s.c.valija;
  if (!s.tutDone) return false;
  if (m.street) return s.board.some(x => x.id === m.id);
  if (m.arc) return arcOpen(s, m) && rankOf(s) >= m.rank;
  if (!m.gang) return false;
  const list = MISSIONS[m.gang], i = list.indexOf(m);
  return i >= 0 && !s.done[m.id] && rankOf(s) >= m.rank && list.slice(0, i).every(x => s.done[x.id]);
}

/* historias de la ciudad: el capítulo tiene que estar abierto (el anterior hecho) y sin hacer desde ningún bando */
export function arcOpen(s: PlayerState, m: Mission) {
  const ch = m.chapter ?? 0;
  if (!m.arc || s.done[arcChapterKey(m.arc, ch)]) return false;
  if (ch > 0 && !s.done[arcChapterKey(m.arc, ch - 1)]) return false;
  return m.pov !== "policia" || s.lvl >= POLICE_LVL;
}

/* medio de transporte por defecto: el más barato que te alcance */
export function defaultMode(s: PlayerState, place: string, from?: FromPoint): TravelMode | undefined {
  const modes = travelModes(s, place, from);
  return (["colectivo", "riel", "micro", "pie", "taxi"] as TravelMode[]).find(k => modes.includes(k) && s.gold >= tripCost(s, k, place, from)) ?? modes[0];
}

/* adónde vas a curarte, cuánto tardás y cuánto sale */
export const AMBULANCE_FEE = 15;
export function carePlan(s: PlayerState, kind: "guardia" | "clinica", from?: FromPoint) {
  const care = nearestCare(s, kind);
  const home = homePlace(s);
  const here = !from && care.place === home;
  const mode: TravelMode = kind === "clinica" ? "ambulancia" : (from ? from.km : routeTo(home, care.place)?.pie) ? "pie" : "colectivo";
  const go = here ? 0 : tripMins(s, mode, care.place, from) * 60_000;
  const stay = kind === "clinica" ? CARE_MINS.clinica * 60_000 : guardiaTime(s);
  const cost = kind === "clinica" ? (healCost(s) ? healCost(s) + AMBULANCE_FEE : 0) : 0;
  return { ...care, mode, go, stay, cost };
}

/* rival de la calle: alguien de otra pandilla (o de cualquiera, si andás suelto) */
export const otherGangs = (mine: Gang | null) => GANG_KEYS.filter(g => g !== mine);
export const npcTarget = (rng: Rng, mine: Gang | null, lvl: number): Target => {
  const gang = pick(rng, otherGangs(mine));
  const l = Math.max(1, lvl + rnd(rng, -2, lvl < 8 ? 1 : 2)); // a nivel bajo, un nivel pesa mucho
  return { kind: "npc", name: pick(rng, GANG_MEMBERS[gang]), lvl: l, gold: rnd(rng, l * 20, l * 55), gang };
};

/* chance de pasar una prueba: 50% + 7% por punto de diferencia con la dificultad */
const checkChance = (stat: number, diff: number) => clamp(50 + (stat - diff) * 7, 15, 95);

/* Mientras entrenás o estás internado no podés hacer estas cosas */
const BLOCKED_WHEN_BUSY = new Set<Action["type"]>(["job", "encargo", "train", "spar", "mstart", "reroll", "duel", "scout", "guardia", "heal", "move"]);
const busyText = (s: PlayerState) =>
  s.busy?.kind === "gym" ? "Estás entrenando en el gimnasio." : s.busy?.kind === "mision" ? "Estás en una misión."
  : s.busy?.kind === "caza" ? `Saliste a buscar a ${s.busy.targetName}.` : s.busy?.kind === "vuelta" ? "Estás volviendo a casa."
  : s.busy?.clinic ? "Te están curando en la clínica." : "Estás en la guardia.";
/* volviendo a casa podés arrancar otra cosa que te lleve a otro lado (salís desde donde estés) */
export const onTheWayHome = (s: PlayerState) => s.busy?.kind === "vuelta";
const FROM_STREET = new Set<Action["type"]>(["mstart", "guardia", "heal", "job", "encargo", "kit", "spar", "duel", "scout", "reroll"]);

/* Con una misión de a dos aceptada que todavía no arrancó, no se puede empezar otra cosa larga */
const BLOCKED_WHEN_COOP_WAITING = new Set<Action["type"]>(["train", "guardia", "mstart", "reroll"]);

export function applyAction(s: PlayerState, a: Action, ctx: Ctx): ActionResult {
  const { now, rng } = ctx;
  finishBusy(s, now);
  if (s.busy && BLOCKED_WHEN_BUSY.has(a.type) && !(onTheWayHome(s) && FROM_STREET.has(a.type)))
    return fail(onTheWayHome(s) ? "Estás volviendo a casa: eso lo hacés cuando llegues." : `${busyText(s)} Esperá a que termine o cancelalo.`);
  if (s.coop?.status === "waiting" && BLOCKED_WHEN_COOP_WAITING.has(a.type))
    return fail(`Tenés una misión de a dos con ${s.coop.partner}: arranca cuando los dos estén libres.`);
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
      else {
        /* fin del tutorial: se abre la ciudad (golpes, encargos, misiones de pandilla, la calle y tu casa) */
        s.tutDone = true; s.tAttack = now; s.tHeat = now;
        for (const k of ["calle", "casa", "negocios", "amigos", "ranking"] as const) if (!s.tabs.includes(k)) s.tabs.push(k);
        log(s, now, "Las cuatro pandillas de Maires ya saben quién sos. Marga te deja la llave de una pieza de pensión: tu casa.", "gold");
      }
      return {};
    }

    case "job": {
      const j = jobList(s).find(x => x.id === a.id);
      if (!j) return fail("Ese trabajo no existe.");
      if (s.lvl < j.lvl) return fail(`Pide nivel ${j.lvl}.`);
      if (s.energy < j.cost) return fail("No te alcanza la energía.");
      s.energy -= j.cost;
      const golpe = isGolpe(j.id);
      /* en los golpes, con calor alto es más fácil que te agarre la policía (con 50 de calor, ~1 de cada 7) */
      if (golpe && rng() < s.heat / 400 + j.risk * 0.01) {
        const fine = Math.min(s.gold, Math.round(s.gold * 0.1) + s.lvl * 5);
        s.gold -= fine; addHeat(s, -35);
        log(s, now, `${j.name}: te agarró la policía. Pagaste ${money(fine)} de fianza y pasaste la noche en un calabozo.`, "bad");
      } else if (rng() < [0, 0.06, 0.18, 0.3][j.risk]) {
        const dmg = Math.round(maxHp(s) * 0.14 * j.risk);
        s.hp = Math.max(1, s.hp - dmg);
        log(s, now, `${j.name}: ${j.fail} Perdiste ${dmg} de vida.`, "bad");
      } else {
        const perk = golpe && gangOf(s) === "familia" ? 1.1 : 1; // La Familia saca más de cada golpe
        const gold = Math.round(rnd(rng, ...j.gold) * (1 + s.stats.lab * 0.015) * perk * (golpe ? turfMult(s) : 1));
        if (golpe) addInfluence(s, gangOf(s), pick(rng, BARRIOS), 1); // cada golpe marca territorio para tu pandilla
        const xp = rnd(rng, ...j.xp);
        s.gold += gold; gainXp(s, now, xp); s.c.jobs++;
        if (j.resp) addRespect(s, now, j.resp);
        if (j.heat) addHeat(s, j.heat);
        log(s, now, `${j.name}: +${money(gold)}, +${xp} XP${j.resp ? `, +${j.resp} de respeto` : ""}.`, "good");
      }
      return {};
    }

    /* encargo de una pandilla: repetible, suma afinidad con ella */
    case "encargo": {
      const e = ENCARGOS[a.gang];
      if (!e || !s.tutDone) return fail("Ese encargo no existe.");
      if (s.energy < ENCARGO_COST) return fail("No te alcanza la energía.");
      if (s.hp < maxHp(s) * MIN_HP_TO_FIGHT) return fail("Estás muy golpeado. Pasá por la clínica.");
      s.energy -= ENCARGO_COST;
      const diff = Math.round(Math.max(5, 0.5 + s.lvl * 1.4) * 0.85);
      const g = GANGS[a.gang];
      if (rng() * 100 < checkChance(s.stats[e.stat], diff)) {
        const gold = Math.round(rnd(rng, s.lvl * 10, s.lvl * 18) * (1 + s.stats.lab * 0.015) * turfMult(s));
        addInfluence(s, a.gang, HOME_BARRIO[a.gang], 1);
        const xp = 6 + s.lvl * 3;
        s.gold += gold; gainXp(s, now, xp); addRespect(s, now, 3); addHeat(s, 3);
        log(s, now, `${e.name} para ${g.name}: ${e.ok} +${money(gold)}, +${xp} XP.`, "good");
        addAff(s, now, a.gang, ENCARGO_AFF);
      } else {
        const dmg = Math.round(maxHp(s) * 0.12);
        s.hp = Math.max(1, s.hp - dmg);
        log(s, now, `${e.name} para ${g.name}: ${e.ko} Perdiste ${dmg} de vida.`, "bad");
        addAff(s, now, a.gang, 1); // aunque salga mal, se acuerdan de que diste la cara
      }
      return {};
    }

    case "train": {
      if (!(a.stat in s.stats)) return fail("Ese atributo no existe.");
      const c = trainCost(s.stats[a.stat]);
      if (s.gold < c) return fail("No te alcanza la plata.");
      /* se paga ahora y el punto llega cuando termina el entrenamiento (tiempo de verdad) */
      const t = trainTime(s.stats[a.stat], s);
      s.gold -= c;
      s.busy = { kind: "gym", since: now, until: now + t, stat: a.stat };
      log(s, now, `Empezaste a entrenar ${STAT_NAMES[a.stat].toLowerCase()} (−${money(c)}). Termina en ${Math.round(t / 60_000)} min.`);
      return {};
    }

    case "buy": {
      const it = SHOP.find(i => i.id === a.id);
      if (!it || !forSale(s, it)) return fail(s.tutDone ? "Eso no se vende acá." : "Por ahora la feria solo te vende una llave inglesa.");
      if (itemLocked(s, it)) return fail("Todavía no te lo venden.");
      if (it.id === "suplemento") {
        if (supplementsTaken(s) >= SUPPLEMENT_MAX) return fail("Don Tito dice que ya no te hace efecto.");
        const c = supplementCost(s);
        if (s.gold < c) return fail("No te alcanza la plata.");
        s.gold -= c; s.hpBonus = (s.hpBonus ?? 0) + it.val; s.hp += it.val; s.c.buy++;
        log(s, now, `Tomaste el suplemento de Don Tito (−${money(c)}): +${it.val} de vida máxima para siempre.`, "gold");
        return {};
      }
      if (s.gold < it.price) return fail("No te alcanza la plata.");
      if (it.slot !== "consumible" && (s.gear[it.slot] === it.id || s.home.closet.includes(it.id))) return fail("Ya lo tenés.");
      s.gold -= it.price; s.c.buy++;
      if (it.slot === "consumible") { s.potions++; log(s, now, "Compraste un botiquín."); return {}; }
      const old = s.gear[it.slot];
      s.gear[it.slot] = it.id;
      log(s, now, `Te llevaste ${it.name.toLowerCase()} (−${money(it.price)}).`, "gold");
      if (old) stash(s, now, old);
      return {};
    }

    /* sacar algo del armario: lo que tenías puesto vuelve al armario */
    case "equip": {
      const it = SHOP.find(i => i.id === a.id);
      const k = s.home.closet.indexOf(a.id);
      if (!it || k < 0 || it.slot === "consumible") return fail("Eso no está en tu armario.");
      s.home.closet.splice(k, 1);
      const old = s.gear[it.slot];
      s.gear[it.slot] = it.id;
      if (old) s.home.closet.push(old);
      log(s, now, `Te pusiste ${it.name.toLowerCase()}.`);
      return {};
    }

    case "kit": {
      if (!s.potions) return fail("No tenés botiquines.");
      s.potions--; s.c.heal++;
      const h = Math.round(maxHp(s) * 0.5); s.hp = Math.min(maxHp(s), s.hp + h);
      log(s, now, `Usaste un botiquín: +${h} de vida.`, "good");
      return {};
    }

    /* clínica privada: pagás, te busca una ambulancia, te atienden rápido y te lleva a casa. Intocable. */
    case "heal": {
      const plan = carePlan(s, "clinica", ctx.from);
      if (!plan.cost) return fail("Estás entero.");
      if (s.gold < plan.cost) return fail(`La clínica y la ambulancia salen ${money(plan.cost)}: no te alcanza.`);
      s.gold -= plan.cost;
      s.busy = { kind: "guardia", clinic: true, since: now, until: now + plan.go + plan.stay, hpFrom: s.hp,
        trip: plan.go ? { mode: "ambulancia", place: plan.place, go: plan.go, back: 0, ev: 0, from: homePlace(s), ...(ctx.from?.path ? { path: ctx.from.path } : {}) } : null };
      log(s, now, `Llamaste a la ${plan.name} (−${money(plan.cost)}): la ambulancia te lleva a los pedos. Mientras te curan, nadie te puede tocar.`);
      return {};
    }

    /* guardia del hospital: gratis, pero vas caminando y esperás. Intocable mientras tanto. */
    case "guardia": {
      if (s.hp >= maxHp(s)) return fail("Estás entero.");
      const plan = carePlan(s, "guardia", ctx.from);
      s.busy = { kind: "guardia", since: now, until: now + plan.go + plan.stay, hpFrom: s.hp,
        trip: plan.go ? { mode: plan.mode, place: plan.place, go: plan.go, back: 0, ev: 0, from: homePlace(s), ...(ctx.from?.path ? { path: ctx.from.path } : {}) } : null };
      log(s, now, plan.go ? `Saliste ${plan.mode === "pie" ? "caminando" : "en colectivo"} para la guardia del ${plan.name}, en ${plan.place}. Te dan el alta en unos ${Math.round((plan.go + plan.stay) / 60_000)} min.`
                          : `Entraste a la guardia del ${plan.name}. Te dan el alta en ${Math.max(1, Math.round(plan.stay / 60_000))} min.`);
      return {};
    }

    case "cancel": {
      const b = s.busy;
      if (!b) return fail("No estás haciendo nada.");
      if (b.kind === "mision" && b.id.startsWith("coop-")) return fail("La misión de a dos se cancela desde Amigos.");
      if (b.kind === "mision") { abandonMission(s, now); return {}; }
      if (b.kind === "vuelta") return fail("Ya estás volviendo a casa.");
      s.busy = null;
      if (b.kind === "caza") log(s, now, `Dejaste de buscar a ${b.targetName} y volviste a la pensión.`);
      else if (b.kind === "gym") log(s, now, "Cortaste el entrenamiento. La plata no se devuelve.", "bad");
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
      const m = findMission(s, a.id);
      if (!m || !canStart(s, m)) return fail("Esa misión no está disponible.");
      if (!meetsReq(s, m)) return fail("Todavía no tenés los atributos que pide.");
      if (s.energy < missionEnergy(m)) return fail(`Te hacen falta ${missionEnergy(m)} de energía.`);
      if (s.hp < maxHp(s) * 0.5) return fail("Así de golpeado no te conviene salir. Curate primero.");
      const place = missionPlace(m);
      const from = onTheWayHome(s) ? ctx.from : undefined;
      if (onTheWayHome(s) && !from) return fail("Estás volviendo a casa: no se pudo calcular el camino desde donde estás. Probá de nuevo.");
      let mode: TravelMode | undefined;
      if (place && needsTrip(s, m, from)) {
        mode = a.mode ?? defaultMode(s, place, from);
        if (!mode || !travelModes(s, place, from).includes(mode)) return fail("No podés ir así hasta ahí.");
        const cost = tripCost(s, mode, place, from);
        if (s.gold < cost) return fail(`El viaje sale ${money(cost)} y no te alcanza.`);
      }
      startTimedMission(s, m, now, mode, rng, from);
      return {};
    }

    case "reroll": {
      if (!s.tutDone) return fail("Todavía no conocés la calle.");
      if (s.energy < BOARD_REROLL_COST) return fail("No te alcanza la energía.");
      s.energy -= BOARD_REROLL_COST;
      newBoard(s, rng, now);
      log(s, now, "Preguntaste por el barrio: hay trabajos nuevos en el tablón.");
      return {};
    }

    case "lawyer": {
      const c = lawyerCost(s);
      if (!s.heat) return fail("No necesitás abogado.");
      if (s.gold < c) return fail("No te alcanza la plata.");
      s.gold -= c; s.heat = Math.max(0, s.heat - 40);
      log(s, now, `Un abogado hizo unas llamadas (−${money(c)}). Bajó tu nivel de búsqueda.`);
      return {};
    }

    /* ---------- la casa ---------- */
    case "build": {
      if (!s.tutDone) return fail("Todavía no tenés casa.");
      if (!(a.part in HOME)) return fail("Eso no se puede mejorar.");
      if (s.home.obra) return fail("Ya hay una obra en tu casa. Esperá a que termine.");
      const lv = nextLevel(s, a.part);
      if (!lv) return fail("Ya está al máximo.");
      const house = houseOf(s);
      if (s.home[a.part] + 1 > house.cap) return fail(`En tu ${house.name.toLowerCase()} no entra algo mejor. Mudate a una casa más grande.`);
      if (s.gold < lv.cost) return fail("No te alcanza la plata.");
      s.gold -= lv.cost;
      s.home.obra = { part: a.part, since: now, until: now + lv.mins * 60_000 };
      log(s, now, `Arrancó la obra: ${lv.name.toLowerCase()} (−${money(lv.cost)}). Termina en ${lv.mins} min.`);
      return {};
    }

    case "move": {
      const h = HOUSES.find(x => x.id === a.id);
      if (!h || !s.tutDone) return fail("Esa casa no existe.");
      if (houseOf(s).id === h.id) return fail("Ya vivís ahí.");
      if (s.home.obra) return fail("Esperá a que termine la obra antes de mudarte.");
      if (s.lvl < h.lvl) return fail(`Pide nivel ${h.lvl}.`);
      if (s.gold < h.price) return fail("No te alcanza la plata.");
      s.gold -= h.price; s.home.house = h.id;
      log(s, now, `Te mudaste: ${h.name.toLowerCase()} en ${h.place}${h.price ? ` (−${money(h.price)})` : ""}. Desde ahora tus viajes salen de ahí.`, "gold");
      return {};
    }

    case "deposit": {
      const room = safeCap(s) - s.home.safe;
      const n = Math.floor(Math.min(a.amount, s.gold, room));
      if (!safeCap(s)) return fail("Todavía no tenés caja fuerte.");
      if (n <= 0) return fail(room <= 0 ? "La caja fuerte está llena." : "No tenés plata encima.");
      s.gold -= n; s.home.safe += n;
      log(s, now, `Guardaste ${money(n)} en la caja fuerte.`);
      return {};
    }

    case "withdraw": {
      const n = Math.floor(Math.min(a.amount, s.home.safe));
      if (n <= 0) return fail("La caja fuerte está vacía.");
      s.home.safe -= n; s.gold += n;
      log(s, now, `Sacaste ${money(n)} de la caja fuerte.`);
      return {};
    }

    /* ---------- negocios y garaje ---------- */
    case "prop": {
      const p = propOf(a.id);
      if (!p || !s.tutDone) return fail("Ese negocio no existe.");
      if (s.props?.[p.id] !== undefined) return fail("Ya es tuyo.");
      if (s.lvl < p.lvl) return fail(`Pide nivel ${p.lvl}.`);
      if (s.gold < p.price) return fail("No te alcanza la plata.");
      s.gold -= p.price; (s.props ??= {})[p.id] = now;
      log(s, now, `Compraste ${p.name.toLowerCase()} (−${money(p.price)}). Deja ${money(p.perHour)} por hora: pasá a cobrar.`, "gold");
      return {};
    }

    case "collect": {
      let total = 0, heat = 0;
      for (const p of PROPS) {
        const since = s.props?.[p.id];
        if (since === undefined) continue;
        const g = propIncome(p, since, now);
        if (g <= 0) continue;
        total += g; heat += p.heat ?? 0; s.props![p.id] = now;
      }
      if (!total) return fail("Tus negocios todavía no juntaron nada.");
      s.gold += total;
      if (heat) addHeat(s, heat);
      log(s, now, `Pasaste a cobrar por tus negocios: +${money(total)}${heat ? `, +${heat} de búsqueda` : ""}.`, "good");
      return {};
    }

    case "vehicle": {
      const v = VEHICLES[a.v];
      if (!v || !s.tutDone) return fail("Eso no se vende.");
      if (hasVehicle(s, a.v)) return fail("Ya lo tenés.");
      if (s.lvl < v.lvl) return fail(`Pide nivel ${v.lvl}.`);
      if (s.gold < v.price) return fail("No te alcanza la plata.");
      s.gold -= v.price; (s.garage ??= {})[a.v] = [];
      log(s, now, `Te compraste ${a.v === "moto" ? "una" : "un"} ${v.name.toLowerCase()} (−${money(v.price)}). Ahora podés ir a las misiones por tu cuenta.`, "gold");
      return {};
    }

    case "mod": {
      const md = MODS[a.mod as ModKey], price = md?.price[a.v];
      if (!md || !price) return fail("Ese arreglo no existe.");
      if (!hasVehicle(s, a.v)) return fail("Primero comprate el vehículo.");
      if (hasMod(s, a.v, a.mod as ModKey)) return fail("Ya lo tiene.");
      const cost = modCost(s, price);
      if (s.gold < cost) return fail("No te alcanza la plata.");
      s.gold -= cost; s.garage![a.v]!.push(a.mod);
      log(s, now, `${md.name} para tu ${a.v} (−${money(cost)}).`, "good");
      return {};
    }

    /* scout y duel contra jugadores reales necesitan la base de datos: el servidor los completa */
    case "scout": {
      if (!s.tutDone) return fail("Todavía no conocés la calle.");
      if (s.energy < SCOUT_COST) return fail("No te alcanza la energía.");
      s.energy -= SCOUT_COST;
      return {};
    }

    case "chase": return fail("Eso lo resuelve el servidor.");

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

/* con el taller propio, los arreglos salen 30% menos */
export const modCost = (s: PlayerState, price: number) => (s.props?.taller !== undefined ? Math.round(price * 0.7) : price);

/* lo que dejás de usar va al armario si hay lugar; si no, se pierde */
function stash(s: PlayerState, now: number, id: string) {
  const it = SHOP.find(i => i.id === id);
  if (s.home.closet.length < closetSlots(s)) { s.home.closet.push(id); log(s, now, `Guardaste ${it?.name.toLowerCase()} en el armario.`); }
  else log(s, now, `No tenías lugar en el armario: ${it?.name.toLowerCase()} quedó en la feria.`);
}

export function checkDuel(s: PlayerState, i: number): string | null {
  if (s.busy) return `${busyText(s)} Esperá a que termine o cancelalo.`;
  if (!s.tutDone || !s.targets[i]) return "Ese rival ya no está.";
  if (s.energy < DUEL_COST) return "No te alcanza la energía.";
  if (s.hp < maxHp(s) * MIN_HP_TO_FIGHT) return "Estás muy golpeado para salir a pelear.";
  return null;
}

/* Salir a cruzar en el mapa a alguien que está en una misión (viajando o en el lugar).
   No a los de tu pandilla ni a alguien mucho más chico que vos. Si no lo alcanzás a tiempo, no salís. */
export const AMBUSH_LVL_GAP = 3;
export function canAmbush(att: PlayerState, def: PlayerState, now: number): string | null {
  if (att.busy) return `${busyText(att)} Para salir a buscar a alguien tenés que estar libre.`;
  if (!att.tutDone) return "Todavía no conocés la calle.";
  if (att.energy < DUEL_COST) return "No te alcanza la energía.";
  if (att.hp < maxHp(att) * MIN_HP_TO_FIGHT) return "Estás muy golpeado para salir a pelear.";
  const b = def.busy;
  if (b?.kind === "guardia") return `${def.name} se está curando: ahí no se toca.`;
  if (b?.kind === "vuelta" && b.safe) return `${def.name} va en ambulancia.`;
  if (!((b?.kind === "mision" && b.trip) || b?.kind === "vuelta") || now >= b.until) return `${def.name} está en su casa: ahí no se puede.`;
  const g = gangOf(def);
  if (g && g === gangOf(att)) return `${def.name} es de tu pandilla.`;
  if (def.lvl < att.lvl - AMBUSH_LVL_GAP) return `${def.name} es muy chico para vos: nadie te respetaría por eso.`;
  if (def.hp < maxHp(def) * MIN_HP_TO_FIGHT) return `${def.name} ya está muy golpeado.`;
  return null;
}
/* sale a buscarlo: queda ocupado hasta volver; la pelea la resuelve el servidor a la hora del cruce */
export function startChase(att: PlayerState, def: PlayerState, defId: number, plan: ChasePlan, now: number, path?: [number, number][]) {
  const place = nearestPlace(plan.at);
  const until = plan.meet + (plan.meet - now);
  att.energy -= DUEL_COST; att.gold -= plan.cost;
  att.busy = { kind: "caza", since: now, until, meet: plan.meet, target: defId, targetName: def.name, place,
    from: homePt(att), at: plan.at, mode: plan.mode, ...(path ? { path } : {}) };
  log(att, now, `Saliste a buscar a ${def.name} ${CHASE_NAMES[plan.mode].toLowerCase()}: lo cruzás cerca de ${place} en ${Math.max(1, Math.round((plan.meet - now) / 60_000))} min.`, "gold");
}
/* el asalto: una pelea entre jugadores, y quien lo sufre se entera de dónde fue */
export function ambushPlayer(att: PlayerState, def: PlayerState, ctx: Ctx, where?: string): ActionResult {
  const b = def.busy;
  where ??= b?.kind === "mision" && b.trip ? b.trip.place : "la calle";
  const r = pvp(att, def, ctx);
  log(def, ctx.now, r.fight!.won ? `${att.name} te salió a buscar y te asaltó cerca de ${where}.` : `${att.name} te salió a buscar cerca de ${where} y lo rechazaste.`, r.fight!.won ? "bad" : "good");
  return r;
}
/* cruce casual en el camino: pelean, pero nadie gastó energía en buscarlo */
export function crossFight(a: PlayerState, b: PlayerState, ctx: Ctx, where: string): ActionResult {
  const r = pvp(a, b, ctx);
  a.energy += DUEL_COST;
  log(a, ctx.now, `Te cruzaste con ${b.name} cerca de ${where} y se armó.`);
  log(b, ctx.now, `Te cruzaste con ${a.name} cerca de ${where} y se armó.`, r.fight!.won ? "bad" : "good");
  return r;
}

/* Premio o castigo de una pelea en la calle. `loot` es lo que lleva encima el rival. */
export function duelOutcome(s: PlayerState, t: { name: string; lvl: number; gang?: Gang | null }, won: boolean, now: number, loot: number, bonusResp = 0) {
  if (won) {
    if (t.gang) addInfluence(s, gangOf(s), HOME_BARRIO[t.gang], 2); // ganarle a uno en su barrio
    const gold = Math.round(loot * 0.35);
    const xp = 6 + t.lvl * 2, r = clamp(4 + (t.lvl - s.lvl) * 2, 1, 12) + bonusResp;
    s.gold += gold; gainXp(s, now, xp); addRespect(s, now, r); s.c.duelW++;
    addHeat(s, 4);
    log(s, now, `Le ganaste a ${t.name} y le sacaste ${money(gold)}. +${xp} XP, +${r} de respeto.`, "good");
    return gold;
  }
  s.c.duelL++; addRespect(s, now, -2);
  log(s, now, `${t.name} te dio una paliza; saliste corriendo. −2 de respeto.`, "bad");
  return 0;
}

/* Pelea contra otro jugador de verdad. Cambia los dos estados. Lo guardado en la caja fuerte no se toca. */
export function pvp(att: PlayerState, def: PlayerState, { now, rng }: Ctx): ActionResult {
  att.energy -= DUEL_COST;
  const fight = battle(rng, playerFighter(att), playerFighter(def));
  att.hp = Math.max(1, fight.p.hp);
  def.hp = Math.max(1, fight.e.hp);
  const stake = Math.round(def.gold * 0.25);
  const gold = duelOutcome(att, { name: def.name, lvl: def.lvl, gang: gangOf(def) }, fight.won, now, stake / 0.35, 2);
  const ag = gangOf(att), tag = ag ? ` (${GANGS[ag].name})` : "";
  if (fight.won) {
    const lost = Math.min(def.gold, gold);
    def.gold -= lost;
    log(def, now, `${att.name}${tag} te agarró en la calle y se llevó ${money(lost)}.`, "bad");
  } else {
    addRespect(def, now, 3);
    log(def, now, `${att.name}${tag} te quiso apretar y lo dejaste en el piso. +3 de respeto.`, "good");
  }
  def.seenTab.calle = false;
  return { fight };
}

/* ¿andás por la calle? (viajando a una misión, volviendo a casa o buscando a alguien; curándote no cuenta) */
export function onStreet(s: PlayerState, now: number) {
  const b = s.busy;
  if (!b) return false;
  if (b.kind === "vuelta") return !b.safe;
  if (b.kind === "caza") return true;
  if (b.kind === "mision" && b.trip) return now < b.since + b.trip.go || (!!b.trip.back && now >= b.until - b.trip.back);
  return false;
}
/* Emboscadas mientras andás por la calle: de otra pandilla, o de la policía si tenés mucho calor */
export function ambushCatchUp(s: PlayerState, { now, rng }: Ctx): number {
  if (!s.tutDone) { s.tAttack = now; return 0; }
  const windows = Math.floor((now - s.tAttack) / ATTACK_EVERY);
  if (windows <= 0) return 0;
  s.tAttack += windows * ATTACK_EVERY;
  let hits = 0;
  for (let i = 0; i < Math.min(windows, AMBUSH_MAX_CATCHUP); i++) {
    if (!onStreet(s, now) || rng() >= AMBUSH_CHANCE || s.hp < maxHp(s) * MIN_HP_TO_FIGHT) continue; // en tu casa (o curándote) nadie te toca
    hits++;
    const police = s.heat >= 40 && rng() < s.heat / 100;
    const gang = pick(rng, otherGangs(gangOf(s)));
    const name = police ? pick(rng, POLICE_NAMES) : pick(rng, GANG_MEMBERS[gang]);
    const fight = battle(rng, scaledEnemy(rng, name, Math.max(1, s.lvl + rnd(rng, -1, 2)), 0.9), playerFighter(s));
    s.hp = Math.max(1, fight.e.hp);
    if (fight.won) {
      const lost = Math.round(s.gold * 0.08); s.gold -= lost;
      log(s, now, police ? `${name} te paró, te revisó y te "decomisó" ${money(lost)}.`
                         : `${name}, de ${GANGS[gang].name}, te emboscó en la calle y se llevó ${money(lost)}.`, "bad");
    } else {
      addRespect(s, now, 2);
      log(s, now, police ? `${name} te quiso detener y te le escapaste. +2 de respeto.`
                         : `${name}, de ${GANGS[gang].name}, te quiso emboscar y lo dejaste en el piso. +2 de respeto.`, "good");
    }
    s.seenTab.calle = false;
  }
  return hits;
}
