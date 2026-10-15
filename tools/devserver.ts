/* Servidor en modo desarrollo: lo reinicia cuando cambia el código, pero sin matarlo de golpe.
   Le pide que se cierre (termina lo que está haciendo y cierra la base) y recién ahí arranca otro.
   Matarlo a la fuerza en medio de una escritura rompe la base local (PGlite). */
import { fork, type ChildProcess } from "node:child_process";
import { watch } from "node:fs";

const ENTRY = "apps/server/src/index.ts";
const WATCH = ["apps/server/src", "packages/shared/src"];
let child: ChildProcess | null = null;
let timer: NodeJS.Timeout | undefined;
let stopping = false;

const start = () => { child = fork(ENTRY, [], { execArgv: ["--import", "tsx"], stdio: "inherit" }); };

function stop(): Promise<void> {
  const c = child; child = null;
  if (!c || c.exitCode !== null) return Promise.resolve();
  return new Promise(res => {
    c.once("exit", () => res());
    c.send("shutdown");
    setTimeout(() => { if (c.exitCode === null) { console.warn("[dev] el servidor no cerró a tiempo, lo corto"); c.kill(); } }, 10_000);
  });
}

for (const dir of WATCH) watch(dir, { recursive: true }, (_e, file) => {
  if (stopping || !file || !/\.(ts|sql)$/.test(String(file))) return;
  clearTimeout(timer);
  timer = setTimeout(async () => { console.log(`[dev] cambió ${file}, reiniciando…`); await stop(); start(); }, 300);
});

const quit = async () => { stopping = true; await stop(); process.exit(0); };
process.on("SIGINT", quit);
process.on("SIGTERM", quit);
process.on("SIGBREAK", quit);
start();
