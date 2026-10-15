/* Jugadores de prueba ya con el tutorial hecho y bando elegido, para probar La calle.
   Contraseña de todos: prueba123. Solo se usa en desarrollo (POST /api/dev/seed, o `npm run seed`). */
import { maxHp, newPlayer, type Gang } from "@pop/shared";
import type { Db } from "./db.js";
import { hashPassword } from "./auth.js";

/* [nombre, pandilla, nivel] */
const PEOPLE: [string, Gang, number][] = [
  ["Cabo Prueba", "sindicato", 6], ["Agente Test", "barra", 8],
  ["Rata Prueba", "familia", 6], ["Turca Test", "amarillos", 7]
];

export async function seedTestPlayers(db: Db) {
  const hash = await hashPassword("prueba123");
  const created: string[] = [];
  for (const [name, gang, lvl] of PEOPLE) {
    const exists = await db.query(`SELECT 1 FROM users WHERE lower(username) = lower($1)`, [name]);
    if (exists.rows.length) continue;
    const s = newPlayer(name, Date.now(), 1 + PEOPLE.findIndex(p => p[0] === name) % 4);
    Object.assign(s, {
      lvl, gold: 400, tut: 6, tutDone: true, respect: 60,
      tabs: ["laburos", "gimnasio", "feria", "ring", "guardia", "misiones", "calle", "casa", "ranking"],
      stats: { fue: 1 + Math.round(lvl * 1.4), dur: 1 + Math.round(lvl * 1.4), ref: 1 + Math.round(lvl * 1.4), agu: Math.round(lvl * 1.4), lab: Math.round(lvl * 1.4) },
      gear: { arma: "manopla", armadura: "gruesa" }
    });
    s.aff[gang] = 20; // ya hizo un par de cosas para su pandilla
    s.c.valija = 1; s.hp = maxHp(s);
    await db.tx(async q => {
      const u = await q.query<{ id: number }>(`INSERT INTO users (username, pass_hash) VALUES ($1, $2) RETURNING id`, [name, hash]);
      await q.query(`INSERT INTO players (user_id, name, side, lvl, respect, gold, state) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [u.rows[0].id, name, gang, lvl, s.respect, s.gold, JSON.stringify(s)]);
    });
    created.push(`${name} (${gang}, nivel ${lvl})`);
  }
  return created;
}
