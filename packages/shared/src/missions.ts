/* Misiones a tiempo humano: al empezar, tu personaje sale a hacerla; cada etapa se resuelve sola a su hora y la crónica
   cuenta lo que pasó. Las resuelve el servidor (y el bot de balance): la pantalla solo muestra el avance.
   Además, el tablón de misiones de calle generadas a tu nivel. */
import { ARC_INFLUENCE, ARC_MISSIONS, arcChapterKey, COMISARIO } from "./arcs.js";
import { VALIJA } from "./data.js";
import { GANG_KEYS, GANG_MEMBERS, GANGS, MISSION_AFF, MISSIONS, POLICE_NAMES } from "./gangs.js";
import { routeTo, TRAVEL, tripCost, tripEvent, tripMins, tripText, type TravelMode } from "./geo.js";
import { PROP_OBJECTIVES, propOf, type PropId } from "./negocios.js";
import { addAff, addHeat, addRespect, battle, clamp, gainXp, gangOf, log, maxHp, money, pick, playerFighter, rnd, scaledEnemy } from "./rules.js";
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
export const allStory = (): Mission[] => [VALIJA, ...GANG_KEYS.flatMap(g => MISSIONS[g]), ...ARC_MISSIONS];
export const findMission = (s: Pick<PlayerState, "board" | "coop">, id: string) =>
  allStory().find(m => m.id === id) ?? s.board?.find(m => m.id === id) ?? (s.coop?.mission.id === id ? s.coop.mission : undefined);
/* dónde pasa: las de la historia de cada pandilla, en su barrio. La valija y las de a dos no tienen viaje. */
export const missionPlace = (m: Mission): string | undefined =>
  m.id === VALIJA.id || m.id.startsWith("coop-") ? undefined : m.place ?? (m.gang ? HOME_BARRIO[m.gang] : undefined);
export const needsTrip = (m: Mission) => !!routeTo(missionPlace(m));
/* minutos de trabajo en el lugar (sin contar el viaje) */
export const missionMins = (m: Mission) => m.mins ?? (m.id === VALIJA.id ? VALIJA_MINS : STORY_MINS[m.tier ?? 0]);
export const missionEnergy = (m: Mission) => m.steps.reduce((a, st) => a + st.energy, 0);
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
  (Object.entries(missionReq(m)) as [StatKey, number][]).every(([k, v]) => s.stats[k] >= v);

/* ---------- empezar, avanzar, terminar ---------- */
export function startTimedMission(s: PlayerState, m: Mission, now: number, mode?: TravelMode, rng: Rng = Math.random) {
  const place = missionPlace(m);
  const go = mode && place && routeTo(place) ? tripMins(s, mode, place) * MIN : 0;
  const work = missionMins(m) * MIN;
  s.energy -= missionEnergy(m);
  if (go && mode && place) s.gold -= tripCost(s, mode, place);
  s.busy = { kind: "mision", id: m.id, since: now, until: now + go * 2 + work, done: 0, ok: 0, res: [],
    trip: go && mode && place ? { mode, place, go, back: go, ev: 0 } : null };
  const total = Math.round((go * 2 + work) / MIN);
  log(s, now, go && mode && place
    ? `Saliste a hacer «${m.title}». ${tripText(s, mode, place, rng)} Volvés en ${total} min.`
    : `Saliste a hacer «${m.title}». Volvés en ${total} min.`, "gold");
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
    if (t && !(t.ev & 2)) { t.ev |= 2; tripEvent(s, t.mode, t.place, true, b.until, rng); }
    s.busy = null; finishMission(s, m, b.ok, b.until); changed = true;
  }
  return changed;
}

function resolveStep(s: PlayerState, st: MissionStep, rng: Rng): boolean {
  if (st.auto) return true;
  if (st.fight) {
    const f = battle(rng, playerFighter(s), scaledEnemy(rng, st.fight.name, s.lvl, st.fight.mult));
    s.hp = Math.max(1, f.p.hp);
    return f.won;
  }
  const ok = rng() * 100 < clamp(50 + (s.stats[st.stat!] - st.diff!) * 7, 15, 95);
  if (!ok && st.dmg) s.hp = Math.max(1, s.hp - Math.round(maxHp(s) * st.dmg));
  return ok;
}

function finishMission(s: PlayerState, m: Mission, ok: number, at: number) {
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
  if (m.arc) s.done[arcChapterKey(m.arc, m.chapter ?? 0)] = true;
  log(s, at, `${m.street ? "" : `${m.outro} `}«${m.title}» salió bien: ${money(gold)}, +${r.xp} XP, +${r.resp} de respeto${r.heat && r.heat < 0 ? `, ${r.heat} de calor` : ""}.`, "gold");
  if (m.gang) addAff(s, at, m.gang, m.aff ?? MISSION_AFF[m.tier ?? 0]);
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
  { who: "una señora de Recoleta Bien", text: "Sacarle fotos a un marido infiel", stat: "ref" },
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
    title: obj.place ? text : `${text} en ${place}`,
    intro: obj.who ? `Te lo pide ${obj.who}.` : target ? `Funes te ofrece un trabajo sucio contra ${GANGS[target].name}.` : "",
    steps, outro: "",
    req: { [obj.stat]: Math.max(5, Math.round(typ * D.req)) },
    aff: gang ? D.aff : 0,
    reward
  };
}

/* El tablón: una misión de cada dificultad de pandillas al azar, una de algún vecino, una de la policía
   (desde nivel 5) y hasta dos de tus negocios */
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
  s.tBoard = now;
}
/* Se renueva cada 6 horas (o cuando se vacía), solo después del tutorial y si no estás en una de sus misiones */
export function boardCatchUp(s: PlayerState, { now, rng }: { now: number; rng: Rng }): boolean {
  if (!s.tutDone) return false;
  const b = s.busy;
  if (b?.kind === "mision" && s.board?.some(m => m.id === b.id)) return false;
  if (!s.board?.length || now - (s.tBoard ?? 0) >= BOARD_EVERY) { newBoard(s, rng, now); return true; }
  return false;
}
