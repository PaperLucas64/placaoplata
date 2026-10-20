/* Misiones a tiempo humano: al empezar, tu personaje sale a hacerla; cada etapa se resuelve sola a su hora y la crónica
   cuenta lo que pasó. Las resuelve el servidor (y el bot de balance): la pantalla solo muestra el avance.
   Además, el tablón de misiones de calle generadas a tu nivel. */
import { ARC_INFLUENCE, ARC_MISSIONS, arcChapterKey, COMISARIO } from "./arcs.js";
import { SHOP, STAT_NAMES, VALIJA } from "./data.js";
import { EVENT_MISSIONS } from "./eventos.js";
import { GANG_KEYS, GANG_MEMBERS, GANGS, MISSION_AFF, MISSIONS, POLICE_NAMES } from "./gangs.js";
import { GEO_PLACES, routeTo, TRAVEL, ZONE_NAMES, tripCost, tripEvent, tripMins, tripText, walkEnergy, type FromPoint, type TravelMode } from "./geo.js";
import { PROP_OBJECTIVES, propOf, type PropId } from "./negocios.js";
import { homePlace } from "./casas.js";
import { addAff, addHeat, addRespect, news, durTxt, battle, clamp, eff, gainXp, gangOf, log, maxHp, money, pick, playerFighter, rnd, scaledEnemy } from "./rules.js";
import { addInfluence, BARRIOS, HOME_BARRIO, turfMult } from "./territory.js";
import type { Gang, Mission, MissionStep, PlayerState, Rng, StatKey } from "./types.js";

const MIN = 60_000;
export const VALIJA_MINS = 30;
export const STORY_MINS = [15, 30, 45];           // misiones de pandilla: 1ª, 2ª y 3ª del hilo (más el viaje)
const STORY_REQ = [[7, 6], [10, 9], [16, 15]];      // atributos mínimos para empezarlas
export const BOARD_SIZE = 4;
export const BOARD_EVERY = 6 * 60 * MIN;            // el tablón de la calle se renueva cada 6 horas
export const BOARD_REROLL_COST = 2;                 // o pagando energía

/* ---------- datos de cada misión ---------- */
export const allStory = (): Mission[] => [VALIJA, ...GANG_KEYS.flatMap(g => MISSIONS[g]), ...ARC_MISSIONS, ...EVENT_MISSIONS];
export const findMission = (s: Pick<PlayerState, "board" | "coop">, id: string) =>
  allStory().find(m => m.id === id) ?? s.board?.find(m => m.id === id) ?? (s.coop?.mission.id === id ? s.coop.mission : undefined);
/* dónde pasa: las de la historia de cada pandilla, en su barrio. La valija y las de a dos no tienen viaje. */
export const missionPlace = (m: Mission): string | undefined =>
  m.id === VALIJA.id || m.id.startsWith("coop-") ? undefined : m.place ?? (m.gang ? HOME_BARRIO[m.gang] : undefined);
export const needsTrip = (s: PlayerState, m: Mission, fp?: FromPoint) => (fp ? !!missionPlace(m) : !!routeTo(homePlace(s), missionPlace(m)));
/* minutos de trabajo en el lugar (sin contar el viaje) */
export const missionMins = (m: Mission) => m.mins ?? (m.id === VALIJA.id ? VALIJA_MINS : STORY_MINS[m.tier ?? 0]);
export const missionEnergy = (m: Mission) => Math.round(m.steps.reduce((a, st) => a + st.energy, 0));
/* cuántas etapas tienen que salir bien (La valija perdona más: es el tutorial) */
export const missionNeed = (m: Mission) => m.id === VALIJA.id ? 2 : Math.ceil(m.steps.length * 0.6);

/* requisitos: los dos atributos que más usa la misión, según la dificultad */
export function missionReq(m: Mission): Partial<Record<StatKey, number>> {
  if (m.req) return m.req;
  if (m.id === VALIJA.id || m.tier === undefined) return {};
  const count: Partial<Record<StatKey, number>> = {};
  for (const st of m.steps) if (st.stat) count[st.stat] = (count[st.stat] ?? 0) + 1;
  const top = (Object.keys(count) as StatKey[]).sort((a, b) => count[b]! - count[a]!).slice(0, 2);
  return Object.fromEntries(top.map((k, i) => [k, STORY_REQ[m.tier!][i]]));
}
export const meetsReq = (s: PlayerState, m: Mission) =>
  (Object.entries(missionReq(m)) as [StatKey, number][]).every(([k, v]) => eff(s, k) >= v);

/* ---------- empezar, avanzar, terminar ---------- */
/* Salís a hacer la misión: desde tu casa, o desde donde estés si venías volviendo de otra cosa (fp).
   Cuando termina, volvés a casa (y en el camino podés arrancar otra cosa). */
export function startTimedMission(s: PlayerState, m: Mission, now: number, mode?: TravelMode, rng: Rng = Math.random, fp?: FromPoint) {
  const place = missionPlace(m);
  const from = homePlace(s);
  const trip = !!(mode && place && (fp ? place : routeTo(from, place)));
  const go = trip ? tripMins(s, mode!, place!, fp) * MIN : 0;
  const work = missionMins(m) * MIN;
  const walk = trip ? walkEnergy(s, mode!, place!, fp) : 0;
  s.energy = Math.max(0, s.energy - missionEnergy(m) - walk);
  if (trip) s.gold -= tripCost(s, mode!, place!, fp);
  s.busy = { kind: "mision", id: m.id, since: now, until: now + go + work, done: 0, ok: 0, res: [],
    trip: trip ? { mode: mode!, place: place!, go, back: 0, ev: 0, from, ...(fp?.path ? { path: fp.path } : {}) } : null };
  const total = Math.round((go + work) / MIN);
  log(s, now, trip
    ? `Saliste a hacer «${m.title}»${fp ? " desde donde estabas" : ""}. ${tripText(s, mode!, place!, rng, fp)} Llegás en ${durTxt(go / MIN)} y la misión dura ${durTxt(work / MIN)}; después volvés a casa.${walk ? ` Caminar te cuesta ${walk} de energía.` : ""}`
    : `Saliste a hacer «${m.title}». Terminás en ${durTxt(total)}.`, "gold");
}

