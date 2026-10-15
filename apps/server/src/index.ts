import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import type { WebSocket } from "ws";
import { newPlayer, type Action } from "@pop/shared";
import { openDb } from "./db.js";
import { checkPassword, COOKIE, createSession, deleteSession, hashPassword, SESSION_DAYS, userFromToken, validPassword, validUsername } from "./auth.js";
import { GameError, makeGame } from "./game.js";
import { makeRing } from "./ring.js";
import { ensureBots, makeBots } from "./bots.js";
import { seedTestPlayers } from "./seed.js";

const PROD = process.env.NODE_ENV === "production";
/* en desarrollo siempre 3000 (Vite apunta ahí); en producción, el puerto que da el hosting */
const PORT = Number(process.env.API_PORT ?? (PROD ? process.env.PORT : undefined) ?? 3000);

if (PROD && !process.env.DATABASE_URL) throw new Error("En producción hace falta DATABASE_URL (Postgres).");
const db = await openDb();
/* trustProxy: en Render el pedido llega a través de su proxy; así req.ip es la del jugador (límite de intentos de login) */
const app = Fastify({ logger: { level: PROD ? "info" : "warn" }, trustProxy: PROD });
await app.register(cookie);
/* si la pantalla vive en otro sitio (p. ej. cinectomia.com/juego), WEB_ORIGIN la habilita: "https://cinectomia.com" */
if (process.env.WEB_ORIGIN) await app.register(cors, { origin: process.env.WEB_ORIGIN.split(","), credentials: true });
await app.register(rateLimit, { global: false });
await app.register(websocket);

/* avisos en vivo: cada jugador puede tener varias pestañas abiertas */
const sockets = new Map<number, Set<WebSocket>>();
const notify = (playerId: number, msg: unknown) => {
  for (const ws of sockets.get(playerId) ?? []) ws.send(JSON.stringify(msg));
};
/* en línea: con la pantalla abierta, o un vecino que juega solo y está despierto */
let botAwake = (_id: number) => false;
let botsAwake = () => 0;
const game = makeGame(db, notify, playerId => (sockets.get(playerId)?.size ?? 0) > 0 || botAwake(playerId));

/* errores del juego (reglas): se muestran al jugador tal cual */
app.setErrorHandler((err, _req, reply) => {
  if (err instanceof GameError) return reply.code(400).send({ error: err.message });
  app.log.error(err);
  const e = err as { statusCode?: number; message?: string };
  reply.code(e.statusCode ?? 500).send({ error: e.statusCode && e.statusCode < 500 ? e.message : "Algo salió mal en el servidor." });
});

const cookieOpts = { path: "/", httpOnly: true, sameSite: "lax" as const, secure: PROD, maxAge: SESSION_DAYS * 86400 };
const authLimit = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

async function requireUser(req: any, reply: any): Promise<number | null> {
  const uid = await userFromToken(db, req.cookies[COOKIE]);
  if (!uid) { reply.code(401).send({ error: "Tenés que entrar con tu cuenta." }); return null; }
  return uid;
}

/* Chequeo de salud para Render y UptimeRobot. No toca la base a propósito: si la consultara cada pocos segundos,
   Neon no se apagaría nunca y se gastarían las horas gratis del mes. La base se prende sola cuando alguien juega. */
app.get("/api/health", async () => ({ ok: true }));

