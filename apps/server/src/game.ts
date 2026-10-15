/* Servicio del juego: carga el personaje, le aplica el tiempo que pasó, ejecuta la acción y guarda.
   Todo pasa adentro de una transacción y con un candado por jugador, así no hay acciones pisadas.
   Si el jugador tiene una misión de a dos, se bloquea también a su compañero (los dos cambian juntos). */
import {
  ambushCatchUp, ambushPlayer, applyAction, canAmbush, chaseModes, CROSS_LVL_GAP, crossFight, firstCrossing, nearestPlace, planChase, rivals,
  startChase, tripPos, type FightView, type TravelerView, type OnTrip, type Rutas, boardCatchUp, checkDuel, COOP_ENERGY, coopMission, coopStepAt, coopUntil, energyMax, finishCoop,
  GANG_KEYS, gangOf, log, maxHp, MIN_HP_TO_FIGHT, missionCatchUp, npcTarget, pick, PVP_SAME_TARGET_EVERY, pvp, regen,
  resolveCoopStep, RIVALS, TARGETS, upgradeState, type Action, type ActionResult, type Gang, type Mission, type PlayerState,
  type Rng, type Target
} from "@pop/shared";
import { readFileSync } from "node:fs";
import type { Db, Queryable } from "./db.js";
import { makeTerritory } from "./territory.js";

const rng: Rng = Math.random;
/* los recorridos del GPS (los mismos que dibuja la pantalla), para saber dónde está cada uno */
export const RUTAS: Rutas = JSON.parse(readFileSync(new URL("../../../packages/shared/data/rutas.json", import.meta.url), "utf8"));
const onTrip = (b: PlayerState["busy"]): OnTrip | null =>
  b?.kind === "mision" && b.trip ? { since: Number(b.since), until: Number(b.until), trip: b.trip } : null;
/* la misma pelea vista desde el otro lado */
const flip = (f: FightView): FightView => ({ p: f.e, e: f.p, won: !f.won, rounds: f.rounds.map(r => ({ ...r, who: r.who === "p" ? "e" : "p" })) });
export class GameError extends Error {}

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
interface CoopRow { id: number; host_id: number; guest_id: number; mission: Mission; status: string; since: string | null; until: string | null; done: number; ok: number }

async function lockRow(q: Queryable, id: number): Promise<Row | null> {
  const r = await q.query<Row>(`SELECT id, state FROM players WHERE id = $1 FOR UPDATE`, [id]);
  const row = r.rows[0];
  if (row) upgradeState(row.state, Date.now()); // partidas de versiones anteriores
  return row ?? null;
}
async function saveRow(q: Queryable, id: number, s: PlayerState) {
  await q.query(`UPDATE players SET state = $2, side = $3, lvl = $4, respect = $5, gold = $6, last_seen = now() WHERE id = $1`,
    [id, JSON.stringify(s), gangOf(s), s.lvl, s.respect, s.gold]);
}
/* el tiempo que pasó desde la última vez: recarga, misiones, tablón y emboscadas */
function catchUp(s: PlayerState, now: number) {
  regen(s, now);
  missionCatchUp(s, { now, rng });   // etapas de la misión en curso que ya pasaron
  boardCatchUp(s, { now, rng });     // tablón de la calle (cada 6 horas)
  ambushCatchUp(s, { now, rng });
}