/* volver a casa: estás en la calle (salvo en ambulancia) hasta llegar. Caminando, la vuelta también cansa
   (nunca te deja en negativo; volviendo de curarte, no). share: qué parte del camino cuenta (las salidas son más cortas). */
export function startReturn(s: PlayerState, mode: TravelMode, place: string, at: number, rng: Rng, safe = false, label?: string, ok?: boolean,
  walk: { free?: boolean; share?: number } = {}) {
  const home = homePlace(s);
  const r = routeTo(home, place);
  if (!r) { s.busy = null; return; }
  const m: TravelMode = mode === "riel" && !r.riel ? "colectivo" : mode === "pie" && !r.pie ? "colectivo" : mode;
  if (!walk.free) s.energy = Math.max(0, s.energy - Math.round(walkEnergy(s, m, place) * (walk.share ?? 1)));
  const mins = tripMins(s, m, place);
  s.busy = { kind: "vuelta", since: at, until: at + mins * MIN, mode: m, place, home, ...(safe ? { safe } : {}), ...(label ? { label } : {}), ...(ok !== undefined ? { ok } : {}) };
  if (!safe) tripEvent(s, m, place, true, at, rng);
}

/* las etapas se reparten entre que llegás y que te volvés */
type Timed = { since: number; until: number; trip?: { go: number; back: number } | null };
const workWindow = (b: Timed) => ({ from: b.since + (b.trip?.go ?? 0), to: b.until - (b.trip?.back ?? 0) });
const stepAt = (b: Timed, n: number, i: number) => {
  const w = workWindow(b);
  return w.from + Math.round((w.to - w.from) * (i + 1) / n);
};
export const missionStepAt = stepAt;
/* cuándo se resuelve lo próximo (para que la pantalla y el bot sepan cuándo volver a mirar) */
export function nextMissionEvent(s: PlayerState): number | null {
  const b = s.busy;
  if (b?.kind !== "mision") return null;
  if (b.trip && !(b.trip.ev & 1)) return b.since + b.trip.go;
  const m = findMission(s, b.id);
  return m && b.done < m.steps.length ? stepAt(b, m.steps.length, b.done) : b.until;
}

/* Resuelve lo que ya pasó: la llegada, las etapas y la vuelta. Devuelve true si cambió algo. */
export function missionCatchUp(s: PlayerState, { now, rng }: { now: number; rng: Rng }): boolean {
  const b = s.busy;
  if (b?.kind === "guardia" && b.trip) return careCatchUp(s, b, now, rng);
  if (b?.kind !== "mision" || b.id.startsWith("coop-")) return false; // las de a dos las resuelve el servidor para los dos
  const m = findMission(s, b.id);
  if (!m) { s.busy = null; return true; }
  let changed = false;
  const t = b.trip;
  if (t && !(t.ev & 1) && now >= b.since + t.go) {
    t.ev |= 1; changed = true;
    log(s, b.since + t.go, `Llegaste a ${t.place} ${TRAVEL[t.mode].verb}.`);
    tripEvent(s, t.mode, t.place, false, b.since + t.go, rng);
  }
  while ((!t || t.ev & 1) && b.done < m.steps.length && now >= stepAt(b, m.steps.length, b.done)) {
    const at = stepAt(b, m.steps.length, b.done);
    const st = m.steps[b.done];
    const ok = resolveStep(s, st, rng);
    if (ok) b.ok++;
    (b.res ??= []).push(ok);
    b.done++;
    changed = true;
    const text = st.fight ? (ok ? st.win : st.lose) : ok ? st.ok : st.ko;
    log(s, at, `«${m.title}» · ${text ?? (ok ? "Salió bien." : "Salió mal.")}`, ok ? undefined : "bad");
  }
  if (b.done >= m.steps.length && now >= b.until) {
    if (t && t.back && !(t.ev & 2)) { t.ev |= 2; tripEvent(s, t.mode, t.place, true, b.until, rng); } // misiones de antes: la vuelta ya estaba incluida
    s.busy = null; recordSide(s, m, b.res ?? [], b.until); finishMission(s, m, b.ok, b.until, rng); changed = true;
    if (t && !t.back) { startReturn(s, t.mode, t.place, b.until, rng, false, `«${m.title}»`, b.ok >= missionNeed(m)); finishBusyLater(s, now); }
  }
  return changed;
}
/* La página de una misión secundaria en la Crónica: cómo salió cada etapa, el desenlace y cuántas veces la intentaste */
function recordSide(s: PlayerState, m: Mission, res: boolean[], at: number) {
  const key = sideKeyOf(m);
  if (!key) return;
  const ok = res.filter(Boolean).length >= missionNeed(m), prev = s.secundarias?.[key];
  const steps = m.steps.map((st, i) => ({ text: st.text, ok: !!res[i],
    said: st.fight ? (res[i] ? st.win : st.lose) : res[i] ? st.ok : st.ko }));
  (s.secundarias ??= {})[key] = { t: at, ok, place: m.place, tries: (prev?.tries ?? 0) + 1, wins: (prev?.wins ?? 0) + (ok ? 1 : 0), steps,
    ...(ok && m.client === "raro" ? { end: RAROS.find(r => r.who === m.who)?.ok } : {}) };
}

/* si ya pasó también la vuelta, se termina en el momento */
function finishBusyLater(s: PlayerState, now: number) {
  const v = s.busy;
  if (v?.kind === "vuelta" && now >= v.until) { s.busy = null; log(s, v.until, "Llegaste a casa."); }
}

/* curarte: ida (caminando o en ambulancia), atención y alta; después volvés a casa */
export const CARE_MINS = { clinica: 2 };
function careCatchUp(s: PlayerState, b: Extract<PlayerState["busy"], { kind: "guardia" }>, now: number, rng: Rng): boolean {
  const t = b.trip!;
  let changed = false;
  if (!(t.ev & 1) && now >= b.since + t.go) {
    t.ev |= 1; changed = true;
    log(s, b.since + t.go, b.clinic ? `La ambulancia llegó a ${t.place}. Te atienden enseguida.` : `Llegaste a la guardia en ${t.place}. A esperar.`);
  }
  if (now >= b.until) {
    s.hp = maxHp(s); s.c.heal++; s.tHeal = b.until; s.busy = null; changed = true;
    log(s, b.until, b.clinic ? "Te dieron el alta en la clínica. Vida al máximo. La ambulancia te lleva a casa." : "Te dieron el alta en la guardia. Vida al máximo. Volvés caminando.", "good");
    startReturn(s, b.clinic ? "ambulancia" : "pie", t.place, b.until, rng, b.clinic, b.clinic ? "la clínica" : "la guardia", true, { free: true });
    finishBusyLater(s, now);
  }
  return changed;
}