app.post("/api/auth/register", authLimit, async (req, reply) => {
  const { username, password, avatar } = (req.body ?? {}) as Record<string, unknown>;
  if (!validUsername(username)) return reply.code(400).send({ error: "El nombre va de 3 a 20 letras, números o espacios." });
  if (!validPassword(password)) return reply.code(400).send({ error: "La contraseña necesita al menos 6 caracteres." });
  const taken = await db.query(`SELECT 1 FROM users WHERE lower(username) = lower($1)`, [username]);
  if (taken.rows.length) return reply.code(409).send({ error: "Ese nombre ya está en uso en Maires." });
  const hash = await hashPassword(password);
  const token = await db.tx(async q => {
    const u = await q.query<{ id: number }>(`INSERT INTO users (username, pass_hash) VALUES ($1, $2) RETURNING id`, [username, hash]);
    const id = u.rows[0].id;
    const s = newPlayer(username, Date.now(), [1, 2, 3, 4].includes(avatar as number) ? avatar as number : 1);
    await q.query(`INSERT INTO players (user_id, name, gold, state) VALUES ($1, $2, $3, $4)`, [id, username, s.gold, JSON.stringify(s)]);
    return createSession(q, id);
  });
  reply.setCookie(COOKIE, token, cookieOpts).send({ ok: true });
});

app.post("/api/auth/login", authLimit, async (req, reply) => {
  const { username, password } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof username !== "string" || typeof password !== "string") return reply.code(400).send({ error: "Faltan datos." });
  const r = await db.query<{ id: number; pass_hash: string }>(`SELECT id, pass_hash FROM users WHERE lower(username) = lower($1)`, [username]);
  const u = r.rows[0];
  if (!u || !(await checkPassword(password, u.pass_hash))) return reply.code(401).send({ error: "Usuario o contraseña incorrectos." });
  reply.setCookie(COOKIE, await createSession(db, u.id), cookieOpts).send({ ok: true });
});

app.post("/api/auth/logout", async (req, reply) => {
  const t = req.cookies[COOKIE];
  if (t) await deleteSession(db, t);
  reply.clearCookie(COOKIE, { path: "/" }).send({ ok: true });
});

app.get("/api/me", async (req, reply) => {
  const uid = await requireUser(req, reply); if (!uid) return;
  const { id, state } = await game.me(uid);
  return { id, state, now: Date.now() };
});

app.post("/api/action", async (req, reply) => {
  const uid = await requireUser(req, reply); if (!uid) return;
  const a = req.body as Action;
  if (!a || typeof a !== "object" || typeof a.type !== "string") return reply.code(400).send({ error: "Acción inválida." });
  const { state, result } = await game.act(uid, a);
  return { state, result, now: Date.now() };
});

app.get("/api/territory", async (req, reply) => {
  const uid = await requireUser(req, reply); if (!uid) return;
  const t = await game.territory();
  return { map: t.map, owned: t.owned };
});

/* ---------- torneo del Ring ---------- */
const ring = makeRing(db, game.touch, notify);
app.get("/api/ring", async (req, reply) => {
  const uid = await requireUser(req, reply); if (!uid) return;
  return ring.view(await game.idOf(uid));
});
app.post("/api/ring/join", async (req, reply) => {
  const uid = await requireUser(req, reply); if (!uid) return;
  return ring.join(await game.idOf(uid));
});
/* las rondas se juegan solas: se revisa cada 5 minutos si toca alguna */
const ringTimer = setInterval(() => ring.process().catch(e => app.log.error(e)), 5 * 60_000);

/* ---------- cruces en el mapa y vecinos que juegan solos ---------- */
const chaseTimer = setInterval(() => game.resolveChases().catch(e => app.log.error(e)), 10_000);
let botTimer: ReturnType<typeof setInterval> | null = null;
if (process.env.BOTS !== "0") {
  await ensureBots(db);
  const bots = makeBots(db, game, ring);
  botAwake = bots.isAwake;
  botsAwake = bots.awakeCount;
  botTimer = setInterval(() => bots.tick().catch(e => app.log.error(e)), 60_000);
  setTimeout(() => bots.tick().catch(e => app.log.error(e)), 5_000);
}

