/* Fórmulas: progreso, pandillas, casa, combate y recarga. Funciones puras: el azar entra como parámetro. */
import {
  CLINIC_PER_HP, ENERGY_EVERY, ENERGY_MAX, GUARDIA_FULL, HEAL_EVERY, HEAT_EVERY, LOG_SIZE, TRAIN_MAX, TRAIN_MIN, TRAIN_PER_POINT
} from "./config.js";
import { JOBS, OLD_ITEMS, SHOP, STAT_NAMES } from "./data.js";
import {
  BED_ENERGY, BED_HEAL, CLOSET_SLOTS, GANG_KEYS, GANG_MIN_POINTS, GANG_THRESHOLD, GANGS, GOLPES, HOME, RANK_AT, RANK_NAMES, SAFE_CAP
} from "./gangs.js";
import type { Fighter, FightView, Gang, Home, Item, LogEntry, PlayerState, Rng } from "./types.js";

export const rnd = (rng: Rng, a: number, b: number) => Math.floor(rng() * (b - a + 1)) + a;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const pick = <T>(rng: Rng, a: T[]): T => a[rnd(rng, 0, a.length - 1)];
export const money = (n: number) => `$${n}`;
const MIN = 60_000;

export const maxHp = (s: Pick<PlayerState, "stats" | "lvl"> & { hpBonus?: number }) => 40 + s.stats.agu * 12 + s.lvl * 6 + (s.hpBonus ?? 0);
/* suplemento de Don Tito: +10 de vida máxima para siempre, hasta 10 veces; cada uno cuesta más que el anterior */
export const SUPPLEMENT_MAX = 10;
export const supplementsTaken = (s: Pick<PlayerState, "hpBonus">) => Math.round((s.hpBonus ?? 0) / 10);
export const supplementCost = (s: Pick<PlayerState, "hpBonus">) => 300 * (supplementsTaken(s) + 1) ** 2;
/* la feria: en el tutorial solo te vende una llave inglesa; después, todo lo de tu nivel */
export const TUTORIAL_SHOP = ["llave"];
export const forSale = (s: PlayerState, it: Item) => s.tutDone ? true : TUTORIAL_SHOP.includes(it.id);
export const xpNeed = (s: Pick<PlayerState, "lvl">) => Math.round(40 * Math.pow(s.lvl, 1.55));
export const trainCost = (v: number) => Math.round(3 * Math.pow(v, 2));
export const gearVal = (s: PlayerState, slot: "arma" | "armadura") => SHOP.find(i => i.id === s.gear[slot])?.val ?? 0;
export const rankOf = (s: Pick<PlayerState, "respect">) => RANK_AT.filter(r => s.respect >= r).length - 1;
export const lawyerCost = (s: PlayerState) => 20 + s.lvl * 8;
export const healCost = (s: PlayerState) => Math.max(0, Math.round((maxHp(s) - s.hp) * CLINIC_PER_HP));
export const itemLocked = (s: PlayerState, it: Item) => s.lvl < it.lvl || (!!it.rank && rankOf(s) < it.rank);
/* trabajos honestos mientras sos recién llegado; después, los golpes también */
export const jobList = (s: PlayerState) => (s.tutDone ? [...JOBS, ...GOLPES] : JOBS);
export const isGolpe = (id: string) => GOLPES.some(j => j.id === id);

/* ---------- pandillas ---------- */
export const affTotal = (s: Pick<PlayerState, "aff">) => GANG_KEYS.reduce((a, g) => a + (s.aff[g] ?? 0), 0);
export const affShare = (s: Pick<PlayerState, "aff">, g: Gang) => { const t = affTotal(s); return t ? (s.aff[g] ?? 0) / t : 0; };
/* sos de una pandilla si tiene la mitad o más de tu afinidad; si no, andás suelto */
export function gangOf(s: Pick<PlayerState, "aff">): Gang | null {
  if (affTotal(s) < GANG_MIN_POINTS) return null;
  return GANG_KEYS.find(g => affShare(s, g) >= GANG_THRESHOLD) ?? null;
}
export const gangName = (g: Gang | null) => (g ? GANGS[g].name : "Suelto");