/* Chance de que una etapa salga bien, para mostrarla antes de salir (la misma cuenta que usa el servidor).
   Las peleas dependen del rival y del azar de cada golpe: no tienen un número fijo (null). */
export function stepChance(s: Pick<PlayerState, "gear" | "stats">, st: MissionStep): number | null {
  if (st.auto) return 1;
  if (st.fight) return null;
  return clamp(50 + (eff(s, st.stat!) - st.diff!) * 7, 15, 95) / 100;
}
/* el promedio de las etapas con número y cuántas peleas tiene */
export function missionOdds(s: Pick<PlayerState, "gear" | "stats">, m: Mission) {
  const probs = m.steps.filter(st => !st.auto && !st.fight).map(st => stepChance(s, st)!);
  return { avg: probs.length ? probs.reduce((a, b) => a + b, 0) / probs.length : null, fights: m.steps.filter(st => st.fight).length };
}
function resolveStep(s: PlayerState, st: MissionStep, rng: Rng): boolean {
  if (st.auto) return true;
  if (st.fight) {
    const f = battle(rng, playerFighter(s), scaledEnemy(rng, st.fight.name, s.lvl, st.fight.mult));
    s.hp = Math.max(1, f.p.hp);
    return f.won;
  }
  const ok = rng() < stepChance(s, st)!;
  if (!ok && st.dmg) s.hp = Math.max(1, s.hp - Math.round(maxHp(s) * st.dmg));
  return ok;
}

/* Lo que se aprende en la calle: las misiones de la historia siempre dan un punto
   del atributo que más usan; las del tablón, a veces (más cuanto más difíciles); los trabajos largos de 8 horas o más, uno. */
export const STREET_STAT_CHANCE = [0, 0.08, 0.15, 0.3];
export function mainStat(m: Mission): StatKey | undefined {
  const count: Partial<Record<StatKey, number>> = {};
  for (const st of m.steps) if (st.stat) count[st.stat] = (count[st.stat] ?? 0) + 1;
  return (Object.keys(count) as StatKey[]).sort((a, b) => count[b]! - count[a]!)[0];
}
/* regalo de una misión: te lo ponés si el lugar está vacío; si no, al bolso (si entra) */
function givePrize(s: PlayerState, id: string, at: number) {
  const it = SHOP.find(x => x.id === id);
  if (!it || it.slot === "consumible" || s.gear[it.slot] === id || s.inv.includes(id)) return;
  if (!s.gear[it.slot]) s.gear[it.slot] = id;
  else if (s.inv.length < 4 + [0, 2, 4, 8][s.home?.armario ?? 0]) s.inv.push(id);
  else { log(s, at, `Te ganaste ${it.name.toLowerCase()}, pero no te entró en el bolso.`, "bad"); return; }
  log(s, at, `Te llevaste ${it.name.toLowerCase()}: un recuerdo de la misión.`, "gold");
}
function statReward(s: PlayerState, m: Mission, at: number, rng: Rng) {
  const k = mainStat(m);
  if (!k) return;
  const n = m.story ? (m.final ? 2 : [3, 5, 8, 10, 12, 14].includes(m.story) ? 1 : 0) // la historia: algunas misiones enseñan algo
    : m.hours ? (m.hours >= 8 ? 1 : 0)
    : m.street ? (rng() < STREET_STAT_CHANCE[m.difficulty ?? 0] ? 1 : 0)
    : 1;
  if (!n) return;
  s.stats[k] += n;
  if (k === "agu") s.hp += 12 * n;
  log(s, at, `Lo que aprendiste en la calle: +${n} de ${STAT_NAMES[k].toLowerCase()}.`, "good");
}

function finishMission(s: PlayerState, m: Mission, ok: number, at: number, rng: Rng = Math.random) {
  const success = ok >= missionNeed(m);
  if (!success) {
    gainXp(s, at, 5 + s.lvl);
    log(s, at, `«${m.title}» se cayó (${ok} de ${m.steps.length} etapas salieron bien). Podés volver a intentarla.`, "bad");
    if (m.street) s.board = s.board.filter(x => x.id !== m.id);
    return;
  }
  if (m.id === VALIJA.id) { s.c.valija = 1; log(s, at, VALIJA.outro, "gold"); return; }
  const r = m.reward!;
  const gold = Math.round(r.gold * (m.gang ? turfMult(s) : 1)); // los barrios de tu pandilla pagan un poco más
  s.gold += gold; gainXp(s, at, r.xp);
  addRespect(s, at, r.resp);
  const place = missionPlace(m) ?? "";
  /* influencia en el mapa: las de calle en su barrio, las de la historia en el barrio de la pandilla */
  if (m.gang) addInfluence(s, m.gang, place,
    m.street ? [1, 2, 3, 5][m.difficulty ?? 0] : m.arc ? ARC_INFLUENCE[m.chapter ?? 0] : [5, 8, 12][m.tier ?? 0]);
  if (r.heat) addHeat(s, r.heat);
  if (m.street) s.board = s.board.filter(x => x.id !== m.id);
  else s.done[m.id] = true;
  if (m.story) (s.diary ??= {})[m.id] = { t: at, got: ok, of: m.steps.length }; // se destraba su página del diario
  if (m.arc) s.done[arcChapterKey(m.arc, m.chapter ?? 0)] = true;
  news(s, m.client === "raro" ? `${s.name} ayudó a ${m.who} en ${place}.` : m.street ? `${s.name} cumplió un trabajo en ${place}.` : `${s.name} completó «${m.title}».`);
  log(s, at, `${m.street ? "" : `${m.outro} `}«${m.title}» salió bien: ${money(gold)}, +${r.xp} XP, +${r.resp} de respeto${r.heat && r.heat < 0 ? `, ${r.heat} de búsqueda` : ""}.`, "gold");
  if (m.gang) addAff(s, at, m.gang, m.aff ?? MISSION_AFF[m.tier ?? 0]);
  statReward(s, m, at, rng);
  if (m.prize) givePrize(s, m.prize, at);
  /* trabajo sucio: la pandilla perjudicada pierde terreno y te tiene menos simpatía */
  if (m.target) {
    const hurt = POLICE_HURT[m.difficulty ?? 0];
    addInfluence(s, m.target, place, -hurt);
    addAff(s, at, m.target, -Math.min(s.aff[m.target] ?? 0, hurt));
    if (gangOf(s) === m.target || (s.aff[m.target] ?? 0) > 0)
      log(s, at, `En ${GANGS[m.target].name} hay rumores de que alguien le pasa datos a la policía.`, "bad");
  }
}

