/* Pruebas de la auditoría (docs/AUDITORIA.md): cada una fallaba antes del arreglo. */
import { describe, expect, it } from "vitest";
import {
  applyAction, ambushCatchUp, canStart, maxHp, newPlayer, pvp, startChase, ambushPlayer, stillOnTrip, validAction, VALIJA, log,
  ATTACK_EVERY, DUEL_COST, type Action, type PlayerState, type Rng
} from "../src/index.js";

const seeded = (seed: number): Rng => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const T0 = 1_000_000;
const ctx = (now = T0, seed = 1) => ({ now, rng: seeded(seed) });
function veteran(name: string): PlayerState {
  const s = newPlayer(name, T0);
  Object.assign(s, { lvl: 6, gold: 500, tut: 6, tutDone: true, stats: { fue: 9, dur: 9, ref: 9, agu: 9, lab: 9 } });
  s.c.valija = 1; s.hp = maxHp(s); s.home.spawn = "Almagrito";
  return s;
}
const raw = (x: unknown) => x as Action;

describe("auditoría", () => {
  it("1 · un pedido armado a mano no toca la partida", () => {
    const s = veteran("Ana"), before = JSON.stringify(s);
    for (const a of [{ type: "spar", i: -1 }, { type: "spar", i: 1.5 }, { type: "encargo", gang: "toString" }, { type: "train", stat: "__proto__" },
                     { type: "build", part: "constructor" }, { type: "deposit", amount: "mucho" }, { type: "inventada" }, null]) {
      expect(validAction(a)).not.toBeNull();
      expect(applyAction(s, raw(a ?? {}), ctx()).error).toBeTruthy();
    }
    expect(JSON.stringify(s)).toBe(before);
    expect(validAction({ type: "train", stat: "fue" })).toBeNull();
  });
  it("2 · La valija no arranca antes de que Marga te mande a Misiones", () => {
    const s = newPlayer("Nuevo", T0);
    expect(canStart(s, VALIJA)).toBe(false);
    s.tabs.push("misiones");
    expect(canStart(s, VALIJA)).toBe(true);
  });
  it("3 · salir a buscar a alguien cobra la energía una sola vez", () => {
    const a = veteran("Ana"), d = veteran("Beto");
    d.busy = { kind: "mision", id: "x", since: T0, until: T0 + 3_600_000, done: 0, ok: 0, res: [], trip: { mode: "pie", place: "Floreros", go: 600_000, back: 0, ev: 0 } };
    const e0 = a.energy;
    startChase(a, d, 2, { at: [-34.6, -58.4], meet: T0 + 60_000, mode: "pie", cost: 0 }, T0);
    a.busy = null;
    ambushPlayer(a, d, ctx(T0 + 60_000));
    expect(a.energy).toBe(e0 - DUEL_COST);
  });
  it("3 · pelear nunca deja la energía en negativo", () => {
    const a = veteran("Ana"), d = veteran("Beto"); a.energy = 1;
    pvp(a, d, ctx());
    expect(a.energy).toBe(0);
  });
  it("4 · al que vuelve a su casa desde la misión se lo alcanza", () => {
    const d = veteran("Beto");
    d.busy = { kind: "vuelta", since: T0 + 3_600_000, until: T0 + 4_000_000, mode: "pie", place: "Floreros", home: "Almagrito" };
    expect(stillOnTrip(d, T0, T0 + 3_600_000, T0 + 3_700_000)).toBe(true);
    d.busy = { ...d.busy, safe: true };
    expect(stillOnTrip(d, T0, T0 + 3_600_000, T0 + 3_700_000)).toBe(false); // en ambulancia, no
  });
  it("5 · te emboscan aunque hayas cerrado la pantalla mientras viajabas", () => {
    let hits = 0;
    for (let seed = 1; seed < 40; seed++) {
      const s = veteran("Ana"); s.tAttack = T0;
      s.busy = { kind: "vuelta", since: T0, until: T0 + ATTACK_EVERY * 1.5, mode: "pie", place: "Floreros", home: "Almagrito" };
      const h = ambushCatchUp(s, ctx(T0 + ATTACK_EVERY * 3, seed)); // abrís el juego cuando ya llegaste
      if (h) expect(s.log[0].t).toBeLessThan(T0 + ATTACK_EVERY * 1.5); // te pasó en el camino, no en tu casa
      hits += h;
    }
    expect(hits).toBeGreaterThan(0);
  });
  it("9 · no hay mansiones en barrios humildes ni mudanzas a casas que no se venden", () => {
    const s = veteran("Ana"); s.lvl = 40; s.gold = 1_000_000;
    expect(applyAction(s, { type: "move", id: "mansion@Liniers Sur" }, ctx()).error).toMatch(/venta/);
    expect(applyAction(s, { type: "move", id: "pension" }, ctx()).error).toBeTruthy();
    expect(s.gold).toBe(1_000_000);
  });
  it("10 · un golpe pedido en el lugar equivocado no cobra la energía", () => {
    const s = veteran("Ana"), e = s.energy;
    expect(applyAction(s, { type: "job", id: "celu", at: "financiera" }, ctx()).error).toMatch(/ahí/);
    expect(s.energy).toBe(e);
  });
  it("11 · la máscara de calabaza no se vende", () => {
    const s = veteran("Ana"); s.inv.push("calabaza");
    expect(applyAction(s, { type: "sell", id: "calabaza" }, ctx()).error).toMatch(/recuerdo/);
    expect(s.inv).toContain("calabaza");
  });
  it("18 · la crónica queda ordenada por hora aunque algo llegue tarde", () => {
    const s = veteran("Ana"); s.log = [];
    log(s, T0 + 2000, "después"); log(s, T0 + 1000, "antes"); log(s, T0 + 3000, "último");
    expect(s.log.map(l => l.msg)).toEqual(["último", "después", "antes"]);
  });
});
