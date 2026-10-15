/* Misiones de a dos: un jugador invita a un amigo; cuando acepta, la misión arranca apenas los dos estén libres.
   En cada etapa actúa el que tenga mejor el atributo que se pide; las peleas las dan juntos.
   La orquestación (invitaciones, espera, guardar a los dos) la hace el servidor; acá están las reglas. */
import { GANG_KEYS, GANG_MEMBERS, GANGS, POLICE_NAMES } from "./gangs.js";
import { BARRIOS } from "./missions.js";
import { addAff, addHeat, addRespect, battle, clamp, gainXp, gearVal, log, maxHp, money, pick, playerFighter, scaledEnemy } from "./rules.js";
import type { Fighter, Gang, Mission, MissionStep, PlayerState, Rng, StatKey } from "./types.js";

const MIN = 60_000;
export const COOP_MINS = 40;
export const COOP_ENERGY = 8;          // cada uno
export const COOP_PAY = 1.6;           // paga más que una misión difícil sola
export const COOP_AFF = 5;

export const coopMissionId = (coopId: number) => `coop-${coopId}`;
export const isCoopMission = (id: string) => id.startsWith("coop-");

interface Plan { text: string; stat: StatKey; ok: string; ko: string }
const PLANS: Record<Gang, Plan[]> = {
  familia: [
    { text: "Uno distrae al custodio mientras el otro abre la caja", stat: "lab", ok: "El custodio no se dio cuenta de nada.", ko: "El custodio sospechó y llamó refuerzos." },
    { text: "Sacar las bolsas por la puerta de atrás", stat: "fue", ok: "Salieron todas las bolsas.", ko: "Se rompió una bolsa en el pasillo." }
  ],
  sindicato: [
    { text: "Uno maneja el camión y el otro corta el candado", stat: "fue", ok: "El candado saltó al primer intento.", ko: "El candado no cedió y se hizo ruido." },
    { text: "Convencer a la guardia del galpón", stat: "lab", ok: "La guardia se fue a tomar mate.", ko: "La guardia no se dejó convencer." }
  ],
  barra: [
    { text: "Entrar a la tribuna rival, uno de cada lado", stat: "ref", ok: "Llegaron al trapo sin que los vieran.", ko: "Los reconocieron en la escalera." },
    { text: "Aguantar la avalancha espalda con espalda", stat: "dur", ok: "Quedaron de pie los dos.", ko: "La avalancha los separó." }
  ],
  amarillos: [
    { text: "Uno maneja y el otro marca el camino", stat: "ref", ok: "No los alcanzó ni el viento.", ko: "Se metieron en una calle cortada." },
    { text: "Cambiar el auto en un taller amigo", stat: "lab", ok: "En diez minutos tenían otro auto.", ko: "El del taller no quiso saber nada." }
  ]
};

/* Arma una misión de a dos para el nivel promedio de la pareja */
export function coopMission(rng: Rng, lvl: number, gang: Gang, coopId: number): Mission {
  const typ = Math.max(5, 0.5 + lvl * 1.4), diff = Math.round(typ * 1.05);
  const [p1, p2] = PLANS[gang];
  const place = pick(rng, BARRIOS);
  const foeGang = pick(rng, GANG_KEYS.filter(g => g !== gang));
  const foe = rng() < 0.3 ? pick(rng, POLICE_NAMES) : pick(rng, GANG_MEMBERS[foeGang]);
  const per = COOP_ENERGY / 4;
  const steps: MissionStep[] = [
    { text: p1.text, stat: p1.stat, diff, energy: per, dmg: 0.08, ok: p1.ok, ko: p1.ko },
    { text: p2.text, stat: p2.stat, diff, energy: per, dmg: 0.08, ok: p2.ok, ko: p2.ko },
    { text: `${foe} y su gente les salen al cruce`, fight: { name: `${foe} y su gente`, mult: 1.0 }, energy: per,
      win: "Los dos se los sacaron de encima.", lose: "Les dieron una paliza a los dos." },
    { text: `Volver con ${GANGS[gang].boss}`, energy: per, auto: true, ok: `${GANGS[gang].boss} reparte la plata en dos partes iguales.` }
  ];
  return {
    id: coopMissionId(coopId), gang, rank: 0, mins: COOP_MINS, title: `Golpe de a dos en ${place}`,
    intro: `${GANGS[gang].name} · de a dos · ${COOP_MINS} min`, steps, outro: "", aff: COOP_AFF,
    reward: { gold: Math.round(COOP_ENERGY * (10 + 2.4 * lvl) * COOP_PAY), xp: Math.round(COOP_ENERGY * (3 + 0.55 * lvl) * COOP_PAY), resp: 8, heat: 8 }
  };
}

