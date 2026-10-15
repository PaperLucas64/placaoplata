import { describe, expect, it } from "vitest";
import {
  applyAction, canStart, ENERGY_EVERY, ENERGY_MAX, guardiaTime, maxHp, MISSIONS, newPlayer, pvp, RANK_AT, regen, trainCost, trainTime,
  type PlayerState, type Rng
} from "../src/index.js";

/* azar repetible para que los tests den siempre lo mismo */
export const seeded = (seed: number): Rng => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const T0 = 1_000_000;
const ctx = (now = T0, seed = 1) => ({ now, rng: seeded(seed) });

function veteran(name: string, side: "placa" | "plata"): PlayerState {
  const s = newPlayer(name, T0);
  Object.assign(s, { lvl: 6, gold: 500, side, tut: 6, tutDone: true, stats: { fue: 9, dur: 9, ref: 9, agu: 9, lab: 9 } });
  s.c.valija = 1; s.hp = maxHp(s);
  return s;
}

describe("tutorial", () => {
  it("no se cobra un encargo sin terminarlo", () => {
    const s = newPlayer("Ana", T0);
    expect(applyAction(s, { type: "claimTut" }, ctx()).error).toBeTruthy();
  });
  it("dos laburos destraban el gimnasio", () => {
    const s = newPlayer("Ana", T0);
    s.c.jobs = 2;
    expect(applyAction(s, { type: "claimTut" }, ctx()).error).toBeUndefined();
    expect(s.tabs).toContain("gimnasio");
    expect(s.gold).toBe(25);
  });
});

describe("energía", () => {
  it("un trabajo gasta energía y no se puede trabajar sin ella", () => {
    const s = newPlayer("Ana", T0);
    applyAction(s, { type: "job", id: "bici" }, ctx());
    expect(s.energy).toBe(ENERGY_MAX - 1);
    s.energy = 0;
    expect(applyAction(s, { type: "job", id: "bici" }, ctx()).error).toMatch(/energía/);
  });
  it("se recarga con el tiempo", () => {
    const s = newPlayer("Ana", T0);
    s.energy = 5;
    regen(s, T0 + ENERGY_EVERY * 3 + 10);
    expect(s.energy).toBe(8);
  });
});

describe("bandos", () => {
  it("elegir bando abre La calle y el ranking, y no se puede cambiar", () => {
    const s = veteran("Ana", "placa"); s.side = null;
    applyAction(s, { type: "side", side: "plata" }, ctx());
    expect(s.side).toBe("plata");
    expect(s.tabs).toEqual(expect.arrayContaining(["calle", "ranking"]));
    expect(applyAction(s, { type: "side", side: "placa" }, ctx()).error).toBeTruthy();
  });
  it("las misiones van en orden y piden rango", () => {
    const s = veteran("Ana", "placa");
    const [ronda, allanamiento] = MISSIONS.placa;
    expect(canStart(s, ronda)).toBe(true);
    s.done.ronda = true;
    expect(canStart(s, allanamiento)).toBe(false); // falta rango Sargento
    s.respect = RANK_AT[allanamiento.rank];
    expect(canStart(s, allanamiento)).toBe(true);
  });
});

describe("peleas entre jugadores", () => {
  it("la plata que pierde uno es como mucho la que gana el otro", () => {
    for (let seed = 1; seed < 40; seed++) {
      const a = veteran("Ana", "plata"), d = veteran("Beto", "placa");
      const total = a.gold + d.gold;
      pvp(a, d, ctx(T0, seed));
      expect(a.gold + d.gold).toBe(total); // la plata ni se crea ni se pierde
      expect(a.energy).toBe(ENERGY_MAX - 3);
      expect(a.hp).toBeGreaterThan(0); expect(d.hp).toBeGreaterThan(0);
    }
  });
  it("al defensor le queda registrado en la crónica", () => {
    const a = veteran("Ana", "placa"), d = veteran("Beto", "plata");
    pvp(a, d, ctx());
    expect(d.log[0].msg).toContain("Ana");
    expect(d.seenTab.calle).toBe(false);
  });
});

describe("tiempo humano", () => {
  it("entrenar cobra al empezar, bloquea y el punto llega al terminar", () => {
    const s = newPlayer("Ana", T0); s.gold = 500;
    const cost = trainCost(5), t = trainTime(5);
    expect(applyAction(s, { type: "train", stat: "fue" }, ctx()).error).toBeUndefined();
    expect(s.gold).toBe(500 - cost);
    expect(s.stats.fue).toBe(5);
    expect(applyAction(s, { type: "job", id: "bici" }, ctx(T0 + 1000)).error).toMatch(/entrenando/);
    regen(s, T0 + t);
    expect(s.stats.fue).toBe(6);
    expect(s.busy).toBeNull();
    expect(applyAction(s, { type: "job", id: "bici" }, ctx(T0 + t)).error).toBeUndefined();
  });
  it("cortar el entrenamiento pierde la plata y el punto", () => {
    const s = newPlayer("Ana", T0); s.gold = 500;
    applyAction(s, { type: "train", stat: "ref" }, ctx());
    applyAction(s, { type: "cancel" }, ctx(T0 + 1000));
    regen(s, T0 + trainTime(5) * 2);
    expect(s.stats.ref).toBe(5);
    expect(s.gold).toBe(500 - trainCost(5));
  });
  it("la guardia es gratis, cura todo al alta y te protege de emboscadas", () => {
    const s = veteran("Ana", "plata"); s.hp = 10;
    const gold = s.gold, t = guardiaTime(s);
    applyAction(s, { type: "guardia" }, ctx());
    expect(s.gold).toBe(gold);
    regen(s, T0 + t);
    expect(s.hp).toBe(maxHp(s));
  });
  it("irse antes de la guardia cura en proporción", () => {
    const s = veteran("Ana", "plata"); s.hp = 10;
    const t = guardiaTime(s);
    applyAction(s, { type: "guardia" }, ctx());
    applyAction(s, { type: "cancel" }, ctx(T0 + t / 2));
    expect(s.hp).toBeGreaterThan(10);
    expect(s.hp).toBeLessThan(maxHp(s));
  });
  it("la clínica cura al instante pagando", () => {
    const s = veteran("Ana", "placa"); s.hp = 20; const gold = s.gold;
    applyAction(s, { type: "heal" }, ctx());
    expect(s.hp).toBe(maxHp(s));
    expect(s.gold).toBeLessThan(gold);
  });
});
