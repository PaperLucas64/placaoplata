/* Fórmulas: progreso, combate y recarga. Funciones puras: el azar entra como parámetro. */
import { CLINIC_PER_HP, ENERGY_EVERY, ENERGY_MAX, GUARDIA_FULL, HEAL_EVERY, HEAT_EVERY, LOG_SIZE, SALARY_EVERY, TRAIN_MAX, TRAIN_MIN, TRAIN_PER_POINT } from "./config.js";
import { JOBS, MISSIONS, RANK_AT, SHOP, SIDE_JOBS, STAT_NAMES, VALIJA } from "./data.js";
import type { Fighter, FightView, Item, LogEntry, Mission, PlayerState, Rng, Side } from "./types.js";

export const rnd = (rng: Rng, a: number, b: number) => Math.floor(rng() * (b - a + 1)) + a;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const pick = <T>(rng: Rng, a: T[]): T => a[rnd(rng, 0, a.length - 1)];
export const money = (n: number) => `$${n}`;

export const maxHp = (s: Pick<PlayerState, "stats" | "lvl">) => 40 + s.stats.agu * 12 + s.lvl * 6;
export const xpNeed = (s: Pick<PlayerState, "lvl">) => Math.round(40 * Math.pow(s.lvl, 1.55));
export const trainCost = (v: number) => Math.round(3 * Math.pow(v, 2));
export const gearVal = (s: PlayerState, slot: "arma" | "armadura") => SHOP.find(i => i.id === s.gear[slot])?.val ?? 0;
export const rankOf = (s: Pick<PlayerState, "respect">) => RANK_AT.filter(r => s.respect >= r).length - 1;
export const foeSide = (side: Side): Side => (side === "placa" ? "plata" : "placa");
export const jobList = (s: PlayerState) => (s.side ? SIDE_JOBS[s.side] : JOBS);
export const allMissions = (): Mission[] => [VALIJA, ...MISSIONS.placa, ...MISSIONS.plata];
export const getMission = (id: string) => allMissions().find(m => m.id === id);
export const salary = (s: PlayerState) => 30 + s.lvl * 12 + rankOf(s) * 25;
export const salaryLeft = (s: PlayerState, now: number) => Math.max(0, SALARY_EVERY - (now - s.tSalary));
export const lawyerCost = (s: PlayerState) => 20 + s.lvl * 8;
export const healCost = (s: PlayerState) => Math.max(0, Math.round((maxHp(s) - s.hp) * CLINIC_PER_HP));
const MIN = 60_000;
/* minutos de verdad que lleva entrenar un atributo que hoy vale `v` */
export const trainTime = (v: number) => Math.round(Math.min(TRAIN_MAX, TRAIN_MIN + v * TRAIN_PER_POINT) * MIN);
/* minutos en la guardia según cuánta vida falta (mínimo 1 minuto) */
export const guardiaTime = (s: Pick<PlayerState, "hp" | "stats" | "lvl">) =>
  Math.max(MIN, Math.round((1 - s.hp / maxHp(s)) * GUARDIA_FULL * MIN));
export const busyLeft = (s: PlayerState, now: number) => (s.busy ? Math.max(0, s.busy.until - now) : 0);
export const itemLocked = (s: PlayerState, it: Item) => s.lvl < it.lvl || (!!it.rank && rankOf(s) < it.rank);

export function newPlayer(name: string, now: number, avatar = 1): PlayerState {
  const s: PlayerState = {
    name, avatar, lvl: 1, xp: 0, gold: 10, energy: ENERGY_MAX, hp: 0,
    stats: { fue: 5, dur: 5, ref: 5, agu: 5, lab: 5 },
    gear: { arma: null, armadura: null }, potions: 0, wins: 0, losses: 0,
    tut: 0, tutDone: false, tabs: ["laburos"], seenTab: {},
    c: { jobs: 0, train: 0, buy: 0, spar: 0, heal: 0, valija: 0, duelW: 0, duelL: 0 },
    mis: null, side: null, respect: 0, heat: 0, done: {}, targets: [],
    tEnergy: now, tHeal: now, tSalary: now - SALARY_EVERY, tAttack: now, tHeat: now, log: []
  };
  s.hp = maxHp(s);
  log(s, now, `${name} se baja del micro en Bahía Gris con ${money(10)} en el bolsillo.`, "gold");
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
export const addHeat = (s: PlayerState, n: number) => { s.heat = clamp(s.heat + n, 0, 100); };

/* Energía, vida y calor se recargan solos con el paso del tiempo (sin cron: se calcula al leer) */
/* Termina lo que estaba en curso si ya pasó el tiempo */
export function finishBusy(s: PlayerState, now: number) {
  const b = s.busy;
  if (!b || now < b.until) return;
  s.busy = null;
  if (b.kind === "gym") {
    s.stats[b.stat]++; s.c.train++;
    if (b.stat === "agu") s.hp += 12;
    log(s, b.until, `Terminaste de entrenar: ${STAT_NAMES[b.stat].toLowerCase()} sube a ${s.stats[b.stat]}.`, "good");
  } else {
    s.hp = maxHp(s); s.c.heal++; s.tHeal = b.until;
    log(s, b.until, "Te dieron el alta en la guardia. Vida al máximo.", "good");
  }
}

export function regen(s: PlayerState, now: number) {
  finishBusy(s, now);
  if (s.energy < ENERGY_MAX) {
    const g = Math.floor((now - s.tEnergy) / ENERGY_EVERY);
    if (g > 0) { s.energy = Math.min(ENERGY_MAX, s.energy + g); s.tEnergy += g * ENERGY_EVERY; }
  } else s.tEnergy = now;
  const mh = maxHp(s);
  if (s.hp < mh) {
    const h = Math.floor((now - s.tHeal) / HEAL_EVERY);
    if (h > 0) { s.hp = Math.min(mh, s.hp + h * Math.ceil(mh * 0.02)); s.tHeal += h * HEAL_EVERY; }
  } else s.tHeal = now;
  if (s.side === "plata" && s.heat > 0) {
    const h = Math.floor((now - s.tHeat) / HEAT_EVERY);
    if (h > 0) { s.heat = Math.max(0, s.heat - h); s.tHeat += h * HEAT_EVERY; }
  } else s.tHeat = now;
}

/* ---------- combate ---------- */
export function playerFighter(s: PlayerState): Fighter {
  return { name: s.name, hp: s.hp, max: maxHp(s), fue: s.stats.fue, dur: s.stats.dur, ref: s.stats.ref, arma: gearVal(s, "arma"), armadura: gearVal(s, "armadura") };
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
