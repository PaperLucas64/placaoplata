/* Base de datos: Postgres de verdad si hay DATABASE_URL; si no, PGlite (Postgres embebido) en .data/
   PGlite vive dentro del proceso: nunca abrir la misma carpeta desde dos procesos, y cerrar con db.close()
   (tools/devserver.ts reinicia el servidor pidiéndole que se cierre en vez de matarlo).
   Las dos se usan igual: query(sql, params) y tx(fn). */
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

export interface Queryable { query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> }
export interface Db extends Queryable { tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>; close(): Promise<void> }

const here = dirname(fileURLToPath(import.meta.url));

export async function openDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  const db = url ? await openPg(url) : await openPglite();
  await migrate(db);
  return db;
}

async function openPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = resolve(here, "../../../.data/pg");
  mkdirSync(dir, { recursive: true });
  const pg = await PGlite.create(dir);
  return {
    query: (sql, params) => pg.query(sql, params as any[]) as any,
    tx: fn => pg.transaction(t => fn({ query: (sql, params) => t.query(sql, params as any[]) as any })),
    close: () => pg.close()
  };
}

async function openPg(url: string): Promise<Db> {
  const { default: pg } = await import("pg");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const pool = new pg.Pool({
    connectionString: url,
    ssl: local ? undefined : { rejectUnauthorized: false },
    max: Number(process.env.DB_POOL_MAX ?? 10)
  });
  /* la base puede tardar unos segundos en arrancar (en desarrollo arranca al mismo tiempo que el servidor) */
  for (let i = 1; ; i++) {
    try { await pool.query("SELECT 1"); break; }
    catch (e) { if (i >= 30) throw e; await new Promise(r => setTimeout(r, 500)); }
  }
  return {
    query: (sql, params) => pool.query(sql, params as any[]) as any,
    async tx(fn) {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const r = await fn({ query: (sql, params) => c.query(sql, params as any[]) as any });
        await c.query("COMMIT");
        return r;
      } catch (e) { await c.query("ROLLBACK"); throw e; }
      finally { c.release(); }
    },
    close: () => pool.end()
  };
}

/* Migraciones: archivos NNN_nombre.sql en src/migrations, se aplican una sola vez y en orden */
async function migrate(db: Db) {
  await db.query(`CREATE TABLE IF NOT EXISTS migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await db.query<{ name: string }>(`SELECT name FROM migrations`)).rows.map(r => r.name));
  const dir = join(here, "migrations");
  for (const f of readdirSync(dir).filter(f => f.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    const sql = readFileSync(join(dir, f), "utf8");
    await db.tx(async q => {
      for (const stmt of sql.split(/;\s*$/m).map(s => s.trim()).filter(Boolean)) await q.query(stmt);
      await q.query(`INSERT INTO migrations (name) VALUES ($1)`, [f]);
    });
    console.log(`migración aplicada: ${f}`);
  }
}