/* Rivales de La calle: primero jugadores reales de otras pandillas (o sueltos) con nivel parecido, después personajes */
async function fillTargets(q: Queryable, id: number, s: PlayerState) {
  if (!s.tutDone) return;
  const mine = gangOf(s);
  const real = await q.query<{ id: number; name: string; lvl: number; gold: number; avatar: number | null; side: Gang | null; bot: boolean }>(
    `SELECT p.id, p.name, p.lvl, p.gold, (p.state->>'avatar')::int AS avatar, p.side, p.bot FROM players p
      WHERE p.side IS DISTINCT FROM $1 AND (p.state->>'tutDone')::boolean AND p.id <> $2 AND p.lvl BETWEEN $3 AND $4
        AND NOT EXISTS (SELECT 1 FROM pvp_log l WHERE l.attacker_id = $2 AND l.defender_id = p.id AND l.at > now() - $5 * interval '1 millisecond')
      ORDER BY random() LIMIT 3`,
    [mine, id, s.lvl - 3, s.lvl + (s.lvl < 8 ? 1 : 3), PVP_SAME_TARGET_EVERY]);
  const targets: Target[] = real.rows.map(r => ({ kind: "player", id: r.id, name: r.name, lvl: r.lvl, gold: Math.round(r.gold / 10) * 10, avatar: r.avatar ?? 1, gang: r.side, bot: r.bot }));
  const used = new Set(targets.map(t => t.name));
  while (targets.length < TARGETS) {
    const t = npcTarget(rng, mine, s.lvl);
    if (!used.has(t.name)) { used.add(t.name); targets.push(t); }
  }
  s.targets = targets;
}