/* ---------- casa ---------- */
export const energyMax = (s: Pick<PlayerState, "home">) => ENERGY_MAX + BED_ENERGY[s.home?.cama ?? 0];
export const safeCap = (s: Pick<PlayerState, "home">) => SAFE_CAP[s.home?.caja ?? 0];
export const closetSlots = (s: Pick<PlayerState, "home">) => CLOSET_SLOTS[s.home?.armario ?? 0];
export const nextLevel = (s: PlayerState, part: keyof typeof HOME) => HOME[part].levels[s.home[part] + 1];
export const newHome = (): Home => ({ cama: 0, caja: 0, armario: 0, safe: 0, closet: [], obra: null });

/* ---------- tiempos ---------- */
/* minutos de verdad que lleva entrenar un atributo que hoy vale `v` (el Sindicato entrena 25% más rápido) */
export const trainTime = (v: number, s?: Pick<PlayerState, "aff">) =>
  Math.round(Math.min(TRAIN_MAX, TRAIN_MIN + v * TRAIN_PER_POINT) * MIN * (s && gangOf(s) === "sindicato" ? 0.75 : 1));
/* minutos en la guardia según cuánta vida falta (mínimo 1 minuto) */
export const guardiaTime = (s: Pick<PlayerState, "hp" | "stats" | "lvl">) =>
  Math.max(MIN, Math.round((1 - s.hp / maxHp(s)) * GUARDIA_FULL * MIN));
export const busyLeft = (s: PlayerState, now: number) => (s.busy ? Math.max(0, s.busy.until - now) : 0);

export function newPlayer(name: string, now: number, avatar = 1): PlayerState {
  const s: PlayerState = {
    v: 3, name, avatar, lvl: 1, xp: 0, gold: 10, energy: ENERGY_MAX, hp: 0,
    stats: { fue: 5, dur: 5, ref: 5, agu: 5, lab: 5 },
    gear: { arma: null, armadura: null }, potions: 0, wins: 0, losses: 0,
    tut: 0, tutDone: false, tabs: ["laburos"], seenTab: {},
    c: { jobs: 0, train: 0, buy: 0, spar: 0, heal: 0, valija: 0, duelW: 0, duelL: 0 },
    aff: { familia: 0, sindicato: 0, barra: 0, amarillos: 0 }, board: [], tBoard: 0,
    respect: 0, heat: 0, done: {}, targets: [], home: newHome(),
    tEnergy: now, tHeal: now, tAttack: now, tHeat: now, log: []
  };
  s.hp = maxHp(s);
  log(s, now, `${name} se baja del micro en Maires con ${money(10)} en el bolsillo.`, "gold");
  return s;
}

/* Partidas de la versión con policía (placa o plata): se pasan al formato de pandillas */
export function upgradeState(s: PlayerState & { side?: string | null; tSalary?: number; mis?: unknown }, now: number): PlayerState {
  if (s.v === 3) return s;
  /* v2 -> v3: misiones a tiempo humano y tablón de la calle */
  if (s.v === 2) { delete s.mis; s.board = []; s.tBoard = 0; s.v = 3; return s; }
  const old = s.side;
  delete s.side; delete s.tSalary;
  s.aff = { familia: 0, sindicato: 0, barra: 0, amarillos: 0 };
  if (old === "plata") s.aff.familia = Object.keys(s.done ?? {}).filter(id => ["kiosco", "blindado", "comisaria"].includes(id)).length * 20 + 10;
  for (const id of ["ronda", "allanamiento", "senora"]) delete s.done?.[id];
  delete s.mis; s.board = []; s.tBoard = 0;
  for (const slot of ["arma", "armadura"] as const) { const g = s.gear[slot]; if (g && OLD_ITEMS[g]) s.gear[slot] = OLD_ITEMS[g]; }
  s.home = newHome();
  s.targets = [];
  if (s.tutDone && !s.tabs.includes("casa")) s.tabs.splice(s.tabs.indexOf("ranking"), 0, "casa");
  for (const k of ["calle", "ranking"] as const) if (s.tutDone && !s.tabs.includes(k)) s.tabs.push(k);
  s.v = 3;
  log(s, now, old ? "Maires cambió: la policía ya no recluta. Ahora mandan las cuatro pandillas." : "Maires cambió: ahora mandan las cuatro pandillas.", "gold");
  return s;
}

