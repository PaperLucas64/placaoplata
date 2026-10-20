import { describe, expect, it } from "vitest";
import { isBlocked } from "../src/moderation.js";

describe("palabras que no van en el chat", () => {
  it("frena insultos discriminatorios, aunque los disfracen", () => {
    for (const t of ["sos un sudaca", "PUTO", "puuuuto el que lee", "m4r1c0n", "n e g r o de mierda", "heil hitler", "1488",
      "Maricón!", "qué mogólico", "t r o l o", "bolita de mierda", "negrodemierda"]) expect(isBlocked(t), t).toBe(true);
  });
  it("deja pasar lo normal y las palabras que se parecen", () => {
    for (const t of ["Buenas, ¿alguien para una misión de a dos en Núñez?", "voy a la computadora", "el diputado nervioso",
      "jugamos a las bolitas", "me imputó el fiscal", "un negro con leche", "dale boludo", "Kike llegó", "hago sambo",
      "se me rompió el paraguas", "la torta está buenísima", "Hospital Rivadavio"]) expect(isBlocked(t), t).toBe(false);
  });
});
