import Fastify from "fastify";
import cookie from "@fastify/cookie";
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
import { makeGame } from "./game.js";

const PROD = process.env.NODE_ENV === "production";
/* en desarrollo siempre 3000 (Vite apunta ahí); en producción, el puerto que da el hosting */
const PORT = Number(process.env.API_PORT ?? (PROD ? process.env.PORT : undefined) ?? 3000);

const db = await openDb();
const app = Fastify({ logger: { level: PROD ? "info" : "warn" } });
await app.register(cookie);
await app.register(rateLimit, { global: false });
await app.register(websocket);

/* avisos en vivo: cada jugador puede tener varias pestañas abiertas */
const sockets = new Map<number, Set<WebSocket>>();
const notify = (playerId: number, msg: unknown) => {
  for (const ws of sockets.get(playerId) ?? []) ws.send(JSON.stringify(msg));
};
const game = makeGame(db, notify);

const cookieOpts = { path: "/", httpOnly: true, sameSite: "lax" as const, secure: PROD, maxAge: SESSION_DAYS * 86400 };
const authLimit = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

async function requireUser(req: any, reply: any): Promise<number | null> {
  const uid = await userFromToken(db, req.cookies[COOKIE]);
  if (!uid) { reply.code(401).send({ error: "Tenés que entrar con tu cuenta." }); return null; }
  return uid;
}

app.post("/api/auth/register", authLimit, async (req, reply) => {
  const { username, password } = (req.body ?? {}) as Record<string, unknown>;
  if (!validUsername(username)) return reply.code(400).send({ error: "El nombre va de 3 a 20 letras, números o espacios." });
  if (!validPassword(password)) return reply.code(400).send({ error: "La contraseña necesita al menos 6 caracteres." });
  const taken = await db.query(`SELECT 1 FROM users WHERE lower(username) = lower($1)`, [username]);
  if (taken.rows.length) return reply.code(409).send({ error: "Ese nombre ya está en uso en Bahía Gris." });
  const hash = await hashPassword(password);
  const token = await db.tx(async q => {
    const u = await q.query<{ id: number }>(`INSERT INTO users (username, pass_hash) VALUES ($1, $2) RETURNING id`, [username, hash]);
    const id = u.rows[0].id;
    const s = newPlayer(username, Date.now());
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

await app.listen({ port: PORT, host: "0.0.0.0" });
console.log(`Placa o Plata escuchando en http://localhost:${PORT}`);
