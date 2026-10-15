/* Misiones a tiempo humano: al empezar, tu personaje sale a hacerla; cada etapa se resuelve sola a su hora y la crónica
   cuenta lo que pasó. Las resuelve el servidor (y el bot de balance): la pantalla solo muestra el avance.
   Además, el tablón de misiones de calle generadas a tu nivel. */
import { VALIJA } from "./data.js";
import { GANG_KEYS, GANG_MEMBERS, GANGS, MISSION_AFF, MISSIONS, POLICE_NAMES } from "./gangs.js";
import { addAff, addHeat, addRespect, battle, clamp, gainXp, log, maxHp, money, pick, playerFighter, rnd, scaledEnemy } from "./rules.js";
import { addInfluence, BARRIOS, HOME_BARRIO, turfMult } from "./territory.js";
import type { Gang, Mission, MissionStep, PlayerState, Rng, StatKey } from "./types.js";

const MIN = 60_000;
export const VALIJA_MINS = 30;
export const STORY_MINS = [20, 40, 60];           // misiones de pandilla: 1ª, 2ª y 3ª del hilo
const STORY_REQ = [[7, 6], [10, 9], [16, 15]];      // atributos mínimos para empezarlas
export const BOARD_SIZE = 4;
export const BOARD_EVERY = 6 * 60 * MIN;            // el tablón de la calle se renueva cada 6 horas
export const BOARD_REROLL_COST = 2;                 // o pagando energía

/* ---------- datos de cada misión ---------- */
export const allStory = (): Mission[] => [VALIJA, ...GANG_KEYS.flatMap(g => MISSIONS[g])];
export const findMission = (s: Pick<PlayerState, "board" | "coop">, id: string) =>
  allStory().find(m => m.id === id) ?? s.board?.find(m => m.id === id) ?? (s.coop?.mission.id === id ? s.coop.mission : undefined);
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
export function startTimedMission(s: PlayerState, m: Mission, now: number) {
  const until = now + missionMins(m) * MIN;
  s.energy -= missionEnergy(m);
  s.busy = { kind: "mision", id: m.id, since: now, until, done: 0, ok: 0, res: [] };
  log(s, now, `Saliste a hacer «${m.title}». Volvés en ${missionMins(m)} min.`, "gold");
}

const stepAt = (b: { since: number; until: number }, n: number, i: number) => b.since + Math.round((b.until - b.since) * (i + 1) / n);
/* cuándo se resuelve lo próximo (para que la pantalla y el bot sepan cuándo volver a mirar) */
export function nextMissionEvent(s: PlayerState): number | null {
  const b = s.busy;
  if (b?.kind !== "mision") return null;
  const m = findMission(s, b.id);
  return m ? stepAt(b, m.steps.length, b.done) : b.until;
}

