/* El chat de la ciudad: un solo canal para todos los jugadores. Los mensajes llegan en vivo por el aviso del jugador
   (WebSocket) y se guardan los últimos para que el que entra vea de qué se viene hablando. Los vecinos-bot no hablan. */
import { gangOf, type PlayerState } from "@pop/shared";
import type { Db } from "./db.js";
import { isBlocked } from "./moderation.js";

export const CHAT_MAX = 280;              // largo máximo de un mensaje
const KEEP = 500;                         // cuántos mensajes se guardan
const HISTORY = 80;                       // cuántos ve el que abre el chat
const GAP_MS = 2_000;                     // entre un mensaje y el siguiente
const BURST = 8, BURST_MS = 60_000;       // y no más de 8 por minuto

export interface ChatMsg { id: number; t: number; pid: number; name: string; gang: string | null; msg: string; me?: boolean }

export class ChatError extends Error {}

export function makeChat(db: Db, broadcast: (msg: unknown) => void) {
  const recent = new Map<number, number[]>(); // cuándo habló cada uno (para frenar al que inunda)
  let sinceTrim = 0;

  async function history(playerId: number): Promise<ChatMsg[]> {
    const r = await db.query<{ id: number; t: string; name: string; gang: string | null; msg: string; player_id: number }>(
      `SELECT id, t, name, gang, msg, player_id FROM chat ORDER BY id DESC LIMIT ${HISTORY}`);
    return r.rows.reverse().map(x => ({ id: x.id, t: Number(x.t), pid: x.player_id, name: x.name, gang: x.gang, msg: x.msg, ...(x.player_id === playerId ? { me: true } : {}) }));
  }

  async function say(playerId: number, raw: unknown): Promise<ChatMsg> {
    if (typeof raw !== "string") throw new ChatError("Escribí algo.");
    const msg = raw.replace(/\s+/g, " ").trim();
    if (!msg) throw new ChatError("Escribí algo.");
    if (msg.length > CHAT_MAX) throw new ChatError(`Como mucho ${CHAT_MAX} letras.`);
    if (isBlocked(msg)) throw new ChatError("Ese mensaje no va: en Buenos Aires no se discrimina a nadie.");
    const now = Date.now();
    const times = (recent.get(playerId) ?? []).filter(t => now - t < BURST_MS);
    if (times.length && now - times[times.length - 1] < GAP_MS) throw new ChatError("Más despacio: esperá un segundo.");
    if (times.length >= BURST) throw new ChatError("Hablaste mucho seguido. Esperá un minuto.");
    const p = (await db.query<{ name: string; state: PlayerState; bot: boolean }>(`SELECT name, state, bot FROM players WHERE id = $1`, [playerId])).rows[0];
    if (!p || p.bot) throw new ChatError("No podés hablar en el chat.");
    const gang = gangOf(p.state);
    const r = await db.query<{ id: number }>(`INSERT INTO chat (t, player_id, name, gang, msg) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [now, playerId, p.name, gang, msg]);
    times.push(now); recent.set(playerId, times);
    const out: ChatMsg = { id: r.rows[0].id, t: now, pid: playerId, name: p.name, gang, msg };
    broadcast({ type: "chat", m: out });
    /* cada tanto se borran los mensajes viejos */
    if (++sinceTrim >= 50) { sinceTrim = 0; await db.query(`DELETE FROM chat WHERE id <= $1`, [out.id - KEEP]); }
    return { ...out, me: true };
  }

  return { history, say };
}