/* Los dos juntos en una pelea: suman vida, pega el más fuerte, esquiva el más rápido */
export function teamFighter(a: PlayerState, b: PlayerState): Fighter {
  const fa = playerFighter(a), fb = playerFighter(b);
  return {
    name: `${a.name} y ${b.name}`, hp: fa.hp + fb.hp, max: fa.max + fb.max,
    fue: Math.max(fa.fue, fb.fue), dur: Math.round((fa.dur + fb.dur) / 2), ref: Math.max(fa.ref, fb.ref),
    arma: Math.max(gearVal(a, "arma"), gearVal(b, "arma")), armadura: Math.round((gearVal(a, "armadura") + gearVal(b, "armadura")) / 2)
  };
}

/* Resuelve una etapa para la pareja. Cambia la vida de quien corresponda y devuelve el resultado y quién actuó. */
export function resolveCoopStep(a: PlayerState, b: PlayerState, st: MissionStep, rng: Rng): { ok: boolean; who: string } {
  if (st.auto) return { ok: true, who: "" };
  if (st.fight) {
    const lvl = Math.round((a.lvl + b.lvl) / 2);
    const enemy = scaledEnemy(rng, st.fight.name, lvl, st.fight.mult);
    enemy.hp = enemy.max = Math.round(enemy.max * 1.8); // son varios
    const f = battle(rng, teamFighter(a, b), enemy);
    const left = f.p.hp / f.p.max;
    a.hp = Math.max(1, Math.round(maxHp(a) * left)); b.hp = Math.max(1, Math.round(maxHp(b) * left));
    return { ok: f.won, who: "los dos" };
  }
  const doer = a.stats[st.stat!] >= b.stats[st.stat!] ? a : b;
  const ok = rng() * 100 < clamp(50 + (doer.stats[st.stat!] - st.diff!) * 7, 15, 95);
  if (!ok && st.dmg) doer.hp = Math.max(1, doer.hp - Math.round(maxHp(doer) * st.dmg));
  return { ok, who: doer.name };
}

/* Al terminar: los dos cobran lo mismo (si salió bien) */
export function finishCoop(s: PlayerState, m: Mission, ok: number, at: number, partner: string) {
  const success = ok >= Math.ceil(m.steps.length * 0.6);
  if (!success) {
    gainXp(s, at, 5 + s.lvl);
    log(s, at, `«${m.title}» con ${partner} se cayó (${ok} de ${m.steps.length} etapas salieron bien).`, "bad");
    return;
  }
  const r = m.reward!;
  s.gold += r.gold; gainXp(s, at, r.xp); addRespect(s, at, r.resp);
  if (r.heat) addHeat(s, r.heat);
  log(s, at, `«${m.title}» con ${partner} salió bien: ${money(r.gold)}, +${r.xp} XP, +${r.resp} de respeto.`, "gold");
  if (m.gang) addAff(s, at, m.gang, m.aff ?? COOP_AFF);
}

export const coopStepAt = (since: number, until: number, n: number, i: number) => since + Math.round((until - since) * (i + 1) / n);
export const coopUntil = (since: number) => since + COOP_MINS * MIN;