export function makeGame(db: Db, notify: (playerId: number, msg: unknown) => void, isOnline: (playerId: number) => boolean) {
  const territory = makeTerritory(db);
  async function idOf(userId: number) {
    const r = await db.query<{ id: number }>(`SELECT id FROM players WHERE user_id = $1`, [userId]);
    if (!r.rows[0]) throw new GameError("Sin personaje");
    return r.rows[0].id;
  }
  const peekState = async (id: number) => (await db.query<{ state: PlayerState }>(`SELECT state FROM players WHERE id = $1`, [id])).rows[0]?.state;

  /* Abre una sesión sobre varios jugadores: candados, transacción, el tiempo que pasó y la misión de a dos.
     Al final guarda a todos. */
  async function session<T>(ids: number[], fn: (q: Queryable, rows: Map<number, Row>, now: number) => Promise<T>): Promise<T> {
    const map = await territory.snapshot();
    return withLocks(ids, () => db.tx(async q => {
      const now = Date.now();
      const rows = new Map<number, Row>();
      for (const i of [...new Set(ids)].sort((a, b) => a - b)) { const r = await lockRow(q, i); if (r) rows.set(i, r); }
      /* cuántos barrios tiene la pandilla de cada uno (para el +2% de plata por barrio) */
      for (const r of rows.values()) { const g = gangOf(r.state); r.state.turf = g ? map.owned[g] : 0; }
      for (const r of rows.values()) catchUp(r.state, now);
      for (const r of rows.values()) if (r.state.coop) await coopProgress(q, r.state.coop.id, rows, now);
      const out = await fn(q, rows, now);
      for (const r of rows.values()) { await territory.drain(q, r.state, now); await saveRow(q, r.id, r.state); }
      return out;
    }));
  }
  /* el compañero de misión de a dos, para bloquearlo junto con el jugador */
  const partnerOf = (s?: PlayerState) => s?.coop?.partnerId;

  async function me(userId: number) {
    const id = await idOf(userId);
    const p = partnerOf(await peekState(id));
    return session(p ? [id, p] : [id], async (q, rows) => {
      const s = rows.get(id)!.state;
      if (s.tutDone && !s.targets.length) await fillTargets(q, id, s);
      return { id, state: s };
    });
  }

  async function act(userId: number, a: Action): Promise<{ state: PlayerState; result: ActionResult }> {
    const id = await idOf(userId);
    const peek = await peekState(id);
    /* pelear contra otro jugador bloquea a los dos */
    const t = a.type === "duel" ? peek?.targets[a.i] : undefined;
    const otherId = t?.kind === "player" ? t.id : a.type === "chase" && Number.isInteger(a.id) && a.id !== id ? a.id : null;
    const ids = [id, ...(otherId ? [otherId] : []), ...(partnerOf(peek) ? [partnerOf(peek)!] : [])];

    return session(ids, async (q, rows, now) => {
      const s = rows.get(id)!.state;
      let result: ActionResult;
      if (a.type === "duel" && otherId) {
        result = await duelPlayer(q, id, s, a.i, rows.get(otherId), now);
      } else if (a.type === "chase") {
        result = otherId ? await chase(q, id, s, rows.get(otherId), a.mode, now) : { error: "Ese jugador ya no está." };
      } else {
        const wasChase = s.busy?.kind === "caza";
        result = applyAction(s, a, { now, rng });
        if (!result.error && a.type === "mstart") await findCrossing(q, id, s, now);
        if (!result.error && a.type === "cancel" && wasChase) await q.query(`UPDATE chases SET resolved = true WHERE attacker_id = $1 AND kind = 'caza' AND NOT resolved`, [id]);
        if (!result.error && (a.type === "scout" || a.type === "claimTut" || (a.type === "duel" && !s.targets.length))) await fillTargets(q, id, s);
      }
      return { state: s, result };
    });
  }

  async function duelPlayer(q: Queryable, id: number, s: PlayerState, i: number, other: Row | undefined, now: number): Promise<ActionResult> {
    const t = s.targets[i];
    const drop = () => { s.targets.splice(i, 1); };
    if (!other || t.kind !== "player") { drop(); return { error: "Ese rival ya no está." }; }
    const def = other.state;
    /* si se pasó a tu pandilla mientras tanto, ya no es rival */
    const dg = gangOf(def);
    if (dg && dg === gangOf(s)) { drop(); return { error: `${def.name} ahora es de tu pandilla.` }; }
    if (def.hp < maxHp(def) * MIN_HP_TO_FIGHT || def.busy?.kind === "guardia") { drop(); return { error: `${def.name} está internado en la guardia. Buscá a otro.` }; }
    const err = checkDuel(s, i);
    if (err) return { error: err };
    drop();
    const goldBefore = def.gold;
    const result = pvp(s, def, { now, rng });
    await q.query(`INSERT INTO pvp_log (attacker_id, defender_id, attacker_won, gold) VALUES ($1, $2, $3, $4)`,
      [id, other.id, result.fight!.won, goldBefore - def.gold]);
    if (!s.targets.length) await fillTargets(q, id, s);
    notify(other.id, { type: "attacked", by: s.name, won: !result.fight!.won });
    return result;
  }

  /* Salir a cruzar a alguien desde el mapa: si lo alcanzás, la pelea queda agendada para cuando se crucen */
  async function chase(q: Queryable, id: number, s: PlayerState, other: Row | undefined, mode: unknown, now: number): Promise<ActionResult> {
    if (!other) return { error: "Ese jugador ya no está." };
    const def = other.state;
    const err = canAmbush(s, def, now);
    if (err) return { error: err };
    if (typeof mode !== "string" || !chaseModes(s).includes(mode as never)) return { error: "No podés ir así." };
    const recent = await q.query(`SELECT 1 FROM pvp_log WHERE attacker_id = $1 AND defender_id = $2 AND at > now() - $3 * interval '1 millisecond'`,
      [id, other.id, PVP_SAME_TARGET_EVERY]);
    if (recent.rows.length) return { error: `Ya te cruzaste con ${def.name} hace poco. Dejalo tranquilo una hora.` };
    const trip = onTrip(def.busy)!;
    const plan = planChase(s, RUTAS, trip, now, mode as never);
    if (!plan) return { error: `No llegás a cruzar a ${def.name}: va a estar lejos o de vuelta antes.` };
    if (s.gold < plan.cost) return { error: `Ir así sale ${plan.cost} y no te alcanza.` };
    startChase(s, def, other.id, plan, now);
    await q.query(`INSERT INTO chases (kind, attacker_id, target_id, meet_at, place, target_since, target_until) VALUES ('caza', $1, $2, $3, $4, $5, $6)`,
      [id, other.id, plan.meet, s.busy?.kind === "caza" ? s.busy.place : "", trip.since, trip.until]);
    chaseAdded(plan.meet);
    return {};
  }

  /* Al salir a una misión: si el recorrido se cruza con el de un rival, se agenda la pelea (la primera, nomás) */
  async function findCrossing(q: Queryable, id: number, s: PlayerState, now: number) {
    const mine = onTrip(s.busy);
    if (!mine) return;
    const r = await q.query<{ id: number; state: PlayerState }>(
      `SELECT id, state FROM players WHERE id <> $1 AND state->'busy'->>'kind' = 'mision' AND jsonb_typeof(state->'busy'->'trip') = 'object'
          AND (state->'busy'->>'until')::bigint > $2 AND lvl BETWEEN $3 AND $4 LIMIT 60`, [id, now, s.lvl - CROSS_LVL_GAP, s.lvl + CROSS_LVL_GAP]);
    let best: { at: number; other: number; since: number; until: number } | null = null;
    for (const o of r.rows) {
      const theirs = onTrip(o.state.busy);
      if (!theirs || !rivals(s, o.state)) continue;
      const at = firstCrossing(RUTAS, mine, theirs, now + 30_000);
      if (at && (!best || at < best.at)) best = { at, other: o.id, since: theirs.since, until: theirs.until };
    }
    if (!best) return;
    const pos = tripPos(RUTAS, mine, best.at);
    await q.query(`INSERT INTO chases (kind, attacker_id, target_id, meet_at, place, target_since, target_until, attacker_since) VALUES ('cruce', $1, $2, $3, $4, $5, $6, $7)`,
      [id, best.other, best.at, pos ? nearestPlace(pos) : mine.trip.place, best.since, best.until, mine.since]);
    chaseAdded(best.at);
  }

  /* Resuelve los cruces que ya pasaron (lo llama un reloj cada pocos segundos).
     Para no despertar la base de datos todo el tiempo, se acuerda en memoria de cuándo es el próximo. */
  let nextChaseAt = 0; // 0 = no sabemos: mirar la base una vez
  async function resolveChases(now = Date.now()) {
    if (now < nextChaseAt) return;
    const due = await db.query<{ id: number; kind: string; attacker_id: number; target_id: number; meet_at: string; place: string;
      target_since: string; target_until: string; attacker_since: string | null }>(
      `SELECT * FROM chases WHERE NOT resolved AND meet_at <= $1 ORDER BY meet_at LIMIT 20`, [now]);
    for (const c of due.rows) {
      await session([c.attacker_id, c.target_id], async (q, rows) => {
        const claimed = await q.query(`UPDATE chases SET resolved = true WHERE id = $1 AND NOT resolved RETURNING 1`, [c.id]);
        if (!claimed.rows.length) return;
        const a = rows.get(c.attacker_id)?.state, d = rows.get(c.target_id)?.state;
        if (!a || !d) return;
        const at = Number(c.meet_at);
        /* ¿sigue en la misma misión? (si la abandonó, no estaba ahí) */
        const still = (s: PlayerState, since: number, until: number) =>
          (s.busy?.kind === "mision" && Number(s.busy.since) === since) || (!s.busy && Date.now() >= until);
        if (!still(d, Number(c.target_since), Number(c.target_until))) {
          if (c.kind === "caza") log(a, at, `Llegaste cerca de ${c.place} y ${d.name} ya no estaba.`);
          return;
        }
        if (c.kind === "cruce" && !still(a, Number(c.attacker_since), Infinity)) return;
        if (!rivals(a, d)) return; // mientras tanto se hicieron de la misma pandilla
        const goldBefore = d.gold;
        const result = c.kind === "caza" ? ambushPlayer(a, d, { now: at, rng }, c.place) : crossFight(a, d, { now: at, rng }, c.place);
        await q.query(`INSERT INTO pvp_log (attacker_id, defender_id, attacker_won, gold) VALUES ($1, $2, $3, $4)`,
          [c.attacker_id, c.target_id, result.fight!.won, goldBefore - d.gold]);
        const f = result.fight!;
        notify(c.attacker_id, { type: "fight", fight: f, text: c.kind === "caza"
          ? (f.won ? `Alcanzaste a ${d.name} cerca de ${c.place} y le ganaste.` : `Alcanzaste a ${d.name} cerca de ${c.place}, pero te ganó.`)
          : (f.won ? `Te cruzaste con ${d.name} cerca de ${c.place} y le ganaste.` : `Te cruzaste con ${d.name} cerca de ${c.place} y te ganó.`), good: f.won });
        notify(c.target_id, { type: "fight", fight: flip(f), text: c.kind === "caza"
          ? (f.won ? `${a.name} te salió a buscar y te asaltó cerca de ${c.place}.` : `${a.name} te salió a buscar y lo rechazaste.`)
          : (f.won ? `Te cruzaste con ${a.name} cerca de ${c.place} y te ganó.` : `Te cruzaste con ${a.name} cerca de ${c.place} y le ganaste.`), good: !f.won });
      }).catch(() => {});
    }
    const pending = await db.query<{ at: string | null }>(`SELECT min(meet_at) AS at FROM chases WHERE NOT resolved`);
    nextChaseAt = pending.rows[0]?.at ? Number(pending.rows[0].at) : Infinity;
  }
  const chaseAdded = (at: number) => { nextChaseAt = Math.min(nextChaseAt, at); };

  /* Quién está en una misión ahora (para verlos en el mapa). No dice qué misión es: solo a dónde va y cómo. */
  async function travelers(userId: number) {
    const id = await idOf(userId);
    const now = Date.now();
    const r = await db.query<{ id: number; name: string; lvl: number; side: Gang | null; avatar: number | null; bot: boolean; busy: NonNullable<PlayerState["busy"]> }>(
      `SELECT id, name, lvl, side, bot, (state->>'avatar')::int AS avatar, state->'busy' AS busy FROM players
        WHERE id <> $1 AND (state->'busy'->>'until')::bigint > $2
          AND ((state->'busy'->>'kind' = 'mision' AND jsonb_typeof(state->'busy'->'trip') = 'object') OR state->'busy'->>'kind' = 'caza')
        ORDER BY (state->'busy'->>'since')::bigint DESC LIMIT 40`, [id, now]);
    return {
      now,
      people: r.rows.flatMap((p): TravelerView[] => {
        const base = { id: p.id, name: p.name, lvl: p.lvl, gang: p.side, avatar: p.avatar ?? 1, bot: p.bot, since: Number(p.busy.since), until: Number(p.busy.until) };
        if (p.busy.kind === "mision" && p.busy.trip)
          return [{ ...base, trip: { mode: p.busy.trip.mode, place: p.busy.trip.place, go: p.busy.trip.go, back: p.busy.trip.back } }];
        if (p.busy.kind === "caza")
          return [{ ...base, chase: { meet: Number(p.busy.meet), from: p.busy.from, at: p.busy.at, targetName: p.busy.targetName } }];
        return [];
      })
    };
  }

  /* ---------- misiones de a dos ---------- */
  /* Avanza una misión de a dos: si los dos están libres, arranca; si está en curso, resuelve las etapas que ya pasaron */
  async function coopProgress(q: Queryable, coopId: number, rows: Map<number, Row>, now: number) {
    const c = (await q.query<CoopRow>(`SELECT * FROM coop WHERE id = $1 FOR UPDATE`, [coopId])).rows[0];
    const host = rows.get(c?.host_id ?? -1)?.state, guest = rows.get(c?.guest_id ?? -1)?.state;
    if (!c || !host || !guest) return;
    if (c.status !== "waiting" && c.status !== "running") {
      for (const s of [host, guest]) if (s.coop?.id === c.id) s.coop = null;
      return;
    }
    const m = c.mission, pair: [PlayerState, PlayerState][] = [[host, guest], [guest, host]];
    if (c.status === "waiting") {
      if (host.busy || guest.busy) return; // se espera a que los dos terminen lo que están haciendo
      const since = now, until = coopUntil(now);
      for (const [s, o] of pair) {
        s.busy = { kind: "mision", id: m.id, since, until, done: 0, ok: 0, res: [] };
        if (s.coop) s.coop.status = "running";
        log(s, now, `Arrancó «${m.title}» con ${o.name}. Vuelven en ${Math.round((until - since) / 60_000)} min.`, "gold");
      }
      c.status = "running"; c.since = String(since); c.until = String(until);
      for (const id of [c.host_id, c.guest_id]) notify(id, { type: "coop", what: "start" });
    }
    const since = Number(c.since), until = Number(c.until), n = m.steps.length;
    while (c.done < n && now >= coopStepAt(since, until, n, c.done)) {
      const at = coopStepAt(since, until, n, c.done), st = m.steps[c.done];
      const r = resolveCoopStep(host, guest, st, rng);
      c.done++; if (r.ok) c.ok++;
      const text = st.fight ? (r.ok ? st.win : st.lose) : r.ok ? st.ok : st.ko;
      for (const s of [host, guest]) {
        if (s.busy?.kind === "mision") { s.busy.done = c.done; s.busy.ok = c.ok; (s.busy.res ??= []).push(r.ok); }
        log(s, at, `«${m.title}» · ${r.who && r.who !== "los dos" ? `${r.who}: ` : ""}${text ?? ""}`, r.ok ? undefined : "bad");
      }
    }
    if (c.done >= n) {
      for (const [s, o] of pair) { s.busy = null; s.coop = null; finishCoop(s, m, c.ok, until, o.name); }
      c.status = "done";
      for (const id of [c.host_id, c.guest_id]) notify(id, { type: "coop", what: "done" });
    }
    await q.query(`UPDATE coop SET status = $2, since = $3, until = $4, done = $5, ok = $6 WHERE id = $1`,
      [c.id, c.status, c.since, c.until, c.done, c.ok]);
  }

  async function areFriends(q: Queryable, a: number, b: number) {
    const r = await q.query(`SELECT 1 FROM friends WHERE accepted AND ((a_id = $1 AND b_id = $2) OR (a_id = $2 AND b_id = $1))`, [a, b]);
    return r.rows.length > 0;
  }

  /* Lo que muestra la pestaña Amigos */
  async function friends(userId: number) {
    const id = await idOf(userId);
    const r = await db.query<{ a_id: number; b_id: number; accepted: boolean; id: number; name: string; lvl: number; side: Gang | null; avatar: number | null; bot: boolean }>(
      `SELECT f.a_id, f.b_id, f.accepted, p.id, p.name, p.lvl, p.side, p.bot, (p.state->>'avatar')::int AS avatar
         FROM friends f JOIN players p ON p.id = CASE WHEN f.a_id = $1 THEN f.b_id ELSE f.a_id END
        WHERE f.a_id = $1 OR f.b_id = $1 ORDER BY p.name`, [id]);
    const person = (x: typeof r.rows[number]) => ({ id: x.id, name: x.name, lvl: x.lvl, gang: x.side, avatar: x.avatar ?? 1, online: isOnline(x.id), bot: x.bot });
    const invites = await db.query<{ id: number; name: string; mission: Mission; host_id: number }>(
      `SELECT c.id, p.name, c.mission, c.host_id FROM coop c JOIN players p ON p.id = c.host_id
        WHERE c.guest_id = $1 AND c.status = 'invited' ORDER BY c.created_at DESC`, [id]);
    const sent = await db.query<{ id: number; name: string; mission: Mission }>(
      `SELECT c.id, p.name, c.mission FROM coop c JOIN players p ON p.id = c.guest_id
        WHERE c.host_id = $1 AND c.status = 'invited' ORDER BY c.created_at DESC`, [id]);
    return {
      friends: r.rows.filter(x => x.accepted).map(person),
      incoming: r.rows.filter(x => !x.accepted && x.b_id === id).map(person),
      outgoing: r.rows.filter(x => !x.accepted && x.a_id === id).map(person),
      invites: invites.rows.map(x => ({ id: x.id, from: x.name, mission: x.mission })),
      sent: sent.rows.map(x => ({ id: x.id, to: x.name, mission: x.mission }))
    };
  }

  async function addFriend(userId: number, name: unknown) {
    const id = await idOf(userId);
    if (typeof name !== "string" || !name.trim()) throw new GameError("Escribí el nombre de tu amigo.");
    const other = (await db.query<{ id: number }>(`SELECT id FROM players WHERE lower(name) = lower($1)`, [name.trim()])).rows[0];
    if (!other) throw new GameError("No hay nadie con ese nombre en Maires.");
    if (other.id === id) throw new GameError("No podés ser tu propio amigo (bueno, sí, pero no acá).");
    return db.tx(async q => {
      const back = await q.query(`SELECT accepted FROM friends WHERE a_id = $1 AND b_id = $2`, [other.id, id]);
      if (back.rows.length) { // ya te había pedido: queda aceptado
        await q.query(`UPDATE friends SET accepted = true WHERE a_id = $1 AND b_id = $2`, [other.id, id]);
        notify(other.id, { type: "friend", what: "accepted" });
        return { ok: true, accepted: true };
      }
      await q.query(`INSERT INTO friends (a_id, b_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, other.id]);
      notify(other.id, { type: "friend", what: "request" });
      return { ok: true, accepted: false };
    });
  }
  async function acceptFriend(userId: number, otherId: number) {
    const id = await idOf(userId);
    const r = await db.query(`UPDATE friends SET accepted = true WHERE a_id = $1 AND b_id = $2 RETURNING 1`, [otherId, id]);
    if (!r.rows.length) throw new GameError("Esa solicitud ya no está.");
    notify(otherId, { type: "friend", what: "accepted" });
    return { ok: true };
  }
  async function removeFriend(userId: number, otherId: number) {
    const id = await idOf(userId);
    await db.query(`DELETE FROM friends WHERE (a_id = $1 AND b_id = $2) OR (a_id = $2 AND b_id = $1)`, [id, otherId]);
    return { ok: true };
  }

  /* Invitar a un amigo: la misión se arma para el nivel de los dos, de tu pandilla (o de una al azar si andás suelto) */
  async function coopInvite(userId: number, friendId: number) {
    const id = await idOf(userId);
    return session([id, friendId], async (q, rows) => {
      const s = rows.get(id)?.state, f = rows.get(friendId)?.state;
      if (!s || !f || !(await areFriends(q, id, friendId))) throw new GameError("Solo podés invitar a tus amigos.");
      if (!s.tutDone || !f.tutDone) throw new GameError("Los dos tienen que haber terminado el tutorial.");
      if (s.coop) throw new GameError("Ya tenés una misión de a dos.");
      const pending = await q.query(`SELECT 1 FROM coop WHERE host_id = $1 AND status = 'invited'`, [id]);
      if (pending.rows.length) throw new GameError("Ya tenés una invitación esperando respuesta.");
      const c = await q.query<{ id: number }>(`INSERT INTO coop (host_id, guest_id, mission) VALUES ($1, $2, '{}') RETURNING id`, [id, friendId]);
      const m = coopMission(rng, Math.round((s.lvl + f.lvl) / 2), gangOf(s) ?? pick(rng, GANG_KEYS), c.rows[0].id);
      await q.query(`UPDATE coop SET mission = $2 WHERE id = $1`, [c.rows[0].id, JSON.stringify(m)]);
      notify(friendId, { type: "coop", what: "invite", from: s.name });
      return { ok: true, mission: m };
    });
  }

  /* Responder una invitación. Al aceptar se cobra la energía a los dos y la misión arranca cuando estén libres. */
  async function coopRespond(userId: number, coopId: number, accept: boolean) {
    const id = await idOf(userId);
    const c0 = (await db.query<CoopRow>(`SELECT * FROM coop WHERE id = $1`, [coopId])).rows[0];
    if (!c0 || c0.guest_id !== id || c0.status !== "invited") throw new GameError("Esa invitación ya no está.");
    return session([c0.host_id, id], async (q, rows, now) => {
      const host = rows.get(c0.host_id)!.state, guest = rows.get(id)!.state;
      if (!accept) {
        await q.query(`UPDATE coop SET status = 'declined' WHERE id = $1`, [coopId]);
        log(host, now, `${guest.name} no puede sumarse a «${c0.mission.title}».`);
        notify(c0.host_id, { type: "coop", what: "declined" });
        return { ok: true };
      }
      if (host.coop || guest.coop) throw new GameError("Alguno de los dos ya está en otra misión de a dos.");
      for (const s of [host, guest]) {
        if (s.energy < COOP_ENERGY) throw new GameError(`${s === guest ? "Te faltan" : `A ${host.name} le faltan`} ${COOP_ENERGY} de energía.`);
      }
      for (const [s, o, oid] of [[host, guest, id], [guest, host, c0.host_id]] as const) {
        s.energy -= COOP_ENERGY;
        s.coop = { id: coopId, partner: o.name, partnerId: oid, mission: c0.mission, status: "waiting" };
        log(s, now, `«${c0.mission.title}» con ${o.name}: arranca apenas estén libres los dos.`, "gold");
      }
      await q.query(`UPDATE coop SET status = 'waiting' WHERE id = $1`, [coopId]);
      await coopProgress(q, coopId, rows, now);
      notify(c0.host_id, { type: "coop", what: "accepted" });
      return { ok: true };
    });
  }

  /* Cancelar: antes de arrancar se devuelve la energía; en curso, la misión se cae para los dos */
  async function coopCancel(userId: number, coopId: number) {
    const id = await idOf(userId);
    const c0 = (await db.query<CoopRow>(`SELECT * FROM coop WHERE id = $1`, [coopId])).rows[0];
    if (!c0 || (c0.host_id !== id && c0.guest_id !== id)) throw new GameError("Esa misión no es tuya.");
    return session([c0.host_id, c0.guest_id], async (q, rows, now) => {
      const c = (await q.query<CoopRow>(`SELECT * FROM coop WHERE id = $1 FOR UPDATE`, [coopId])).rows[0];
      if (!["invited", "waiting", "running"].includes(c.status)) return { ok: true };
      const me = rows.get(id)!.state;
      for (const r of rows.values()) {
        const s = r.state;
        if (s.coop?.id !== coopId) continue;
        if (c.status === "waiting") s.energy = Math.min(energyMax(s) + COOP_ENERGY, s.energy + COOP_ENERGY);
        if (c.status === "running" && s.busy?.kind === "mision") s.busy = null;
        s.coop = null;
        log(s, now, c.status === "running" ? `«${c.mission.title}» se cayó: ${me.name} la abandonó.` : `«${c.mission.title}» se canceló.`, "bad");
      }
      await q.query(`UPDATE coop SET status = 'cancelled' WHERE id = $1`, [coopId]);
      notify(id === c.host_id ? c.guest_id : c.host_id, { type: "coop", what: "cancelled" });
      return { ok: true };
    });
  }

  /* Ranking: jugadores reales y los personajes de siempre, para que la ciudad no se vea vacía */
  async function ranking(myId?: number) {
    const r = await db.query<{ id: number; name: string; side: Gang | null; respect: number; lvl: number; bot: boolean }>(
      `SELECT id, name, side, respect, lvl, bot FROM players WHERE (state->>'tutDone')::boolean ORDER BY respect DESC, lvl DESC LIMIT 100`);
    const rows = [
      ...r.rows.map(p => ({ name: p.name, gang: p.side, resp: p.respect, lvl: p.lvl, me: p.id === myId, npc: false, bot: p.bot })),
      ...RIVALS.map(([name, gang, resp, lvl]) => ({ name, gang: gang as Gang | null, resp, lvl, me: false, npc: true }))
    ];
    return rows.sort((a, b) => b.resp - a.resp);
  }

  /* cambiar el estado de un jugador desde afuera (torneo del Ring): con candado y guardado como siempre */
  const touch = (playerId: number, fn: (s: PlayerState, now: number) => void) =>
    session([playerId], async (_q, rows, now) => { const r = rows.get(playerId); if (r) fn(r.state, now); });

  return { me, act, ranking, travelers, resolveChases, idOf, touch, territory: () => territory.snapshot(), friends, addFriend, acceptFriend, removeFriend, coopInvite, coopRespond, coopCancel };
}
