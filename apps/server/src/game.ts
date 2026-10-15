/* Servicio del juego: carga el personaje, le aplica el tiempo que pasó, ejecuta la acción y guarda.
   Todo pasa adentro de una transacción y con un candado por jugador, así no hay acciones pisadas. */
import {
  ambushCatchUp, applyAction, checkDuel, foeSide, maxHp, MIN_HP_TO_FIGHT, npcTarget, PVP_SAME_TARGET_EVERY, pvp, regen,
  RIVALS, TARGETS, type Action, type ActionResult, type PlayerState, type Rng, type Target
} from "@pop/shared";
import type { Db, Queryable } from "./db.js";

const rng: Rng = Math.random;

/* candado en memoria por jugador (alcanza con un solo servidor) */
const locks = new Map<number, Promise<unknown>>();
async function withLocks<T>(ids: number[], fn: () => Promise<T>): Promise<T> {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  const waitFor = sorted.map(id => locks.get(id) ?? Promise.resolve());
  const run = Promise.all(waitFor).catch(() => {}).then(fn);
  const done = run.catch(() => {});
  for (const id of sorted) locks.set(id, done);
  try { return await run; }
  finally { for (const id of sorted) if (locks.get(id) === done) locks.delete(id); }
}

interface Row { id: number; state: PlayerState }

async function lockRow(q: Queryable, where: string, param: unknown): Promise<Row | null> {
  const r = await q.query<Row>(`SELECT id, state FROM players WHERE ${where} = $1 FOR UPDATE`, [param]);
  return r.rows[0] ?? null;
}
async function saveRow(q: Queryable, id: number, s: PlayerState) {
  await q.query(`UPDATE players SET state = $2, side = $3, lvl = $4, respect = $5, gold = $6, last_seen = now() WHERE id = $1`,
    [id, JSON.stringify(s), s.side, s.lvl, s.respect, s.gold]);
}
/* el tiempo que pasó desde la última vez: recarga y emboscadas */
function catchUp(s: PlayerState, now: number) { regen(s, now); ambushCatchUp(s, { now, rng }); }

/* Rivales de La calle: primero jugadores reales del otro bando con nivel parecido, después personajes del juego */
async function fillTargets(q: Queryable, id: number, s: PlayerState) {
  if (!s.side) return;
  const real = await q.query<{ id: number; name: string; lvl: number; gold: number }>(
    `SELECT p.id, p.name, p.lvl, p.gold FROM players p
      WHERE p.side = $1 AND p.id <> $2 AND p.lvl BETWEEN $3 AND $4
        AND NOT EXISTS (SELECT 1 FROM pvp_log l WHERE l.attacker_id = $2 AND l.defender_id = p.id AND l.at > now() - $5 * interval '1 millisecond')
      ORDER BY random() LIMIT 3`,
    [foeSide(s.side), id, s.lvl - 3, s.lvl + 5, PVP_SAME_TARGET_EVERY]);
  const targets: Target[] = real.rows.map(r => ({ kind: "player", id: r.id, name: r.name, lvl: r.lvl, gold: Math.round(r.gold / 10) * 10 }));
  const used = new Set(targets.map(t => t.name));
  while (targets.length < TARGETS) {
    const t = npcTarget(rng, s.side, s.lvl);
    if (!used.has(t.name)) { used.add(t.name); targets.push(t); }
  }
  s.targets = targets;
}

export function makeGame(db: Db, notify: (playerId: number, msg: unknown) => void) {
  async function me(userId: number) {
    const id = await idOf(userId);
    return withLocks([id], () => db.tx(async q => {
      const row = (await lockRow(q, "id", id))!;
      const now = Date.now();
      catchUp(row.state, now);
      if (row.state.side && !row.state.targets.length) await fillTargets(q, id, row.state);
      await saveRow(q, id, row.state);
      return { id, state: row.state };
    }));
  }

  async function idOf(userId: number) {
    const r = await db.query<{ id: number }>(`SELECT id FROM players WHERE user_id = $1`, [userId]);
    if (!r.rows[0]) throw new Error("Sin personaje");
    return r.rows[0].id;
  }

  async function act(userId: number, a: Action): Promise<{ state: PlayerState; result: ActionResult }> {
    const id = await idOf(userId);
    /* pelear contra otro jugador bloquea a los dos */
    const peek = await db.query<{ state: PlayerState }>(`SELECT state FROM players WHERE id = $1`, [id]);
    const t = a.type === "duel" ? peek.rows[0].state.targets[a.i] : undefined;
    const otherId = t?.kind === "player" ? t.id : null;

    return withLocks(otherId ? [id, otherId] : [id], () => db.tx(async q => {
      const now = Date.now();
      const ids = otherId ? [id, otherId].sort((x, y) => x - y) : [id];
      const rows = new Map<number, Row>();
      for (const i of ids) { const r = await lockRow(q, "id", i); if (r) rows.set(i, r); }
      const s = rows.get(id)!.state;
      catchUp(s, now);

      let result: ActionResult;
      if (a.type === "duel" && otherId) {
        result = await duelPlayer(q, id, s, a.i, rows.get(otherId), now);
      } else {
        result = applyAction(s, a, { now, rng });
        if (!result.error && (a.type === "scout" || a.type === "side" || (a.type === "duel" && !s.targets.length))) await fillTargets(q, id, s);
      }
      await saveRow(q, id, s);
      return { state: s, result };
    }));
  }

  async function duelPlayer(q: Queryable, id: number, s: PlayerState, i: number, other: Row | undefined, now: number): Promise<ActionResult> {
    const t = s.targets[i];
    const drop = () => { s.targets.splice(i, 1); };
    if (!other || t.kind !== "player") { drop(); return { error: "Ese rival ya no está." }; }
    const def = other.state;
    catchUp(def, now);
    if (def.side !== foeSide(s.side!)) { drop(); return { error: "Ese rival ya no está." }; }
    if (def.hp < maxHp(def) * MIN_HP_TO_FIGHT) { drop(); await saveRow(q, other.id, def); return { error: `${def.name} está en la guardia. Buscá a otro.` }; }
    const err = checkDuel(s, i);
    if (err) return { error: err };
    drop();
    const goldBefore = def.gold;
    const result = pvp(s, def, { now, rng });
    await saveRow(q, other.id, def);
    await q.query(`INSERT INTO pvp_log (attacker_id, defender_id, attacker_won, gold) VALUES ($1, $2, $3, $4)`,
      [id, other.id, result.fight!.won, goldBefore - def.gold]);
    if (!s.targets.length) await fillTargets(q, id, s);
    notify(other.id, { type: "attacked", by: s.name, won: !result.fight!.won });
    return result;
  }

  /* Ranking: jugadores reales y los personajes de siempre, para que la ciudad no se vea vacía */
  async function ranking(myId?: number) {
    const r = await db.query<{ id: number; name: string; side: string; respect: number; lvl: number }>(
      `SELECT id, name, side, respect, lvl FROM players WHERE side IS NOT NULL ORDER BY respect DESC, lvl DESC LIMIT 100`);
    const rows = [
      ...r.rows.map(p => ({ name: p.name, side: p.side, resp: p.respect, lvl: p.lvl, me: p.id === myId, npc: false })),
      ...RIVALS.map(([name, side, resp, lvl]) => ({ name, side, resp, lvl, me: false, npc: true }))
    ];
    return rows.sort((a, b) => b.resp - a.resp);
  }

  return { me, act, ranking };
}