/* Cortar una misión en curso: se pierde la energía, nada más */
export function abandonMission(s: PlayerState, now: number) {
  const b = s.busy;
  if (b?.kind !== "mision") return;
  const m = findMission(s, b.id);
  s.busy = null;
  log(s, now, `Abandonaste «${m?.title ?? "la misión"}». La energía no vuelve.`, "bad");
}

/* ---------- misiones de calle generadas ---------- */

interface Objective { text: string; stat: StatKey; who?: string; place?: string }
const OBJECTIVES: Record<Gang, Objective[]> = {
  familia: [
    { text: "Cobrar la protección de una pizzería", stat: "lab" }, { text: "Esconder un cargamento en un galpón", stat: "fue" },
    { text: "Convencer a un concejal de mirar para otro lado", stat: "lab" }, { text: "Recuperar una deuda de juego", stat: "dur" },
    { text: "Mover mercadería sin papeles", stat: "ref" }, { text: "Asustar a un testigo", stat: "fue" }
  ],
  sindicato: [
    { text: "Parar una obra en construcción", stat: "fue" }, { text: "Vaciar un camión de carga", stat: "fue" },
    { text: "Apretar a un empresario", stat: "lab" }, { text: "Cortar una calle con un piquete", stat: "dur" },
    { text: "Robar planillas de una oficina", stat: "ref" }, { text: "Convencer a un delegado díscolo", stat: "lab" }
  ],
  barra: [
    { text: "Robar los trapos de la hinchada rival", stat: "ref" }, { text: "Revender entradas truchas", stat: "lab" },
    { text: "Custodiar al presidente del club", stat: "dur" }, { text: "Pintar el barrio con los colores", stat: "ref" },
    { text: "Cobrar el estacionamiento de la cancha", stat: "fue" }, { text: "Bancar la esquina contra los visitantes", stat: "dur" }
  ],
  amarillos: [
    { text: "Llevar un paquete sin preguntas", stat: "ref" }, { text: "Robar un auto importado", stat: "ref" },
    { text: "Correr una picada por la avenida", stat: "ref" }, { text: "Despistar a un patrullero", stat: "lab" },
    { text: "Cambiar patentes en un taller", stat: "fue" }, { text: "Convencer a un remisero de unirse", stat: "lab" }
  ]
};
/* gente de la ciudad que no es de ninguna pandilla: pagan, no suman afinidad ni territorio, dan poco calor */
const VECINOS: Objective[] = [
  { who: "Doña Elsa, la del almacén", text: "Recuperar la jubilación que le robaron a Doña Elsa", stat: "ref" },
  { who: "el Turco del cambio", text: "Cobrarle una deuda a un cliente del Turco", stat: "lab" },
  { who: "un diputado nervioso", text: "Encontrar al perro de un diputado", stat: "ref" },
  { who: "una señora de Recoleta", text: "Sacarle fotos a un marido infiel", stat: "ref" },
  { who: "el cura de la parroquia", text: "Recuperar el cáliz que se llevaron de la iglesia", stat: "fue" },
  { who: "el dueño de la pizzería", text: "Sacar a los patovicas que no dejan trabajar a la pizzería", stat: "fue" },
  { who: "un periodista", text: "Conseguirle un documento a un periodista", stat: "lab" },
  { who: "la directora de la escuela", text: "Hacer guardia en la puerta de la escuela toda la noche", stat: "dur" },
  { who: "un prestamista", text: "Cobrar una cuota atrasada para un prestamista", stat: "dur" },
  { who: "un pibe del barrio", text: "Recuperar la bicicleta de un pibe del barrio", stat: "ref" }
];
/* trabajo sucio para el comisario Funes: baja tu calor, pero perjudica a una pandilla (pierde terreno y simpatía) */
const POLICIA: Objective[] = [
  { text: "Plantar evidencia en un aguantadero de {g}", stat: "ref" },
  { text: "Apretar a un testigo para que cambie su declaración contra {g}", stat: "lab" },
  { text: "Hacer desaparecer una caja de pruebas que compromete a Funes", stat: "ref" },
  { text: "Marcar el escondite de {g} para el allanamiento", stat: "ref" },
  { text: "Cobrar la coima semanal de un local de {g}", stat: "fue" },
  { text: "Llevarle un sobre a un juez de parte de Funes", stat: "lab" },
  { text: "Bancarte un interrogatorio falso para que te crean de {g}", stat: "dur" }
];
export const POLICE_HURT = [2, 4, 6, 10];   // influencia y afinidad que pierde la pandilla perjudicada
export const POLICE_LVL = 5;                // desde este nivel Funes te ofrece trabajo
export const VECINOS_COLOR = "#c9a27a", POLICE_COLOR = "#cfd6e2", PROP_COLOR = "#b98be0";

/* quién encarga una misión, para mostrar */
export function clientOf(m: Mission): { name: string; color: string } {
  if (m.client === "policia") return { name: "La 4ª (Funes)", color: POLICE_COLOR };
  if (m.client === "vecinos") return { name: "Vecinos", color: VECINOS_COLOR };
  if (m.client === "raro") return { name: m.who ? m.who[0].toUpperCase() + m.who.slice(1) : "Alguien raro", color: ODD_COLOR };
  const p = m.client ? propOf(m.client) : undefined;
  if (p) return { name: p.name, color: PROP_COLOR };
  return m.gang ? { name: GANGS[m.gang].name, color: GANGS[m.gang].color } : { name: "Marga", color: "var(--sodium)" };
}

