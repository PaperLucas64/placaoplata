/* Dónde dormís (docs/MUNDO.md, etapa 2): la pieza de pensión que se paga por día, la guarida de tu pandilla o tu casa.
   - Pensión: cualquiera, en el barrio donde caíste. Se paga por día, según el barrio. Sin caja fuerte ni obras.
   - Guarida: gratis, si sos de una pandilla. En su barrio. Sin caja fuerte ni obras, y no se planea nada grande.
   - Casa propia: la cama, la caja fuerte, las obras y los golpes grandes.
   Si no te alcanza para la pensión, dormís en la calle: la energía vuelve a la mitad de velocidad hasta que pagues. */
import { tierOf, type Tier } from "./barrios.js";
import { hasHouse, houseOf } from "./casas.js";
import { gangOf, log, money } from "./rules.js";
import type { Job, PlayerState } from "./types.js";

const DAY = 24 * 3_600_000;
export const PENSION_PRICE: Record<Tier, number> = { humilde: 20, medio: 30, rico: 45 }; // por día
export const PENSION_GRACE_DAYS = 3; // al terminar el tutorial, Marga te paga los primeros días
export const pensionPrice = (s: Pick<PlayerState, "home">) => PENSION_PRICE[tierOf(houseOf(s).place)];

export type Lodging = "casa" | "pension" | "guarida" | "calle";
export function lodgingOf(s: Pick<PlayerState, "home">): Lodging {
  if (hasHouse(s)) return "casa";
  const st = s.home?.stay;
  return st === "guarida" ? "guarida" : st === "calle" ? "calle" : "pension";
}
/* los golpes grandes (los de riesgo alto) se planean y se guardan en una casa propia */
export const needsHouse = (j: Pick<Job, "risk">) => j.risk >= 3;
export const HOUSE_NEEDED = "Para un golpe así necesitás casa propia: ahí se planea y se guarda el botín.";

/* Cobra la pensión de los días que pasaron (y te deja en la calle si no te alcanza). Corre junto con la energía. */
export function lodgingCatchUp(s: PlayerState, now: number) {
  const h = s.home;
  if (!h || hasHouse(s)) return;
  /* si te fuiste de la pandilla, la guarida ya no es tuya */
  if (h.stay === "guarida" && h.guarida !== gangOf(s)) {
    h.stay = "pension"; h.paidUntil = now;
    log(s, now, "Ya no sos de esa pandilla: te sacaron de la guarida. Volviste a la pensión.", "bad");
  }
  if (h.stay === "guarida") return;
  if (!s.tutDone) { h.paidUntil = now + DAY; return; } // en el tutorial, la pieza la paga Marga
  if (h.paidUntil === undefined) {
    h.paidUntil = now + PENSION_GRACE_DAYS * DAY;
    log(s, now, `Marga arregló con la pensión: te paga ${PENSION_GRACE_DAYS} días. Después, ${money(pensionPrice(s))} por día. Si sos de una pandilla, en su guarida dormís gratis.`, "gold");
    return;
  }
  const price = pensionPrice(s);
  /* en la calle: apenas te alcanza, pagás el día y volvés (los días en la calle no se cobran) */
  if (h.stay === "calle") {
    if (s.gold < price) return;
    s.gold -= price; h.paidUntil = now + DAY; h.stay = "pension";
    log(s, now, `Pagaste la pensión (${money(price)}) y volviste a tu pieza.`, "good");
    return;
  }
  while (h.paidUntil <= now) {
    if (s.gold < price) {
      log(s, h.paidUntil, `No te alcanzó para la pensión (${money(price)} por día): dormís en la calle. La energía vuelve a la mitad de velocidad hasta que pagues.`, "bad");
      h.stay = "calle";
      return;
    }
    s.gold -= price; h.paidUntil += DAY;
  }
}
/* la energía, a la mitad de velocidad si dormís en la calle */
export const energySlow = (s: Pick<PlayerState, "home">) => lodgingOf(s) === "calle";
