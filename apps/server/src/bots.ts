/* Vecinos que juegan solos (bots). Son jugadores como cualquiera: mismas reglas, mismas acciones, aparecen en el ranking,
   en el mapa y en La calle, se los puede agregar de amigos e invitar a misiones de a dos. Los maneja el servidor:
   cada uno tiene su horario (se despierta y se acuesta a una hora de Argentina) y su forma de jugar.
   De noche salen a un trabajo largo. Se apagan con BOTS=0. */
import {
  ARC_MISSIONS, itemOf, itemPower, canStart, housesIn, houseOf, homePlace, BARRIOS, chaseModes, COOP_ENERGY, defaultMode, ENCARGO_COST, forSale, gangOf, gearVal, HOME, itemLocked, jobList,
  lawyerCost, maxHp, meetsReq, MISSIONS, missionEnergy, missionPlace, needsTrip, newPlayer, nextLevel, pick, planChase, PROPS,
  propIncome, SHOP, trainCost, travelModes, type Action, type Gang, type Mission, type PlayerState, type StatKey, type TravelMode
} from "@pop/shared";
import type { Db } from "./db.js";
import { RUTAS, type makeGame } from "./game.js";

type Game = ReturnType<typeof makeGame>;
interface BotDef { name: string; gang: Gang; avatar: number; lvl: number; aggro: number; wake: number; sleep: number }
/* aggro: cuánto sale a buscar pelea · wake/sleep: hora de Argentina */
export const BOTS: BotDef[] = [
  { name: "Tincho Ferreyra", gang: "barra",     avatar: 2, lvl: 5, aggro: 0.5, wake: 10, sleep: 1 },
  { name: "La Colorada Paz", gang: "familia",   avatar: 3, lvl: 7, aggro: 0.3, wake: 9,  sleep: 0 },
  { name: "Pocho Benítez",   gang: "sindicato", avatar: 1, lvl: 4, aggro: 0.2, wake: 7,  sleep: 23 },
  { name: "Yésica Ramos",    gang: "amarillos", avatar: 4, lvl: 6, aggro: 0.4, wake: 12, sleep: 3 },
  { name: "Nacho del Once",  gang: "amarillos", avatar: 1, lvl: 3, aggro: 0.1, wake: 15, sleep: 4 },
  { name: "Juanca Godoy",    gang: "sindicato", avatar: 2, lvl: 8, aggro: 0.6, wake: 8,  sleep: 22 },
  { name: "Lali Torres",     gang: "familia",   avatar: 4, lvl: 5, aggro: 0.3, wake: 11, sleep: 2 },
  { name: "El Chino Acuña",  gang: "barra",     avatar: 2, lvl: 9, aggro: 0.7, wake: 13, sleep: 4 }
];
const rng = Math.random;
const MIN = 60_000;