/* Resuelve las etapas que ya pasaron. Devuelve true si cambió algo. */
export function missionCatchUp(s: PlayerState, { now, rng }: { now: number; rng: Rng }): boolean {
  const b = s.busy;
  if (b?.kind !== "mision" || b.id.startsWith("coop-")) return false; // las de a dos las resuelve el servidor para los dos
  const m = findMission(s, b.id);
  if (!m) { s.busy = null; return true; }
  let changed = false;
  while (b.done < m.steps.length && now >= stepAt(b, m.steps.length, b.done)) {
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
  if (b.done >= m.steps.length) { s.busy = null; finishMission(s, m, b.ok, b.until); changed = true; }
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
  const gold = Math.round(r.gold * turfMult(s)); // los barrios de tu pandilla pagan un poco más
  s.gold += gold; gainXp(s, at, r.xp);
  addRespect(s, at, r.resp);
  /* influencia en el mapa: las de calle en su barrio, las de la historia en el barrio de la pandilla */
  if (m.gang) addInfluence(s, m.gang, m.place ?? HOME_BARRIO[m.gang], m.street ? [1, 2, 3, 5][m.difficulty ?? 0] : [5, 8, 12][m.tier ?? 0]);
  if (r.heat) addHeat(s, r.heat);
  if (m.street) s.board = s.board.filter(x => x.id !== m.id);
  else s.done[m.id] = true;
  log(s, at, `${m.street ? "" : `${m.outro} `}«${m.title}» salió bien: ${money(gold)}, +${r.xp} XP, +${r.resp} de respeto.`, "gold");
  if (m.gang) addAff(s, at, m.gang, m.aff ?? MISSION_AFF[m.tier ?? 0]);
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

interface Objective { text: string; stat: StatKey }
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
  { name: "Fácil",   f: 0.75, req: 0.55, mins: 10, energy: 4,  pay: 1.0,  resp: 2,  heat: 3,  aff: 2, fight: 0.8 },
  { name: "Normal",  f: 0.9,  req: 0.7,  mins: 20, energy: 6,  pay: 1.15, resp: 4,  heat: 5,  aff: 3, fight: 0.9 },
  { name: "Difícil", f: 0.98, req: 0.85, mins: 35, energy: 8,  pay: 1.3,  resp: 7,  heat: 8,  aff: 5, fight: 0.95 },
  { name: "Jodida",  f: 1.1,  req: 1.0,  mins: 50, energy: 10, pay: 1.5,  resp: 12, heat: 12, aff: 8, fight: 1.05 }
];

/* Arma una misión de calle para tu nivel, de una dificultad y una pandilla */
export function streetMission(rng: Rng, lvl: number, d: number, gang: Gang, id: string): Mission {
  const D = STREET_DIFF[d];
  const typ = Math.max(5, 0.5 + lvl * 1.4);
  const diff = Math.round(typ * D.f);
  const obj = pick(rng, OBJECTIVES[gang]);
  const place = pick(rng, BARRIOS);
  const other = pick(rng, (["lab", "fue", "ref", "dur"] as const).filter(k => k !== obj.stat));
  const main = pick(rng, STEPS[obj.stat as keyof typeof STEPS]), second = pick(rng, STEPS[other]);
  const foeGang = pick(rng, GANG_KEYS.filter(g => g !== gang));
  const foe = rng() < 0.3 ? pick(rng, POLICE_NAMES) : pick(rng, GANG_MEMBERS[foeGang]);
  const per = D.energy / 4;
  const steps: MissionStep[] = [
    { text: main.text, stat: obj.stat, diff, energy: per, dmg: 0.08, ok: main.ok, ko: main.ko },
    { text: second.text, stat: other, diff: Math.round(diff * 0.95), energy: per, dmg: 0.08, ok: second.ok, ko: second.ko },
    { text: `${foe} te sale al cruce`, fight: { name: foe, mult: D.fight }, energy: per,
      win: `${foe} terminó en el piso.`, lose: `${foe} te dio una paliza.` },
    { text: `Volver con ${GANGS[gang].boss}`, energy: per, auto: true, ok: `${GANGS[gang].boss} cuenta la plata y asiente.` }
  ];
  return {
    id, street: true, gang, difficulty: d, rank: 0, mins: D.mins, place,
    title: `${obj.text} en ${place}`,
    intro: `${GANGS[gang].name} · ${D.name} · ${D.mins} min`,
    steps, outro: "",
    req: { [obj.stat]: Math.max(5, Math.round(typ * D.req)) },
    aff: D.aff,
    reward: {
      gold: Math.round(D.energy * (10 + 2.4 * lvl) * D.pay),
      xp: Math.round(D.energy * (3 + 0.55 * lvl) * D.pay),
      resp: D.resp, heat: D.heat
    }
  };
}

/* El tablón: una misión de cada dificultad, de pandillas al azar */
export function newBoard(s: PlayerState, rng: Rng, now: number) {
  s.board = STREET_DIFF.map((_, d) => streetMission(rng, s.lvl, d, pick(rng, GANG_KEYS), `calle-${now.toString(36)}-${d}-${rnd(rng, 0, 9999)}`));
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
