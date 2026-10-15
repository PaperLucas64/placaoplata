import { describe, expect, it } from "vitest";
import {
  ambushCatchUp, applyAction, canStart, ENERGY_EVERY, ENERGY_MAX, energyMax, gangOf, guardiaTime, HOME, maxHp, MISSIONS, newPlayer, pvp,
  BARRIOS, coopMission, decayed, missionCatchUp, ownerOf, TURF_HALF_LIFE, turfMult, missionMins, newBoard, RANK_AT, regen, resolveCoopStep, safeCap, streetMission, teamFighter, VALIJA, trainCost, trainTime, upgradeState, type Gang, type PlayerState, type Rng
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
    let seed = 1, s: PlayerState;
    do { // con distintas suertes, hasta que salga bien
      s = veteran("Ana"); s.stats = { fue: 30, dur: 30, ref: 30, agu: 30, lab: 30 }; s.hp = maxHp(s);
      applyAction(s, { type: "mstart", id: "trapos" }, ctx());
      missionCatchUp(s, ctx(T0 + 60 * 60_000, seed++));
    } while (!s.done.trapos && seed < 20);
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
    expect(s.v).toBe(3);
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

describe("feria", () => {
  it("en el tutorial solo vende la llave inglesa", () => {
    const s = newPlayer("Ana", T0); s.gold = 500;
    expect(applyAction(s, { type: "buy", id: "campera" }, ctx()).error).toMatch(/llave/);
    expect(applyAction(s, { type: "buy", id: "llave" }, ctx()).error).toBeUndefined();
  });
  it("el suplemento sube la vida máxima para siempre y cada vez cuesta más", () => {
    const s = veteran("Ana"); s.gold = 200_000;
    const hp0 = maxHp(s);
    applyAction(s, { type: "buy", id: "suplemento" }, ctx());
    const g1 = s.gold;
    applyAction(s, { type: "buy", id: "suplemento" }, ctx());
    expect(maxHp(s)).toBe(hp0 + 20);
    expect(200_000 - g1).toBeLessThan(g1 - s.gold);
    for (let i = 0; i < 20; i++) applyAction(s, { type: "buy", id: "suplemento" }, ctx());
    expect(maxHp(s)).toBe(hp0 + 100); // tope: 10 suplementos
  });
});

describe("misiones con tiempo", () => {
  it("La valija dura 30 minutos y las etapas se resuelven a su hora", () => {
    const s = newPlayer("Ana", T0); s.tut = 5; s.tabs.push("misiones");
    expect(applyAction(s, { type: "mstart", id: "valija" }, ctx()).error).toBeUndefined();
    expect(s.busy?.kind).toBe("mision");
    expect(missionMins(VALIJA)).toBe(30);
    expect(applyAction(s, { type: "job", id: "bici" }, ctx(T0 + 1000)).error).toMatch(/misión/);
    missionCatchUp(s, ctx(T0 + 8 * 60_000));          // pasaron 8 minutos: una etapa
    expect(s.busy?.kind === "mision" && s.busy.done).toBe(1);
    missionCatchUp(s, ctx(T0 + 31 * 60_000));
    expect(s.busy).toBeNull();
    expect(s.log.some(l => l.msg.includes("La valija"))).toBe(true);
  });
  it("las misiones piden atributos mínimos", () => {
    const s = veteran("Ana"); s.stats = { fue: 5, dur: 5, ref: 5, agu: 5, lab: 5 };
    expect(applyAction(s, { type: "mstart", id: "kiosco" }, ctx()).error).toMatch(/atributos/);
  });
  it("abandonar una misión pierde la energía", () => {
    const s = veteran("Ana"); const e = s.energy;
    applyAction(s, { type: "mstart", id: "paro" }, ctx());
    applyAction(s, { type: "cancel" }, ctx(T0 + 1000));
    expect(s.busy).toBeNull();
    expect(s.energy).toBeLessThan(e);
  });
  it("el tablón trae cuatro misiones de calle a tu nivel, de fácil a jodida", () => {
    const s = veteran("Ana");
    newBoard(s, seeded(3), T0);
    expect(s.board.map(m => m.difficulty)).toEqual([0, 1, 2, 3]);
    expect(new Set(s.board.map(m => m.title)).size).toBe(4);
    expect(s.board[3].reward!.gold).toBeGreaterThan(s.board[0].reward!.gold);
  });
});

describe("misiones de a dos", () => {
  it("pagan más que una difícil sola y suman afinidad", () => {
    const m = coopMission(seeded(1), 10, "barra", 7);
    expect(m.id).toBe("coop-7");
    expect(m.reward!.gold).toBeGreaterThan(streetMission(seeded(1), 10, 2, "barra", "x").reward!.gold);
  });
  it("en cada prueba actúa el que mejor tiene ese atributo", () => {
    const a = veteran("Ana"), b = veteran("Beto");
    a.stats.lab = 30; b.stats.lab = 5;
    const r = resolveCoopStep(a, b, { text: "", stat: "lab", diff: 5, energy: 2 }, seeded(2));
    expect(r.who).toBe("Ana");
  });
  it("las peleas las dan juntos: suman la vida de los dos", () => {
    const a = veteran("Ana"), b = veteran("Beto");
    expect(teamFighter(a, b).max).toBe(maxHp(a) + maxHp(b));
  });
  it("mientras espera a su compañero, no puede arrancar otra cosa larga", () => {
    const s = veteran("Ana");
    s.coop = { id: 1, partner: "Beto", partnerId: 2, mission: coopMission(seeded(1), 6, "familia", 1), status: "waiting" };
    expect(applyAction(s, { type: "train", stat: "fue" }, ctx()).error).toMatch(/de a dos/);
    expect(applyAction(s, { type: "job", id: "bici" }, ctx()).error).toBeUndefined(); // lo instantáneo, sí
  });
});

describe("territorio", () => {
  it("el barrio es de la pandilla con más influencia, si pasa el mínimo", () => {
    expect(ownerOf({ barra: 30, familia: 8 })).toBe("barra");
    expect(ownerOf({ barra: 12, familia: 12 })).toBeNull();   // empate: en disputa
    expect(ownerOf({ amarillos: 5 })).toBeNull();             // muy poca influencia
  });
  it("la influencia pierde la mitad por semana", () => {
    expect(decayed(100, TURF_HALF_LIFE)).toBeCloseTo(50);
    expect(decayed(100, 2 * TURF_HALF_LIFE)).toBeCloseTo(25);
  });
  it("una misión de calle suma influencia en su barrio para la pandilla que la da", () => {
    let s: PlayerState, seed = 1;
    do {
      s = veteran("Ana"); s.stats = { fue: 40, dur: 40, ref: 40, agu: 40, lab: 40 }; s.hp = maxHp(s);
      newBoard(s, seeded(seed), T0);
      applyAction(s, { type: "mstart", id: s.board[0].id }, ctx());
      missionCatchUp(s, ctx(T0 + 60 * 60_000, seed++));
    } while (!s.influence?.length && seed < 20);
    expect(s.influence![0].barrio).toBe(BARRIOS.find(b => s.log.some(l => l.msg.includes(b))));
  });
  it("cada barrio de tu pandilla paga un 2% más", () => {
    const s = veteran("Ana", "barra"); s.turf = 3;
    expect(turfMult(s)).toBeCloseTo(1.06);
    expect(turfMult(veteran("Beto"))).toBe(1); // suelto: sin bonus
  });
});
