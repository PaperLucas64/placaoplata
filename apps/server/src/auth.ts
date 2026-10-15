/* Cuentas: contraseñas con scrypt (viene con Node) y sesiones guardadas en la base */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Queryable } from "./db.js";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
export const SESSION_DAYS = 30;
export const COOKIE = "pop_session";

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}
export async function checkPassword(pw: string, stored: string) {
  const [, saltHex, keyHex] = stored.split("$");
  const key = await scrypt(pw, Buffer.from(saltHex, "hex"), 64);
  return timingSafeEqual(key, Buffer.from(keyHex, "hex"));
}

export async function createSession(q: Queryable, userId: number) {
  const token = randomBytes(32).toString("base64url");
  await q.query(`INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`, [token, userId]);
  return token;
}
export async function userFromToken(q: Queryable, token: string | undefined): Promise<number | null> {
  if (!token) return null;
  const r = await q.query<{ user_id: number }>(`SELECT user_id FROM sessions WHERE token = $1 AND expires_at > now()`, [token]);
  return r.rows[0]?.user_id ?? null;
}
export const deleteSession = (q: Queryable, token: string) => q.query(`DELETE FROM sessions WHERE token = $1`, [token]);

/* Nombre visible en el juego: letras (con acentos), números, espacios, guion bajo */
export function validUsername(u: unknown): u is string {
  return typeof u === "string" && /^[\p{L}\p{N}_ ]{3,20}$/u.test(u) && u.trim() === u;
}
export const validPassword = (p: unknown): p is string => typeof p === "string" && p.length >= 6 && p.length <= 200;