const STEPS: Record<"lab" | "fue" | "ref" | "dur", { text: string; ok: string; ko: string }[]> = {
  lab: [
    { text: "Convencer al encargado de que te deje pasar", ok: "El encargado te abrió la puerta y hasta te ofreció un café.", ko: "El encargado no te creyó una palabra." },
    { text: "Sacarle información a un mozo del barrio", ok: "El mozo te contó todo por una propina.", ko: "El mozo se hizo el sordo." },
    { text: "Negociar con un puntero del barrio", ok: "Arreglaste por la mitad de lo que pedía.", ko: "El puntero te mandó a pasear." }
  ],
  fue: [
    { text: "Forzar la persiana del depósito", ok: "La persiana cedió con un ruido seco.", ko: "La persiana no se movió y te doblaste la muñeca." },
    { text: "Cargar las cajas antes de que vuelva el dueño", ok: "Cargaste todo en tiempo récord.", ko: "Se te cayó una caja en el pie." },
    { text: "Sacar a la fuerza a un patovica de la puerta", ok: "El patovica terminó sentado en la vereda.", ko: "El patovica ni se movió." }
  ],
  ref: [
    { text: "Salir antes de que llegue la policía", ok: "Doblaste la esquina justo cuando llegaba el patrullero.", ko: "Te vieron salir y te persiguieron tres cuadras." },
    { text: "Esquivar las cámaras de la avenida", ok: "Ninguna cámara te tomó la cara.", ko: "Saliste de frente en una cámara." },
    { text: "Cruzar los techos hasta el otro lado de la manzana", ok: "Saltaste de techo en techo sin un ruido.", ko: "Pisaste una chapa floja y te caíste al patio." }
  ],
  dur: [
    { text: "Aguantar el interrogatorio de los custodios", ok: "No soltaste nada.", ko: "Te dieron una paliza para que hables." },
    { text: "Esperar toda la noche bajo la lluvia", ok: "Aguantaste hasta que apareció el objetivo.", ko: "Te agarraste un resfrío y casi te dormís." },
    { text: "Bancarte la golpiza para no delatar a nadie", ok: "Te pegaron, pero no hablaste.", ko: "Te pegaron fuerte." }
  ]
};
export const STREET_DIFF = [
  { name: "Fácil",   f: 0.75, req: 0.55, mins: 8,  energy: 4,  pay: 1.0,  resp: 2,  heat: 3,  aff: 2, fight: 0.8 },
  { name: "Normal",  f: 0.9,  req: 0.7,  mins: 15, energy: 6,  pay: 1.15, resp: 4,  heat: 5,  aff: 3, fight: 0.9 },
  { name: "Difícil", f: 0.98, req: 0.85, mins: 25, energy: 8,  pay: 1.3,  resp: 7,  heat: 8,  aff: 5, fight: 0.95 },
  { name: "Jodida",  f: 1.1,  req: 1.0,  mins: 40, energy: 10, pay: 1.5,  resp: 12, heat: 12, aff: 8, fight: 1.05 }
];

export type StreetClient = Gang | "vecinos" | "policia" | PropId;
/* Arma una misión de calle para tu nivel: de una pandilla, de un vecino, de la policía o de uno de tus negocios */
export function streetMission(rng: Rng, lvl: number, d: number, client: StreetClient, id: string, mine: Gang | null = null): Mission {
  const D = STREET_DIFF[d];
  const typ = Math.max(5, 0.5 + lvl * 1.4);
  const diff = Math.round(typ * D.f);
  const gang = (GANG_KEYS as string[]).includes(client) ? client as Gang : undefined;
  const prop = propOf(client);
  const target = client === "policia" ? pick(rng, GANG_KEYS.filter(g => g !== mine)) : undefined;
  const obj: Objective = gang ? pick(rng, OBJECTIVES[gang]) : client === "vecinos" ? pick(rng, VECINOS)
    : client === "policia" ? pick(rng, POLICIA) : pick(rng, PROP_OBJECTIVES[client as PropId]);
  const place = obj.place ?? (prop && rng() < 0.5 ? prop.place : pick(rng, BARRIOS));
  const far = !!obj.place && !BARRIOS.includes(obj.place);
  const other = pick(rng, (["lab", "fue", "ref", "dur"] as const).filter(k => k !== obj.stat));
  const main = pick(rng, STEPS[obj.stat as keyof typeof STEPS]), second = pick(rng, STEPS[other]);
  const foeGang = target ?? pick(rng, GANG_KEYS.filter(g => g !== gang));
  const foe = !target && rng() < 0.3 ? pick(rng, POLICE_NAMES) : pick(rng, GANG_MEMBERS[foeGang]);
  const back = gang ? GANGS[gang].boss : client === "vecinos" ? obj.who! : client === "policia" ? COMISARIO : prop!.who;
  const per = D.energy / 4;
  const steps: MissionStep[] = [
    { text: main.text, stat: obj.stat, diff, energy: per, dmg: 0.08, ok: main.ok, ko: main.ko },
    { text: second.text, stat: other, diff: Math.round(diff * 0.95), energy: per, dmg: 0.08, ok: second.ok, ko: second.ko },
    { text: `${foe} te sale al cruce`, fight: { name: foe, mult: D.fight }, energy: per,
      win: `${foe} terminó en el piso.`, lose: `${foe} te dio una paliza.` },
    { text: prop ? `Volver a ${back}` : `Volver con ${back}`, energy: per, auto: true,
      ok: client === "policia" ? "Funes guarda el sobre sin contarlo." : prop ? `En ${back} todo sigue en orden.` : `${back[0].toUpperCase()}${back.slice(1)} cuenta la plata y asiente.` }
  ];
  /* lo que paga cada cliente: los vecinos dan más experiencia y menos calor; Funes te baja el calor; los negocios pagan más lejos */
  const pay = D.energy * (10 + 2.4 * lvl) * D.pay, xp = D.energy * (3 + 0.55 * lvl) * D.pay;
  const reward =
    client === "vecinos" ? { gold: Math.round(pay), xp: Math.round(xp * 1.15), resp: Math.ceil(D.resp / 2), heat: Math.ceil(D.heat / 2) } :
    client === "policia" ? { gold: Math.round(pay * 0.9), xp: Math.round(xp), resp: Math.ceil(D.resp * 0.7), heat: -D.heat * 2 } :
    prop ? { gold: Math.round(pay * (far ? 1.6 : 1.1)), xp: Math.round(xp * (far ? 1.3 : 1)), resp: D.resp, heat: D.heat } :
    { gold: Math.round(pay), xp: Math.round(xp), resp: D.resp, heat: D.heat };
  const text = target ? obj.text.replace("{g}", GANGS[target].name) : obj.text;
  return {
    id, street: true, gang, client: gang ? undefined : client, target, difficulty: d, rank: 0, mins: D.mins, place,
    ...(client === "vecinos" ? { sideKey: `vecino-${VECINOS.indexOf(obj)}` } : {}),
    title: obj.place ? text : `${text} en ${place}`,
    intro: obj.who ? `Te lo pide ${obj.who}.` : target ? `Funes te ofrece un trabajo sucio contra ${GANGS[target].name}.` : "",
    steps, outro: "",
    req: { [obj.stat]: Math.max(5, Math.round(typ * D.req)) },
    aff: gang ? D.aff : 0,
    reward
  };
}