export function log(s: PlayerState, now: number, msg: string, cls?: LogEntry["cls"]) {
  s.log.unshift({ t: now, msg, ...(cls ? { cls } : {}) });
  s.log = s.log.slice(0, LOG_SIZE);
}
export function gainXp(s: PlayerState, now: number, n: number) {
  s.xp += n;
  while (s.xp >= xpNeed(s)) { s.xp -= xpNeed(s); s.lvl++; s.hp = maxHp(s); log(s, now, `Subiste al nivel ${s.lvl}. Vida al máximo.`, "gold"); }
}
/* Los Amarillos juntan 30% menos de calor */
export const addHeat = (s: PlayerState, n: number) => {
  if (n > 0 && gangOf(s) === "amarillos") n = Math.round(n * 0.7);
  s.heat = clamp(s.heat + n, 0, 100);
};
export function addRespect(s: PlayerState, now: number, n: number) {
  const before = rankOf(s);
  s.respect = Math.max(0, s.respect + n);
  const after = rankOf(s);
  if (s.tutDone && after > before) log(s, now, `Subiste de rango: ahora sos ${RANK_NAMES[after]}.`, "gold");
}

/* Suma afinidad con una pandilla y avisa si eso te hace entrar o salir de alguna */
export function addAff(s: PlayerState, now: number, g: Gang, n: number) {
  const before = gangOf(s);
  s.aff[g] = (s.aff[g] ?? 0) + n;
  const after = gangOf(s);
  if (after !== before) {
    if (after) log(s, now, `Ahora sos de ${GANGS[after].name}. ${GANGS[after].boss} te reconoce como propio.`, "gold");
    else log(s, now, `Ya no sos de ${GANGS[before!].name}: andás suelto.`, "bad");
  }
}

/* ---------- el paso del tiempo ---------- */
/* Termina lo que estaba en curso si ya pasó el tiempo */
export function finishBusy(s: PlayerState, now: number) {
  const b = s.busy;
  if (b && b.kind !== "mision" && now >= b.until) {
    s.busy = null;
    if (b.kind === "caza") log(s, b.until, "Volviste a la pensión.");
    else if (b.kind === "gym") {
      s.stats[b.stat]++; s.c.train++;
      if (b.stat === "agu") s.hp += 12;
      log(s, b.until, `Terminaste de entrenar: ${STAT_NAMES[b.stat].toLowerCase()} sube a ${s.stats[b.stat]}.`, "good");
    } else {
      s.hp = maxHp(s); s.c.heal++; s.tHeal = b.until;
      log(s, b.until, "Te dieron el alta en la guardia. Vida al máximo.", "good");
    }
  }
  const o = s.home?.obra;
  if (o && now >= o.until) {
    s.home.obra = null;
    s.home[o.part]++;
    log(s, o.until, `Terminó la obra en tu casa: ${HOME[o.part].levels[s.home[o.part]].name.toLowerCase()}.`, "good");
  }
}

