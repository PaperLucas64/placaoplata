/* Crea jugadores de prueba ya con el tutorial hecho y bando elegido, para probar La calle.
   Uso (con el servidor apagado si usás la base local): npm run seed
   Contraseña de todos: prueba123 */
import { newPlayer, maxHp, type Side } from "@pop/shared";
import { openDb } from "../apps/server/src/db.js";
import { hashPassword } from "../apps/server/src/auth.js";

const PEOPLE: [string, Side, number][] = [
  ["Cabo Prueba", "placa", 6], ["Agente Test", "placa", 8],
  ["Rata Prueba", "plata", 6], ["Turca Test", "plata", 7]
];

const db = await openDb();
const hash = await hashPassword("prueba123");
for (const [name, side, lvl] of PEOPLE) {
  const exists = await db.query(`SELECT 1 FROM users WHERE lower(username) = lower($1)`, [name]);
  if (exists.rows.length) { console.log(`ya existe: ${name}`); continue; }
  const now = Date.now();
  const s = newPlayer(name, now);
  Object.assign(s, { lvl, gold: 400, side, tut: 6, tutDone: true, respect: 20,
    tabs: ["laburos", "gimnasio", "feria", "ring", "guardia", "misiones", "calle", "ranking"],
    stats: { fue: 3 + lvl, dur: 3 + lvl, ref: 3 + lvl, agu: 2 + lvl, lab: 3 + lvl },
    gear: { arma: "bate", armadura: "casco" } });
  s.c.valija = 1; s.hp = maxHp(s);
  await db.tx(async q => {
    const u = await q.query<{ id: number }>(`INSERT INTO users (username, pass_hash) VALUES ($1, $2) RETURNING id`, [name, hash]);
    await q.query(`INSERT INTO players (user_id, name, side, lvl, respect, gold, state) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [u.rows[0].id, name, side, lvl, s.respect, s.gold, JSON.stringify(s)]);
  });
  console.log(`creado: ${name} (${side}, nivel ${lvl})`);
}
await db.close();