/* ---------- trabajos largos (turnos de horas) ---------- */
/* Turnos de horas (para cuando no vas a estar): pagan menos por hora que jugar activo, pero mucho por energía.
   Mientras tanto la energía se sigue cargando hasta el tope. */
export const LONG_HOURS = [2, 4, 8, 12];
export const LONG_ENERGY: Record<number, number> = { 2: 6, 4: 8, 8: 10, 12: 12 };
const LONG: Objective[] = [
  { text: "Custodiar un cargamento en los diques de Puerto Madero", stat: "dur", place: "Puerto Madero" },
  { text: "Vigilar una mansión de Recoleta toda la noche", stat: "ref", place: "Recoleta" },
  { text: "Llevar autos robados a un garaje de Villa Devoto", stat: "ref", place: "Villa Devoto" },
  { text: "Trabajar de patovica en una fiesta de Palermo", stat: "fue", place: "Palermo" },
  { text: "Cuidar un depósito de mercadería robada en La Paternal", stat: "dur", place: "La Paternal" },
  { text: "Hacer el turno noche en un taller de Villa Luro", stat: "fue", place: "Villa Luro" },
  { text: "Cobrar en todos los puestos de la feria de Flores", stat: "lab", place: "Flores" },
  { text: "Seguir a un concejal por todo Belgrano", stat: "ref", place: "Belgrano" },
  { text: "Descargar camiones sin papeles en la terminal de Retiro", stat: "fue", place: "Retiro" },
  { text: "Custodiar una fiesta clandestina en Villa Crespo", stat: "dur", place: "Villa Crespo" },
  { text: "Esconder un cargamento en un galpón de Chacarita", stat: "lab", place: "Chacarita" },
  { text: "Recorrer los talleres de Villa Urquiza cobrando deudas", stat: "lab", place: "Villa Urquiza" }
];
export function longMission(rng: Rng, lvl: number, hours: number, id: string): Mission {
  const gang = pick(rng, GANG_KEYS);
  const obj = pick(rng, LONG);
  const zone = GEO_PLACES[obj.place!]?.zone;
  const typ = Math.max(5, 0.5 + lvl * 1.4), diff = Math.round(typ * 0.85);
  const stats = (["lab", "fue", "ref", "dur"] as const);
  const order = [obj.stat as keyof typeof STEPS, pick(rng, stats.filter(k => k !== obj.stat)), obj.stat as keyof typeof STEPS, pick(rng, [...stats])];
  const used = new Set<string>();
  const check = (k: keyof typeof STEPS): MissionStep => {
    const opts = STEPS[k].filter(x => !used.has(x.text));
    const st = pick(rng, opts.length ? opts : STEPS[k]); used.add(st.text);
    return { text: st.text, stat: k, diff, energy: 0, dmg: 0.06, ok: st.ok, ko: st.ko };
  };
  const foe = pick(rng, GANG_MEMBERS[pick(rng, GANG_KEYS.filter(g => g !== gang))]);
  const steps: MissionStep[] = [check(order[0]), check(order[1]),
    { text: `${foe} y los suyos aparecen de madrugada`, fight: { name: foe, mult: 0.9 }, energy: 0, win: `${foe} se fue por donde vino.`, lose: `${foe} te dio una paliza y se llevó algo.` },
    check(order[2]), check(order[3]),
    { text: `Volver con ${GANGS[gang].boss}`, energy: 0, auto: true, ok: `${GANGS[gang].boss} te paga el turno completo.` }];
  const energy = LONG_ENERGY[hours] ?? 10;
  steps.forEach(st => { st.energy = energy / steps.length; });
  const units = 6 + 3 * hours; // lo que paga, medido en "energía de misión"
  return {
    id, street: true, gang, hours, rank: 0, mins: hours * 60, place: obj.place, difficulty: 1,
    title: `${obj.text} (turno de ${hours} h)`, intro: `${GANGS[gang].name} te manda a ${obj.place}${zone ? ` (${ZONE_NAMES[zone]})` : ""}. Turno de ${hours} horas.`,
    steps, outro: "",
    req: { [obj.stat]: Math.max(5, Math.round(typ * 0.7)) },
    aff: hours,
    reward: { gold: Math.round((10 + 2.4 * lvl) * units), xp: Math.round((3 + 0.55 * lvl) * units), resp: 2 * hours, heat: Math.min(14, hours + 2) }
  };
}