/* ---------- amigos y misiones de a dos ---------- */
const num = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : NaN);
app.get("/api/friends", async (req, reply) => {
  const uid = await requireUser(req, reply); if (!uid) return;
  return game.friends(uid);
});
app.post("/api/friends/add", async (req, reply) => {
  const uid = await requireUser(req, reply); if (!uid) return;
  return game.addFriend(uid, (req.body as { name?: unknown })?.name);
});
app.post("/api/friends/accept", async (req, reply) => {
  const uid = await requireUser(req, reply); if (!uid) return;
  return game.acceptFriend(uid, num((req.body as { id?: unknown })?.id));
});
app.post("/api/friends/remove", async (req, reply) => {
  const uid = await requireUser(req, reply); if (!uid) return;
  return game.removeFriend(uid, num((req.body as { id?: unknown })?.id));
});
app.post("/api/coop/invite", async (req, reply) => {
  const uid = await requireUser(req, reply); if (!uid) return;
  return game.coopInvite(uid, num((req.body as { friendId?: unknown })?.friendId));
});
app.post("/api/coop/respond", async (req, reply) => {
  const uid = await requireUser(req, reply); if (!uid) return;
  const b = (req.body ?? {}) as { id?: unknown; accept?: unknown };
  return game.coopRespond(uid, num(b.id), b.accept === true);
});
app.post("/api/coop/cancel", async (req, reply) => {
  const uid = await requireUser(req, reply); if (!uid) return;
  return game.coopCancel(uid, num((req.body as { id?: unknown })?.id));
});

/* quién está en una misión ahora, para el mapa */
app.get("/api/travelers", async (req, reply) => {
  const uid = await requireUser(req, reply); if (!uid) return;
  /* cuántos hay en línea: con la pantalla abierta, más los vecinos despiertos */
  let online = 0;
  for (const set of sockets.values()) if (set.size) online++;
  return { ...(await game.travelers(uid)), online: online + botsAwake() };
});

app.get("/api/ranking", async (req, reply) => {
  const uid = await requireUser(req, reply); if (!uid) return;
  const { id } = await game.me(uid);
  return game.ranking(id);
});

app.get("/api/ws", { websocket: true }, async (socket, req) => {
  const uid = await userFromToken(db, req.cookies[COOKIE]);
  if (!uid) { socket.close(4001, "sin sesión"); return; }
  const { id } = await game.me(uid);
  if (!sockets.has(id)) sockets.set(id, new Set());
  sockets.get(id)!.add(socket);
  socket.on("close", () => { sockets.get(id)?.delete(socket); if (!sockets.get(id)?.size) sockets.delete(id); });
});

/* en producción el mismo servidor entrega la pantalla ya compilada */
const web = resolve(fileURLToPath(import.meta.url), "../../../web/dist");
if (existsSync(web)) {
  await app.register(fastifyStatic, { root: web });
  app.setNotFoundHandler((req, reply) => req.url.startsWith("/api") ? reply.code(404).send({ error: "No existe." }) : reply.sendFile("index.html"));
}

/* solo en desarrollo y desde la misma compu: crear jugadores de prueba (npm run seed) */
if (!PROD) app.post("/api/dev/seed", async (req, reply) => {
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.ip)) return reply.code(403).send({ error: "Solo local." });
  return { created: await seedTestPlayers(db) };
});
if (!PROD) app.post("/api/dev/ring-round", async (req, reply) => {
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.ip)) return reply.code(403).send({ error: "Solo local." });
  return ring.playNextNow();
});

await app.listen({ port: PORT, host: "0.0.0.0" });
console.log(`Maires escuchando en http://localhost:${PORT}`);

/* Cierre ordenado: termina las peticiones en curso y cierra la base sin dejarla a medio escribir.
   En producción llega SIGTERM; en desarrollo, el mensaje "shutdown" de tools/devserver.ts. */
let closing = false;
export async function shutdown() {
  if (closing) return; closing = true;
  clearInterval(ringTimer); clearInterval(chaseTimer); if (botTimer) clearInterval(botTimer);
  for (const set of sockets.values()) for (const ws of set) ws.close(1012, "reiniciando");
  await app.close();
  await db.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.on("message", m => { if (m === "shutdown") shutdown(); });
