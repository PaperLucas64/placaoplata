/* Torneo del Ring (temporada mensual, una ronda suiza por día). Las rondas se juegan solas:
   cada pocos minutos (y cuando alguien mira el torneo) se procesan las que ya tocaban. */
import {
  addRespect, battle, buchholz, log, money, npcBoxer, playerFighter, ringPrize, RING_MIN_ENTRANTS, roundAt, roundsIn, scaledEnemy,
  seasonEnd, seasonName, seasonOf, swissPairs, type Fighter, type PlayerState, type Rng, type SwissEntry
} from "@pop/shared";
import type { Db } from "./db.js";
import { GameError } from "./game.js";

interface Entry { id: number; season: string; player_id: number | null; npc: string | null; lvl: number; points: number; wins: number; losses: number; opponents: number[]; joined_at: string; name?: string }
type Touch = (playerId: number, fn: (s: PlayerState, now: number) => void) => Promise<unknown>;

const rng: Rng = Math.random;

export function makeRing(db: Db, touch: Touch, notify: (playerId: number, msg: unknown) => void) {
  let running = false;

  const entriesOf = async (season: string, until = Infinity) =>
    (await db.query<Entry>(`SELECT e.*, p.name FROM ring_entry e LEFT JOIN players p ON p.id = e.player_id WHERE e.season = $1`, [season]))
      .rows.filter(e => Number(e.joined_at) <= until).map(e => ({ ...e, opponents: e.opponents ?? [] }));
  const nameOf = (e: Entry) => e.npc ?? e.name ?? "?";

  async function fighterOf(e: Entry): Promise<Fighter> {
    if (e.npc) return scaledEnemy(rng, e.npc, e.lvl, 1.0);
    const s = (await db.query<{ state: PlayerState }>(`SELECT state FROM players WHERE id = $1`, [e.player_id])).rows[0].state;
    const f = playerFighter(s);
    return { ...f, hp: f.max }; // en el ring todos arrancan enteros
  }

  async function playRound(season: string, r: number) {
    const at = roundAt(season, r);
    let entries = await entriesOf(season, at);
    if (!entries.some(e => e.player_id)) return; // nadie se anotó todavía
    /* pocos inscriptos: se suman boxeadores del barrio de nivel parecido */
    const real = entries.filter(e => e.player_id);
    const avg = Math.round(real.reduce((a, e) => a + e.lvl, 0) / real.length);
    const used = new Set(entries.filter(e => e.npc).map(e => e.npc!));
    for (let k = entries.length; k < RING_MIN_ENTRANTS; k++) {
      const npc = npcBoxer(rng, used); used.add(npc);
      await db.query(`INSERT INTO ring_entry (season, npc, lvl, joined_at) VALUES ($1, $2, $3, $4)`, [season, npc, Math.max(1, avg + Math.round(rng() * 2 - 1)), at]);
    }
    entries = await entriesOf(season, at);
    const byId = new Map(entries.map(e => [e.id, e]));
    for (const [a0, b0] of swissPairs(entries as SwissEntry[], rng)) {
      const a = byId.get(a0.id)!, b = b0 ? byId.get(b0.id)! : null;
      if (!b) { // pasa de ronda
        a.points++; a.wins++;
        await db.query(`INSERT INTO ring_match (season, round, a_id, winner_id, at) VALUES ($1, $2, $3, $3, $4)`, [season, r, a.id, at]);
        if (a.player_id) await touch(a.player_id, s => log(s, at, `Torneo del Ring, ronda ${r}: te tocó pasar sin pelear. +1 punto.`, "good"));
        continue;
      }
      /* quién pega primero, al azar */
      const [first, second] = rng() < 0.5 ? [a, b] : [b, a];
      const f = battle(rng, await fighterOf(first), await fighterOf(second));
      const [win, lose] = f.won ? [first, second] : [second, first];
      win.points++; win.wins++; lose.losses++;
      a.opponents.push(b.id); b.opponents.push(a.id);
      await db.query(`INSERT INTO ring_match (season, round, a_id, b_id, winner_id, at) VALUES ($1, $2, $3, $4, $5, $6)`, [season, r, a.id, b.id, win.id, at]);
      for (const [me, other, won] of [[win, lose, true], [lose, win, false]] as const) {
        if (!me.player_id) continue;
        await touch(me.player_id, s => log(s, at, `Torneo del Ring, ronda ${r}: ${won ? `le ganaste a ${nameOf(other)}` : `perdiste con ${nameOf(other)}`}. Vas ${me.points} ${me.points === 1 ? "punto" : "puntos"}.`, won ? "good" : "bad"));
        notify(me.player_id, { type: "ring" });
      }
    }
    for (const e of entries) {
      await db.query(`UPDATE ring_entry SET points = $2, wins = $3, losses = $4, opponents = $5 WHERE id = $1`, [e.id, e.points, e.wins, e.losses, JSON.stringify(e.opponents)]);
    }
  }

  function standings(entries: Entry[]) {
    return [...entries].sort((x, y) => y.points - x.points || buchholz(y as SwissEntry, entries as SwissEntry[]) - buchholz(x as SwissEntry, entries as SwissEntry[]) || y.lvl - x.lvl);
  }

  async function close(season: string) {
    const table = standings(await entriesOf(season));
    for (const [i, e] of table.entries()) {
      if (!e.player_id) continue;
      const place = i + 1;
      await db.query(`INSERT INTO ring_history (season, player_id, place, points, entrants) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [season, e.player_id, place, e.points, table.length]);
      const prize = ringPrize(place, e.lvl);
      await touch(e.player_id, (s, now) => {
        s.gold += prize.gold; addRespect(s, now, prize.resp);
        log(s, now, `Cerró el torneo de ${seasonName(season)}: terminaste ${place}º de ${table.length}${prize.gold ? `. Premio: ${money(prize.gold)}` : ""}, +${prize.resp} de respeto.`, "gold");
      });
    }
    await db.query(`UPDATE ring_season SET closed = true WHERE season = $1`, [season]);
  }

  /* Juega las rondas que ya tocaban y cierra las temporadas terminadas */
  async function process(now = Date.now()) {
    if (running) return;
    running = true;
    try {
      const current = seasonOf(now);
      await db.query(`INSERT INTO ring_season (season) VALUES ($1) ON CONFLICT DO NOTHING`, [current]);
      const open = (await db.query<{ season: string; rounds_done: number }>(`SELECT season, rounds_done FROM ring_season WHERE NOT closed ORDER BY season`)).rows;
      for (const s of open) {
        const total = roundsIn(s.season);
        let done = s.rounds_done;
        while (done < total && roundAt(s.season, done + 1) <= now) {
          await playRound(s.season, done + 1);
          done++;
          await db.query(`UPDATE ring_season SET rounds_done = $2 WHERE season = $1`, [s.season, done]);
        }
        if (seasonEnd(s.season) <= now) await close(s.season);
      }
    } finally { running = false; }
  }

  async function join(playerId: number) {
    const s = (await db.query<{ state: PlayerState }>(`SELECT state FROM players WHERE id = $1`, [playerId])).rows[0]?.state;
    if (!s?.tutDone) throw new GameError("Primero terminá el tutorial.");
    const season = seasonOf(Date.now());
    const r = await db.query(`INSERT INTO ring_entry (season, player_id, lvl, joined_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id`,
      [season, playerId, s.lvl, Date.now()]);
    if (!r.rows.length) throw new GameError("Ya estás anotado en este torneo.");
    await touch(playerId, (st, now) => log(st, now, `Te anotaste en el torneo del Ring de ${seasonName(season)}. Se pelea una ronda por día a las 21 h.`, "gold"));
    return { ok: true };
  }

  async function view(playerId: number) {
    await process();
    const now = Date.now(), season = seasonOf(now);
    const entries = await entriesOf(season);
    const table = standings(entries).map((e, i) => ({
      place: i + 1, name: nameOf(e), npc: !!e.npc, me: e.player_id === playerId, points: e.points, wins: e.wins, losses: e.losses, lvl: e.lvl
    }));
    const done = (await db.query<{ rounds_done: number }>(`SELECT rounds_done FROM ring_season WHERE season = $1`, [season])).rows[0]?.rounds_done ?? 0;
    const myEntry = entries.find(e => e.player_id === playerId);
    const matches = myEntry ? (await db.query<{ round: number; a_id: number; b_id: number | null; winner_id: number }>(
      `SELECT round, a_id, b_id, winner_id FROM ring_match WHERE season = $1 AND (a_id = $2 OR b_id = $2) ORDER BY round`, [season, myEntry.id])).rows
      .map(m => { const o = entries.find(e => e.id === (m.a_id === myEntry.id ? m.b_id : m.a_id)); return { round: m.round, rival: o ? nameOf(o) : null, won: m.winner_id === myEntry.id }; }) : [];
    const history = (await db.query<{ season: string; place: number; points: number; entrants: number }>(
      `SELECT season, place, points, entrants FROM ring_history WHERE player_id = $1 ORDER BY season DESC`, [playerId])).rows
      .map(h => ({ ...h, name: seasonName(h.season) }));
    const champions = (await db.query<{ season: string; name: string; points: number }>(
      `SELECT h.season, p.name, h.points FROM ring_history h JOIN players p ON p.id = h.player_id WHERE h.place = 1 ORDER BY h.season DESC LIMIT 12`)).rows
      .map(c => ({ ...c, seasonName: seasonName(c.season) }));
    return {
      season, seasonName: seasonName(season), rounds: roundsIn(season), done,
      nextRoundAt: done < roundsIn(season) ? roundAt(season, done + 1) : null, closesAt: seasonEnd(season),
      joined: !!myEntry, table, matches, history, champions
    };
  }

  /* solo desarrollo: jugar ya la próxima ronda, como si fueran las 21 h */
  async function playNextNow() {
    const season = seasonOf(Date.now());
    const done = (await db.query<{ rounds_done: number }>(`SELECT rounds_done FROM ring_season WHERE season = $1`, [season])).rows[0]?.rounds_done ?? 0;
    if (done < roundsIn(season)) await process(roundAt(season, done + 1));
    return { round: done + 1 };
  }

  return { process, join, view, playNextNow };
}