/* ---------- encuentros raros ---------- */
/* Gente extraña que aparece un rato en algún barrio y te pide algo. Duran poco: si no vas, se van. */
type OddStep = [StatKey, string, string, string]; // atributo, qué hacés, si sale bien, si sale mal
const RAROS: { who: string; text: string; steps: [OddStep, OddStep]; ok: string }[] = [
  { who: "un hombre disfrazado de murciélago", text: "Recuperar la murcimoto (una 110 robada)", ok: "El hombre murciélago se sube a la 110 y se va sin decir gracias, como corresponde.",
    steps: [["ref", "Seguir por los techos al pibe que se la llevó", "Lo alcanzaste en la tercera terraza.", "Te quedaste colgado de una antena."],
            ["fue", "Recuperar la moto sin rayarla", "La moto vuelve impecable.", "Le dejaste un rayón del largo de una cuadra."]] },
  { who: "una vidente de la feria", text: "Encontrar el gato que vio en su bola de cristal", ok: "La vidente te lee la mano gratis. Dice que vas a ser rico. Ya veremos.",
    steps: [["lab", "Preguntarle a los vecinos por un gato negro con un ojo verde", "Una vecina lo vio en un baldío.", "Nadie vio nada. O no te quieren decir."],
            ["ref", "Agarrar al gato sin que te arañe", "El gato se dejó agarrar como si te conociera.", "El gato te dejó la cara como un mapa."]] },
  { who: "un turista perdido", text: "Mostrarle «el tango de verdad» a un turista", ok: "El turista te paga en dólares y te pide una selfie.",
    steps: [["lab", "Convencerlo de no comprar un mate de ochenta dólares", "Le conseguiste uno a precio de barrio.", "Lo compró igual. Y dos bombillas."],
            ["dur", "Bancarte tres horas de milonga", "Bailaste hasta con la dueña del lugar.", "Te pisaron tanto que volvés rengo."]] },
  { who: "una señora con catorce gatos", text: "Cuidarle los gatos mientras va al bingo", ok: "La señora ganó el bingo y te da una parte del pozo.",
    steps: [["dur", "Sobrevivir a catorce gatos con hambre", "Los gatos te aceptaron como uno más.", "Los gatos te declararon la guerra."],
            ["lab", "Convencer a la veterinaria de fiarte el alimento", "La veterinaria te fía hasta el lunes.", "La veterinaria no fía. Nunca."]] },
  { who: "un mago callejero", text: "Ser el asistente de un mago en la peatonal", ok: "El mago reparte la gorra con vos. Saca una paloma de tu bolsillo, de regalo.",
    steps: [["ref", "Esconder la paloma antes de que la vea el público", "Nadie vio la paloma. Aplausos.", "La paloma se escapó en medio del truco."],
            ["dur", "Dejarte serruchar al medio (casi)", "Saliste entero y saludaste.", "Casi no es tan casi."]] },
  { who: "un payaso con resaca", text: "Reemplazar a un payaso en un cumpleaños de quince chicos", ok: "La madre del cumpleañero te paga y te da torta para llevar.",
    steps: [["lab", "Hacer reír a quince chicos de siete años", "Se rieron hasta los padres.", "Un nene te dijo que eras el peor payaso del mundo."],
            ["dur", "Aguantar los globos de agua", "Terminaste empapado pero sonriente.", "Te emboscaron en el patio."]] },
  { who: "un repartidor de pizza en pánico", text: "Entregar doce pizzas antes de que se enfríen", ok: "El repartidor te da la propina de todas y una grande de muzza.",
    steps: [["ref", "Cruzar la avenida con doce pizzas", "Llegaron calientes, como recién salidas.", "Llegaron. La de fugazzeta, no."],
            ["lab", "Convencer al cliente de que la de anchoas era así", "El cliente comió y pidió otra.", "El cliente pidió hablar con el encargado."]] },
  { who: "un hombre que dice venir del futuro", text: "Evitar que alguien compre un billete de lotería", ok: "El del futuro te agradece y se desvanece detrás de un colectivo. Te deja un sobre.",
    steps: [["lab", "Convencer al lotero de que no venda el 4815", "El lotero guardó el billete en un cajón.", "El lotero lo vendió en tu cara."],
            ["ref", "Llegar antes del sorteo", "Llegaste con un minuto de sobra.", "Llegaste tarde. El futuro ya cambió."]] },
  { who: "un conspiranoico con gorro de aluminio", text: "Apagar una antena 5G que no existe", ok: "El del gorro te regala uno igual. Por las dudas.",
    steps: [["fue", "Trepar a la terraza del edificio", "Llegaste arriba. No hay ninguna antena.", "La escalera estaba podrida."],
            ["lab", "Explicarle al encargado qué hacés en la terraza", "El encargado te creyó. Y también se puso un gorro.", "El encargado llamó a la policía."]] },
  { who: "una abuela que quiere tatuarse", text: "Acompañar a una abuela al tatuador sin que se entere el hijo", ok: "La abuela sale con un ancla en el brazo y te invita a tomar el té.",
    steps: [["lab", "Convencer al tatuador de que sí, es mayor de edad", "El tatuador se rió y agarró la máquina.", "El tatuador pidió autorización de los padres."],
            ["ref", "Esquivar al hijo, que la está buscando", "El hijo pasó por al lado y no los vio.", "El hijo los encontró y te echó la culpa."]] },
  { who: "una estatua viviente", text: "Cubrir a una estatua viviente mientras va al baño", ok: "La estatua te da la mitad de las monedas del sombrero.",
    steps: [["dur", "Quedarte quieto media hora", "Ni un parpadeo. Una nena te dejó un caramelo.", "Te picó la nariz y se rompió el hechizo."],
            ["ref", "No reírte cuando un nene te pica la panza", "Ni una mueca. Profesional.", "Te reíste. El público pidió la plata de vuelta."]] },
  { who: "un taxista que vio un OVNI", text: "Ir a ver unas luces raras sobre el río", ok: "Las luces eran un dron de una boda. El taxista te paga igual, por las dudas.",
    steps: [["ref", "Llegar a la costanera antes de que se vayan las luces", "Llegaste y las viste. Son raras de verdad.", "Llegaste y no había nada. Ni el taxista."],
            ["lab", "Convencer a la Prefectura de que no estás borracho", "Los de Prefectura también miran el cielo.", "Te hicieron soplar el alcoholímetro dos veces."]] },
  { who: "un hombre vestido de dinosaurio", text: "Recuperar la cabeza de un disfraz de dinosaurio", ok: "El dinosaurio vuelve a estar completo. Te abraza con sus bracitos cortos.",
    steps: [["fue", "Sacársela a un borracho que la tiene puesta", "El borracho se la sacó y se puso a llorar.", "El borracho rugió y te mordió."],
            ["ref", "Escapar del patovica del boliche", "Saliste por la cocina.", "El patovica te sacó por la puerta grande."]] },
  { who: "un perro con una nota en el collar", text: "Llevar a un perro a la dirección de la nota", ok: "La dueña llora de alegría y te da una recompensa que tenía guardada.",
    steps: [["ref", "Seguir al perro, que se escapa cada dos cuadras", "Lo seguiste hasta la puerta.", "El perro te hizo recorrer medio barrio."],
            ["lab", "Convencer a la dueña de que no lo robaste vos", "La dueña te creyó al toque.", "La dueña llamó a la vecina, a la policía y a la radio."]] }
]
export const ODD_COLOR = "#ff8cc6";

