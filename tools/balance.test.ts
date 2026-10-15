/* Guardia del balance: el bot juega partidas completas y estos rangos tienen que seguir valiendo.
   Si un cambio los rompe, revisar docs/BALANCE.md antes de tocar los números del test. */
import { describe, expect, it } from "vitest";
import { ENERGY_MAX, type Gang } from "@pop/shared";
import { play, summarize } from "./playthrough.js";

const runs = (gang: Gang) => summarize(Array.from({ length: 10 }, (_, i) => play(gang, 500 + i, 6000)));

describe.each(["familia", "sindicato", "barra", "amarillos"] as Gang[])("balance de %s", gang => {
  const r = runs(gang);
  it("haciendo lo suyo, el jugador termina siendo de esa pandilla", () => expect(r.share).toBeGreaterThanOrEqual(50));
  it("el tutorial entra en la primera sesión", () => expect(r.events["misión valija"]).toBeLessThanOrEqual(ENERGY_MAX));
  it("los rangos llegan a buen ritmo", () => {
    expect(r.ranks[1]).toBeLessThan(150);           // primer día
    expect(r.ranks[2]).toBeLessThan(800);
    expect(r.ranks[4]).toBeGreaterThan(1500);       // la misión final no llega en dos días
    expect(r.ranks[4]).toBeLessThan(3500);
  });
  it("nivel 10 entre 700 y 1500 de energía", () => {
    expect(r.levels[10]).toBeGreaterThan(700);
    expect(r.levels[10]).toBeLessThan(1500);
  });
  it("la calle no es ni un trámite ni imposible", () => {
    expect(r.fights.calle).toBeGreaterThan(45);
    expect(r.fights.calle).toBeLessThanOrEqual(80);
  });
  it("las peleas de misión se pueden ganar", () => {
    for (const [k, v] of Object.entries(r.fights)) if (k.startsWith("misión")) expect(v, k).toBeGreaterThan(35);
  });
}, 60_000);
