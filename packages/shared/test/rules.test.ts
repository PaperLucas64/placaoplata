import { describe, expect, it } from "vitest";
import {
  ambushCatchUp, applyAction, canStart, ENERGY_EVERY, ENERGY_MAX, energyMax, gangOf, guardiaTime, HOME, maxHp, MISSIONS, newPlayer, pvp,
  RANK_AT, regen, safeCap, trainCost, trainTime, upgradeState, type Gang, type PlayerState, type Rng
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

function veteran(name: string, gang: Gang | null = null): PlayerState {
  const s = newPlayer(name, T0);
  Object.assign(s, { lvl: 6, gold: 500, tut: 6, tutDone: true, stats: { fue: 9, dur: 9, ref: 9, agu: 9, lab: 9 } });
  if (gang) s.aff[gang] = 20;
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

describe("pandillas", () => {
  it("al principio andás suelto", () => {
    expect(gangOf(veteran("Ana"))).toBeNull();
  });
  it("con la mitad de la afinidad sos de una pandilla, y se puede cambiar", () => {
    const s = veteran("Ana");
    s.aff = { familia: 6, sindicato: 4, barra: 0, amarillos: 0 };
    expect(gangOf(s)).toBe("familia");       // 60%
    s.aff.barra = 6;
    expect(gangOf(s)).toBeNull();            // 37% / 25% / 37%: nadie tiene la mitad
    s.aff.barra = 30;
    expect(gangOf(s)).toBe("barra");
  });
  it("hace falta haber hecho algo antes de pertenecer", () => {
    const s = veteran("Ana"); s.aff.amarillos = 3;
    expect(gangOf(s)).toBeNull();            // 100%, pero solo un encargo
  });
  it("las misiones de cualquier pandilla van en orden y piden rango", () => {
    const s = veteran("Ana");
    const [paro, deposito] = MISSIONS.sindicato;
    expect(canStart(s, paro)).toBe(true);
    expect(canStart(s, MISSIONS.barra[0])).toBe(true);
    s.done.paro = true;
    expect(canStart(s, deposito)).toBe(false);
    s.respect = RANK_AT[deposito.rank];
    expect(canStart(s, deposito)).toBe(true);
  });
  it("terminar una misión suma afinidad con su pandilla", () => {
    const s = veteran("Ana"); s.energy = 100;
    applyAction(s, { type: "mstart", id: "trapos" }, ctx());
    for (let i = 0; i < 40 && s.mis; i++) { s.hp = maxHp(s); s.energy = 100; applyAction(s, { type: "mstep" }, ctx(T0, i + 1)); }
    expect(s.done.trapos).toBe(true);
    expect(gangOf(s)).toBe("barra");
  });
  it("no aparecen rivales de tu propia pandilla en la calle", () => {
    const s = veteran("Ana", "amarillos");
    for (let i = 0; i < 50; i++) ambushCatchUp(s, ctx(T0 + i * 3_600_000, i));
    expect(s.log.some(l => l.msg.includes("Los Amarillos"))).toBe(false);
  });
  it("las partidas de la versión con policía se convierten", () => {
    const old = veteran("Viejo") as PlayerState & { side?: string };
    old.side = "plata"; old.gear.arma = "tonfa"; delete (old as Partial<PlayerState>).v;
    const s = upgradeState(old, T0);
    expect(s.v).toBe(2);
    expect(gangOf(s)).toBe("familia");
    expect(s.gear.arma).toBe("manopla");
    expect(s.tabs).toContain("casa");
  });
});

describe("casa", () => {
  it("las obras cuestan plata, llevan tiempo y no te bloquean", () => {
    const s = veteran("Ana"); s.gold = 5000;
    applyAction(s, { type: "build", part: "cama" }, ctx());
    expect(s.gold).toBe(5000 - HOME.cama.levels[1].cost);
    expect(applyAction(s, { type: "job", id: "bici" }, ctx(T0 + 1000)).error).toBeUndefined();
    expect(applyAction(s, { type: "build", part: "caja" }, ctx(T0 + 2000)).error).toMatch(/obra/);
    regen(s, T0 + HOME.cama.levels[1].mins * 60_000);
    expect(s.home.cama).toBe(1);
    expect(energyMax(s)).toBe(ENERGY_MAX + 5);
  });
  it("la caja fuerte tiene tope y protege la plata", () => {
    const s = veteran("Ana"); s.gold = 1000; s.home.caja = 1;
    applyAction(s, { type: "deposit", amount: 1000 }, ctx());
    expect(s.home.safe).toBe(safeCap(s));
    expect(s.gold).toBe(1000 - safeCap(s));
    applyAction(s, { type: "withdraw", amount: 50 }, ctx());
    expect(s.home.safe).toBe(safeCap(s) - 50);
  });
  it("el armario guarda lo que dejás de usar y te lo podés volver a poner", () => {
    const s = veteran("Ana"); s.gold = 1000; s.home.armario = 1; s.gear.arma = "llave";
    applyAction(s, { type: "buy", id: "bate" }, ctx());
    expect(s.home.closet).toEqual(["llave"]);
    applyAction(s, { type: "equip", id: "llave" }, ctx());
    expect(s.gear.arma).toBe("llave");
    expect(s.home.closet).toEqual(["bate"]);
  });
  it("sin armario, lo viejo se pierde", () => {
    const s = veteran("Ana"); s.gold = 1000; s.gear.arma = "llave";
    applyAction(s, { type: "buy", id: "bate" }, ctx());
    expect(s.home.closet).toEqual([]);
  });
});

describe("peleas entre jugadores", () => {
  it("la plata que pierde uno es como mucho la que gana el otro", () => {
    for (let seed = 1; seed < 40; seed++) {
      const a = veteran("Ana", "familia"), d = veteran("Beto", "sindicato");
      const total = a.gold + d.gold;
      pvp(a, d, ctx(T0, seed));
      expect(a.gold + d.gold).toBe(total); // la plata ni se crea ni se pierde
      expect(a.energy).toBe(ENERGY_MAX - 3);
      expect(a.hp).toBeGreaterThan(0); expect(d.hp).toBeGreaterThan(0);
    }
  });
  it("al defensor le queda registrado en la crónica", () => {
    const a = veteran("Ana", "barra"), d = veteran("Beto", "amarillos");
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
    const s = veteran("Ana"); s.hp = 10;
    const gold = s.gold, t = guardiaTime(s);
    applyAction(s, { type: "guardia" }, ctx());
    expect(s.gold).toBe(gold);
    regen(s, T0 + t);
    expect(s.hp).toBe(maxHp(s));
  });
  it("irse antes de la guardia cura en proporción", () => {
    const s = veteran("Ana"); s.hp = 10;
    const t = guardiaTime(s);
    applyAction(s, { type: "guardia" }, ctx());
    applyAction(s, { type: "cancel" }, ctx(T0 + t / 2));
    expect(s.hp).toBeGreaterThan(10);
    expect(s.hp).toBeLessThan(maxHp(s));
  });
  it("la clínica cura al instante pagando", () => {
    const s = veteran("Ana"); s.hp = 20; const gold = s.gold;
    applyAction(s, { type: "heal" }, ctx());
    expect(s.hp).toBe(maxHp(s));
    expect(s.gold).toBeLessThan(gold);
  });
});