/* Energía, vida y calor se recargan solos con el paso del tiempo (sin cron: se calcula al leer) */
export function regen(s: PlayerState, now: number) {
  finishBusy(s, now);
  const em = energyMax(s);
  if (s.energy < em) {
    const g = Math.floor((now - s.tEnergy) / ENERGY_EVERY);
    if (g > 0) { s.energy = Math.min(em, s.energy + g); s.tEnergy += g * ENERGY_EVERY; }
  } else s.tEnergy = now;
  const mh = maxHp(s);
  if (s.hp < mh) {
    const h = Math.floor((now - s.tHeal) / HEAL_EVERY);
    const per = Math.ceil(mh * 0.02 * (1 + BED_HEAL[s.home?.cama ?? 0]));
    if (h > 0) { s.hp = Math.min(mh, s.hp + h * per); s.tHeal += h * HEAL_EVERY; }
  } else s.tHeal = now;
  if (s.heat > 0) {
    const h = Math.floor((now - s.tHeat) / HEAT_EVERY);
    if (h > 0) { s.heat = Math.max(0, s.heat - h); s.tHeat += h * HEAT_EVERY; }
  } else s.tHeat = now;
}

/* ---------- combate ---------- */
/* La Barra pega 10% más fuerte */
export function playerFighter(s: PlayerState): Fighter {
  const fue = gangOf(s) === "barra" ? Math.round(s.stats.fue * 1.1) : s.stats.fue;
  return { name: s.name, hp: s.hp, max: maxHp(s), fue, dur: s.stats.dur, ref: s.stats.ref, arma: gearVal(s, "arma"), armadura: gearVal(s, "armadura") };
}
/* Golpes fuertes y con variación: las peleas duran pocos rounds y un rival un poco mejor no es imposible.
   Curva medida con tools/playthrough.ts y docs/BALANCE.md. */
function strike(rng: Rng, a: Fighter, d: Fighter) {
  const chance = clamp(62 + (a.ref - d.ref) * 1.5, 25, 92);
  if (rng() * 100 >= chance) return 0;
  const crit = rng() < 0.15;
  const roll = 0.5 + rng();                       // entre 50% y 150% del golpe
  let dmg = 3 * ((a.fue * 1.6 + a.arma) * roll - d.dur * 0.5 - d.armadura * 0.7);
  dmg = Math.max(1, Math.round(dmg * (crit ? 1.6 : 1)));
  return crit ? -dmg : dmg;
}
const fLine = (r: number, who: string, d: number) =>
  d === 0 ? `R${r} · ${who} tira y no conecta.` : `R${r} · ${who} ${d < 0 ? "mete una mano tremenda de" : "pega por"} ${Math.abs(d)}.`;

/* Pelea por rounds. `p` ataca primero; gana quien deja al otro en cero o termina con más vida proporcional. */
export function battle(rng: Rng, p: Fighter, e: Fighter): FightView {
  p = { ...p }; e = { ...e };
  const rounds: FightView["rounds"] = [];
  for (let r = 1; r <= 12 && p.hp > 0 && e.hp > 0; r++) {
    let d = strike(rng, p, e); e.hp = Math.max(0, e.hp - Math.abs(d)); rounds.push({ who: "p", txt: fLine(r, p.name, d) });
    if (e.hp <= 0) break;
    d = strike(rng, e, p); p.hp = Math.max(0, p.hp - Math.abs(d)); rounds.push({ who: "e", txt: fLine(r, e.name, d) });
  }
  const won = e.hp <= 0 || (p.hp > 0 && p.hp / p.max > e.hp / e.max);
  return { won, rounds, p, e };
}
/* Rival del juego escalado por nivel, al ritmo al que se puede entrenar en el gimnasio */
export function scaledEnemy(rng: Rng, name: string, lvl: number, mult: number): Fighter {
  const base = Math.max(5, 0.5 + lvl * 1.4);   // lo que mide el bot en un jugador que entrena parejo
  const v = () => Math.max(3, Math.round(base * mult + rnd(rng, -2, 2)));
  const agu = v();
  const max = Math.round((40 + agu * 12 + lvl * 6) * (0.85 + mult * 0.15));
  return { name, hp: max, max, fue: v(), dur: v(), ref: v(), arma: Math.round(Math.min(24, lvl * 1.4) * mult), armadura: Math.round(Math.min(24, lvl * 1.2) * mult) };
}
