/* Jugadores de prueba ya con el tutorial hecho y bando elegido, para probar La calle.
   Contraseña de todos: prueba123. Solo se usa en desarrollo (POST /api/dev/seed, o `npm run seed`). */
import { maxHp, newPlayer, type Side } from "@pop/shared";
import type { Db } from "./db.js";
import { hashPassword } from "./auth.js";

const PEOPLE: [string, Side, number][] = [
  ["Cabo Prueba", "placa", 6], ["Agente Test", "placa", 8],
  ["Rata Prueba", "plata", 6], ["Turca Test", "plata", 7]
];

export async function seedTestPlayers(db: Db) {
  const hash = await hashPassword("prueba123");
  const created: string[] = [];
  for (const [name, side, lvl] of PEOPLE) {
    const exists = await db.query(`SELECT 1 FROM users WHERE lower(username) = lower($1)`, [name]);
    if (exists.rows.length) continue;
    const s = newPlayer(name, Date.now());
    Object.assign(s, {
      lvl, gold: 400, side, tut: 6, tutDone: true, respect: 60,
      tabs: ["laburos", "gimnasio", "feria", "ring", "guardia", "misiones", "calle", "ranking"],
      stats: { fue: 1 + Math.round(lvl * 1.4), dur: 1 + Math.round(lvl * 1.4), ref: 1 + Math.round(lvl * 1.4), agu: Math.round(lvl * 1.4), lab: Math.round(lvl * 1.4) },
      gear: { arma: side === "placa" ? "tonfa" : "manopla", armadura: side === "placa" ? "reglam" : "gruesa" }
    });
    s.c.valija = 1; s.hp = maxHp(s);
    await db.tx(async q => {
      const u = await q.query<{ id: number }>(`INSERT INTO users (username, pass_hash) VALUES ($1, $2) RETURNING id`, [name, hash]);
      await q.query(`INSERT INTO players (user_id, name, side, lvl, respect, gold, state) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [u.rows[0].id, name, side, lvl, s.respect, s.gold, JSON.stringify(s)]);
    });
    created.push(`${name} (${side}, nivel ${lvl})`);
  }
  return created;
}