/* El catálogo de misiones secundarias de la Crónica: cada encuentro raro y cada pedido de los vecinos, en orden fijo */
export interface SideQuest { key: string; kind: "raro" | "vecino"; who: string; text: string }
export const SIDE_QUESTS: SideQuest[] = [
  ...RAROS.map((r, i) => ({ key: `raro-${i}`, kind: "raro" as const, who: r.who, text: r.text })),
  ...VECINOS.map((v, i) => ({ key: `vecino-${i}`, kind: "vecino" as const, who: v.who!, text: v.text }))
];
/* las misiones de antes no guardaban su lugar en el catálogo: los raros se reconocen por quién los pide y los vecinos por el título */
function sideKeyOf(m: Mission) {
  if (m.sideKey) return m.sideKey;
  const i = m.client === "raro" ? RAROS.findIndex(r => r.who === m.who) : m.client === "vecinos" ? VECINOS.findIndex(v => m.title.startsWith(v.text)) : -1;
  return i < 0 ? undefined : `${m.client === "raro" ? "raro" : "vecino"}-${i}`;
}
export const ODD_EVERY = 75 * MIN, ODD_MAX = 2;          // uno nuevo cada tanto, como mucho dos a la vez
export function oddMission(rng: Rng, lvl: number, now: number, id: string): Mission {
  const r = pick(rng, RAROS), place = pick(rng, BARRIOS);
  const typ = Math.max(5, 0.5 + lvl * 1.4), diff = Math.round(typ * 0.8), units = 6;
  const steps: MissionStep[] = r.steps.map(([stat, text, ok, ko]) => ({ text, stat, diff, energy: units / 3, dmg: 0.05, ok, ko }));
  steps.push({ text: `Volver con ${r.who}`, energy: units / 3, auto: true, ok: r.ok });
  return {
    id, street: true, client: "raro", who: r.who, sideKey: `raro-${RAROS.indexOf(r)}`, difficulty: 1, rank: 0, mins: 10, place,
    title: `${r.text} en ${place}`, intro: `Te lo pide ${r.who}. Está un rato nomás: si no vas, se va.`,
    steps, outro: "", req: { [r.steps[0][0]]: Math.max(5, Math.round(typ * 0.6)) }, aff: 0,
    until: now + rnd(rng, 60, 150) * MIN,
    reward: { gold: Math.round(units * (10 + 2.4 * lvl) * 1.2), xp: Math.round(units * (3 + 0.55 * lvl) * 1.5), resp: 2, heat: 0 }
  };
}

/* El tablón: una misión de cada dificultad de pandillas al azar, una de algún vecino, una de la policía
   (desde nivel 5), hasta dos de tus negocios y cuatro trabajos largos en el conurbano (2, 4, 8 y 12 horas) */
export function newBoard(s: PlayerState, rng: Rng, now: number) {
  const id = (k: string | number) => `calle-${now.toString(36)}-${k}-${rnd(rng, 0, 9999)}`;
  const mine = gangOf(s);
  s.board = STREET_DIFF.map((_, d) => streetMission(rng, s.lvl, d, pick(rng, GANG_KEYS), id(d), mine));
  s.board.push(streetMission(rng, s.lvl, rnd(rng, 0, 2), "vecinos", id("v"), mine));
  if (s.lvl >= POLICE_LVL) s.board.push(streetMission(rng, s.lvl, rnd(rng, 1, 3), "policia", id("p"), mine));
  const owned = Object.keys(s.props ?? {}).filter(k => propOf(k)) as PropId[];
  for (let k = 0; k < 2 && owned.length; k++) {
    const p = owned.splice(rnd(rng, 0, owned.length - 1), 1)[0];
    s.board.push(streetMission(rng, s.lvl, rnd(rng, 1, 3), p, id(p), mine));
  }
  for (const h of LONG_HOURS) s.board.push(longMission(rng, s.lvl, h, id(`l${h}`)));
  /* una urgente: paga más, pero dura dos horas */
  const u = s.board.find(m => m.gang && !m.hours && (m.difficulty ?? 0) >= 1);
  if (u?.reward) { u.until = now + 120 * MIN; u.title = `Urgente: ${u.title}`; u.reward.gold = Math.round(u.reward.gold * 1.4); u.reward.xp = Math.round(u.reward.xp * 1.3); }
  s.tBoard = now;
}
/* Se renueva cada 6 horas (o cuando se vacía), solo después del tutorial y si no estás en una de sus misiones */
export function boardCatchUp(s: PlayerState, { now, rng }: { now: number; rng: Rng }): boolean {
  if (!s.tutDone) return false;
  const b = s.busy;
  if (b?.kind === "mision" && s.board?.some(m => m.id === b.id)) return false;
  let changed = false;
  if (!s.board?.length || now - (s.tBoard ?? 0) >= BOARD_EVERY) { newBoard(s, rng, now); changed = true; }
  /* las temporales que pasaron su hora se van (salvo la que estás haciendo) */
  const live = s.board.filter(m => !m.until || m.until > now || (b?.kind === "mision" && b.id === m.id));
  if (live.length !== s.board.length) { s.board = live; changed = true; }
  /* encuentros raros: aparece uno cada tanto */
  if (now - (s.tOdd ?? 0) >= ODD_EVERY && s.board.filter(m => m.client === "raro").length < ODD_MAX) {
    s.board.push(oddMission(rng, s.lvl, now, `raro-${now.toString(36)}-${rnd(rng, 0, 9999)}`));
    s.tOdd = now; changed = true;
  }
  return changed;
}