/* crea los que falten (sin contraseña: nadie puede entrar con esas cuentas) */
export async function ensureBots(db: Db) {
  for (const b of BOTS) {
    const exists = await db.query(`SELECT 1 FROM users WHERE lower(username) = lower($1)`, [b.name]);
    if (exists.rows.length) continue;
    const s = newPlayer(b.name, Date.now(), b.avatar);
    const st = (k: number) => Math.max(5, Math.round(b.lvl * 1.3) + k);
    Object.assign(s, {
      lvl: b.lvl, gold: 150 + b.lvl * 60, tut: 6, tutDone: true, respect: b.lvl * 12,
      tabs: ["laburos", "gimnasio", "feria", "ring", "guardia", "misiones", "calle", "casa", "negocios", "amigos", "ranking"],
      stats: { fue: st(1), dur: st(0), ref: st(1), agu: st(-1), lab: st(0) }
    });
    s.aff[b.gang] = 20; s.c.valija = 1; s.hp = maxHp(s);
    await db.tx(async q => {
      const u = await q.query<{ id: number }>(`INSERT INTO users (username, pass_hash) VALUES ($1, 'bot') RETURNING id`, [b.name]);
      await q.query(`INSERT INTO players (user_id, name, side, lvl, respect, gold, state, bot) VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        [u.rows[0].id, b.name, b.gang, b.lvl, s.respect, s.gold, JSON.stringify(s)]);
    });
  }
}

const hourART = (now: number) => (new Date(now).getUTCHours() + 21) % 24;
const awakeAt = (b: BotDef, now: number) => {
  const h = hourART(now);
  return b.wake < b.sleep ? h >= b.wake && h < b.sleep : h >= b.wake || h < b.sleep;
};
/* cómo va a una misión: casi siempre lo más barato, a veces otra cosa */
function pickMode(s: PlayerState, place: string): TravelMode | undefined {
  const modes = travelModes(s, place);
  if (rng() < 0.25 && modes.length) return pick(rng, modes);
  return defaultMode(s, place);
}
const start = (s: PlayerState, m: Mission): Action => {
  const place = missionPlace(m);
  return { type: "mstart", id: m.id, mode: place && needsTrip(s, m) ? pickMode(s, place) : undefined };
};

/* Qué hace ahora un bot despierto y libre */
function decide(s: PlayerState, b: BotDef): Action | null {
  if (s.busy) return null;
  const mh = maxHp(s);
  if (s.heat >= 60 && s.gold >= lawyerCost(s) * 2) return { type: "lawyer" };
  if (s.hp < mh * 0.5) return s.gold > (mh - s.hp) * 0.25 * 4 ? { type: "heal" } : { type: "guardia" };
  if (PROPS.some(p => s.props?.[p.id] !== undefined && propIncome(p, s.props[p.id], Date.now()) >= p.perHour * 4)) return { type: "collect" };
  /* mudarse a algo mejor cuando le sobra la plata */
  /* se muda dentro de su barrio, o a uno al azar */
  const house = [...housesIn(homePlace(s)), ...housesIn(pick(rng, BARRIOS))].find(h => h.lvl <= s.lvl && h.price > houseOf(s).price && h.price <= s.gold / 2);
  if (house && rng() < 0.5) return { type: "move", id: house.id };
  const prop = PROPS.find(p => s.props?.[p.id] === undefined && p.lvl <= s.lvl && p.price <= s.gold / 2);
  if (prop && rng() < 0.5) return { type: "prop", id: prop.id };
  if (!s.home.obra) {
    const part = (Object.keys(HOME) as (keyof typeof HOME)[]).map(k => [k, nextLevel(s, k)] as const)
      .filter(([, lv]) => lv && lv.cost <= s.gold / 3).sort((x, y) => x[1]!.cost - y[1]!.cost)[0];
    if (part) return { type: "build", part: part[0] };
  }
  const gear = SHOP.find(it => it.slot !== "consumible" && forSale(s, it) && !itemLocked(s, it) && itemPower(it) > itemPower(itemOf(s.gear[it.slot])) && it.price <= s.gold / 2 && it.id !== "suplemento");
  if (gear) return { type: "buy", id: gear.id };
  /* misiones: la historia de su pandilla, después las historias de la ciudad desde su bando, después el tablón */
  const mine = gangOf(s) ?? b.gang;
  const story = [...MISSIONS[mine], ...ARC_MISSIONS.filter(m => m.pov === mine)]
    .find(m => canStart(s, m) && meetsReq(s, m) && s.energy >= missionEnergy(m));
  if (story && rng() < 0.7) return start(s, story);
  const board = s.board.filter(m => !m.hours && canStart(s, m) && meetsReq(s, m) && s.energy >= missionEnergy(m));
  if (board.length && rng() < 0.45) return start(s, pick(rng, board));
  /* entrenar lo más bajo */
  const low = (["fue", "dur", "ref", "agu", "lab"] as StatKey[]).sort((x, y) => s.stats[x] - s.stats[y])[0];
  if (s.gold >= trainCost(s.stats[low]) + 30 && rng() < 0.6) return { type: "train", stat: low };
  if (s.energy >= ENCARGO_COST && rng() < 0.4) return { type: "encargo", gang: mine };
  const job = jobList(s).filter(j => j.lvl <= s.lvl && j.cost <= s.energy)
    .sort((x, y) => (y.gold[0] + y.gold[1]) / y.cost - (x.gold[0] + x.gold[1]) / x.cost)[0];
  if (job) return { type: "job", id: job.id };
  return null;
}
/* antes de dormir: el trabajo largo que mejor le calza */
function bedtime(s: PlayerState): Action | null {
  if (s.busy) return null;
  const long = s.board.filter(m => m.hours && meetsReq(s, m) && s.energy >= missionEnergy(m)).sort((x, y) => (y.hours ?? 0) - (x.hours ?? 0))[0];
  return long ? start(s, long) : null;
}

export function makeBots(db: Db, game: Game, ring: { join: (playerId: number) => Promise<unknown> }) {
  const next = new Map<number, number>();   // cuándo vuelve a jugar cada uno
  let roster: { id: number; user_id: number; name: string }[] | null = null; // se lee una vez (no despierta la base cada minuto)
  const awake = new Set<number>();          // los que están "en línea"
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    try {
      const now = Date.now();
      roster ??= (await db.query<{ id: number; user_id: number; name: string }>(`SELECT id, user_id, name FROM players WHERE bot`)).rows;
      for (const r of roster) {
        const b = BOTS.find(x => x.name === r.name);
        if (!b) continue;
        const up = awakeAt(b, now);
        if (up) awake.add(r.id); else awake.delete(r.id);
        if (now < (next.get(r.id) ?? 0)) continue;
        next.set(r.id, now + (up ? (2 + rng() * 5) * MIN : 30 * MIN));
        try { await play(r.id, r.user_id, b, up); } catch { /* si una acción falla, prueba en el próximo turno */ }
      }
    } finally { running = false; }
  }

  async function play(id: number, userId: number, b: BotDef, up: boolean) {
    const { state: s } = await game.me(userId);
    /* amigos: acepta solicitudes; misiones de a dos: acepta si está despierto y tiene energía */
    const f = await game.friends(userId);
    for (const p of f.incoming) await game.acceptFriend(userId, p.id).catch(() => {});
    if (up && !s.coop) for (const inv of f.invites) {
      await game.coopRespond(userId, inv.id, s.energy >= COOP_ENERGY).catch(() => {});
      break;
    }
    await ring.join(id).catch(() => {});      // se anota en el torneo del mes (si ya está, no pasa nada)
    if (!up) { const a = bedtime(s); if (a) await game.act(userId, a); return; }
    /* a veces sale a buscar a alguien que anda por la calle */
    if (!s.busy && rng() < b.aggro * 0.3) {
      const { people } = await game.travelers(userId);
      for (const t of people.filter(p => p.trip)) {
        if (t.gang && t.gang === gangOf(s)) continue;
        const mode = pick(rng, chaseModes(s));
        if (planChase(s, RUTAS, { since: t.since, until: t.until, trip: t.trip! }, Date.now(), mode)) {
          const r = await game.act(userId, { type: "chase", id: t.id, mode });
          if (!r.result.error) return;
        }
      }
    }
    /* dos o tres cosas seguidas, como una persona que entra un rato */
    for (let i = 0; i < 3; i++) {
      const cur = i ? (await game.me(userId)).state : s;
      const a = decide(cur, b);
      if (!a) return;
      const r = await game.act(userId, a);
      if (r.result.error || r.state.busy) return;
    }
  }

  return { tick, isAwake: (id: number) => awake.has(id), awakeCount: () => awake.size };
}
