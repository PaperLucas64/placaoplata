/* Dónde está cada uno sobre su recorrido, salir a cruzar a alguien (como las peleas en el mapamundi del Monkey Island)
   y cruces casuales entre jugadores de pandillas rivales. Lo usan el servidor (que decide) y la pantalla (que muestra).
   Los recorridos (data/rutas.json) los arma tools/geo/build.py; acá se reciben como parámetro. */
import { homePlace } from "./casas.js";
import { GEO_HOME, GEO_PLACES, hasMod, tripPhase, TRAVEL_SCALE, type TravelMode } from "./geo.js";
import { gangOf } from "./rules.js";
import type { Gang, Mission, PlayerState } from "./types.js";

export type Pt = [number, number]; // [lat, lng]
export type Leg = { kind: "pie" | "subte" | "tren"; line?: string; pts: Pt[] };
export type Ruta = { calle: Pt[]; pie?: Pt[]; riel?: Leg[] };
export type Rutas = Record<string, Record<string, Ruta>>; // desde cada casa, a cada lugar

/* km entre dos puntos */
export function kmBetween(a: Pt, b: Pt) {
  const R = 6371, rad = Math.PI / 180;
  const h = Math.sin((b[0] - a[0]) * rad / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin((b[1] - a[1]) * rad / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const flat = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * Math.cos(a[0] * Math.PI / 180));
export const kmOf = (pts: Pt[]) => pts.slice(1).reduce((a, p, i) => a + kmBetween(pts[i], p), 0);
export const lerp = (a: Pt, b: Pt, f: number): Pt => { f = Math.min(1, Math.max(0, f)); return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; };

/* punto a una fracción (por distancia) de una línea */
export function along(pts: Pt[], f: number): Pt {
  if (pts.length < 2) return pts[0];
  const seg = pts.slice(1).map((p, i) => flat(pts[i], p));
  let goal = seg.reduce((a, b) => a + b, 0) * Math.min(1, Math.max(0, f));
  for (let i = 0; i < seg.length; i++) {
    if (goal <= seg[i]) return lerp(pts[i], pts[i + 1], seg[i] ? goal / seg[i] : 0);
    goal -= seg[i];
  }
  return pts[pts.length - 1];
}
/* los tramos del viaje según el medio, con su peso en tiempo (para mover al personaje a la velocidad de cada tramo) */
export function legsFor(r: Ruta, mode: TravelMode): { kind: string; pts: Pt[]; w: number }[] {
  if (mode === "riel" && r.riel) return r.riel.map(l => {
    const km = kmOf(l.pts);
    return { kind: l.kind, pts: l.pts, w: l.kind === "pie" ? km / 5 : km / (l.kind === "subte" ? 30 : km > 50 ? 60 : 40) + 0.07 };
  });
  const pts = mode === "pie" && r.pie ? r.pie : r.calle;
  return [{ kind: mode, pts, w: 1 }];
}
/* dónde está el personaje: f = fracción del tiempo de la ida (0 a 1) */
export function positionAt(legs: { pts: Pt[]; w: number }[], f: number): Pt {
  const total = legs.reduce((a, l) => a + l.w, 0);
  let t = total * Math.min(1, Math.max(0, f));
  for (const l of legs) { if (t <= l.w) return along(l.pts, l.w ? t / l.w : 1); t -= l.w; }
  const last = legs[legs.length - 1].pts;
  return last[last.length - 1];
}
/* tu casa en el mapa */
export const homePt = (s?: Pick<PlayerState, "home">): Pt => { const p = GEO_PLACES[s ? homePlace(s) : GEO_HOME]; return [p.lat, p.lng]; };
export const placePt = (p: string): Pt | null => (GEO_PLACES[p] ? [GEO_PLACES[p].lat, GEO_PLACES[p].lng] : null);
/* un punto fijo adentro de un barrio para cada cosa (siempre el mismo para la misma clave) */
export function spotIn(barrio: string, key: string): Pt {
  const c = GEO_PLACES[barrio] ?? GEO_PLACES[GEO_HOME];
  let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const a = (h % 360) * Math.PI / 180, r = 0.0025 + ((h >>> 8) % 100) / 100 * 0.004;
  return [c.lat + Math.sin(a) * r, c.lng + Math.cos(a) * r];
}
/* dónde pasa una misión: justo en su banderita del mapa */
export const missionPt = (m: Pick<Mission, "id">, place: string): Pt | null => (GEO_PLACES[place] ? spotIn(place, m.id) : null);

/* ---------- dónde está alguien que está en la calle ---------- */
export interface OnTrip { since: number; until: number; trip: { mode: TravelMode; place: string; go: number; back: number; from?: string; path?: Pt[] } }
export interface OnChase { since: number; until: number; meet: number; from: Pt; at: Pt; path?: Pt[] } // path: por dónde va (las cuadras)
export function tripPos(rutas: Rutas, o: OnTrip, now: number, streetOnly = false): Pt | null {
  const ph = tripPhase({ since: o.since, until: o.until, trip: { ...o.trip, ev: 0 } }, now);
  const r = rutas[o.trip.from ?? GEO_HOME]?.[o.trip.place], dest = placePt(o.trip.place);
  if (!ph || !dest || now < o.since || now > o.until) return null;
  if (ph.phase === "alla") return streetOnly ? null : dest;  // adentro de un lugar: ahí no se lo puede asaltar
  if (o.trip.path && o.trip.path.length > 1) return along(o.trip.path, ph.phase === "vuelta" ? 1 - ph.frac : ph.frac); // el camino por las cuadras
  const f = ph.phase === "vuelta" ? 1 - ph.frac : ph.frac;
  if (!r) { /* sin recorrido guardado ni camino: en línea recta, estimado */
    const o0 = placePt(o.trip.from ?? GEO_HOME);
    return o0 ? lerp(o0, dest, f) : streetOnly ? null : dest;
  }
  return positionAt(legsFor(r, o.trip.mode), f);
}
export function chasePos(c: OnChase, now: number): Pt | null {
  if (now < c.since || now > c.until) return null;
  const go = (now - c.since) / Math.max(1, c.meet - c.since), back = (now - c.meet) / Math.max(1, c.until - c.meet);
  if (c.path && c.path.length > 1) return now <= c.meet ? along(c.path, go) : along(c.path, 1 - back);
  return now <= c.meet ? lerp(c.from, c.at, go) : lerp(c.at, c.from, back);
}
/* el barrio (o lugar) más cerca de un punto, para la crónica */
export function nearestPlace(p: Pt) {
  return Object.keys(GEO_PLACES).filter(k => !GEO_PLACES[k].interior)
    .sort((a, b) => kmBetween(p, placePt(a)!) - kmBetween(p, placePt(b)!))[0];
}

/* ---------- salir a cruzar a alguien ---------- */
export type ChaseMode = "pie" | "taxi" | "moto" | "auto";
export const CHASE_SPEED: Record<ChaseMode, number> = { pie: 9, taxi: 25, moto: 32, auto: 28 }; // km/h (a pie, corriendo)
export const CHASE_NAMES: Record<ChaseMode, string> = { pie: "Corriendo", taxi: "En taxi", moto: "En tu moto", auto: "En tu auto" };
export const CHASE_MAX_MIN = 30;   // si no lo cruzás en media hora, no vale la pena
export const STREET_FACTOR = 1.3;  // las calles no van en línea recta
export interface ChasePlan { mode: ChaseMode; meet: number; at: Pt; km: number; cost: number }

export const chaseModes = (s: PlayerState): ChaseMode[] =>
  (["pie", "taxi", "moto", "auto"] as ChaseMode[]).filter(m => m === "pie" || m === "taxi" || !!s.garage?.[m]);
export function chaseCost(s: PlayerState, mode: ChaseMode, km: number) {
  const per = mode === "taxi" ? (gangOf(s) === "amarillos" ? 0 : 2.5) : mode === "moto" ? 0.15 : mode === "auto" ? 0.3 : 0;
  return Math.round(km * per * 2);
}
/* El primer momento en que lo podés alcanzar saliendo ahora desde la pensión, o null si no llegás */
export function planChase(s: PlayerState, rutas: Rutas, target: OnTrip, now: number, mode: ChaseMode, factor = STREET_FACTOR): ChasePlan | null {
  const from = homePt(s);
  const v = CHASE_SPEED[mode] * ((mode === "moto" || mode === "auto") && hasMod(s, mode, "motor") ? 1.25 : 1);
  const kmPerMs = v * TRAVEL_SCALE / 3_600_000;
  const end = Math.min(target.until, now + CHASE_MAX_MIN * 60_000);
  for (let t = now + 20_000; t <= end; t += 10_000) {
    const p = tripPos(rutas, target, t, true);
    if (!p) continue;
    const km = kmBetween(from, p) * factor;
    if (km / kmPerMs <= t - now) return { mode, meet: t, at: p, km, cost: chaseCost(s, mode, km) };
  }
  return null;
}

/* ---------- cruces en el camino ---------- */
export const CROSS_KM = 0.15;         // si pasan a menos de 150 m al mismo tiempo, se cruzan
export const CROSS_LVL_GAP = 5;       // entre niveles muy distintos no se buscan pelea
export const rivals = (a: PlayerState, b: PlayerState) => { const ga = gangOf(a); return !(ga && ga === gangOf(b)); };
/* El primer momento en que dos recorridos se cruzan (desde `from`), o null */
export function firstCrossing(rutas: Rutas, a: OnTrip, b: OnTrip, from: number): number | null {
  const start = Math.max(from, a.since, b.since), end = Math.min(a.until, b.until, start + 3 * 3_600_000);
  for (let t = start; t <= end; t += 20_000) {
    const pa = tripPos(rutas, a, t, true), pb = tripPos(rutas, b, t, true);  // solo en la calle
    if (pa && pb && kmBetween(pa, pb) < CROSS_KM) return t;
  }
  return null;
}

/* alguien que anda en la calle, como lo ve el mapa de los demás (no dice qué misión es) */
export interface TravelerView {
  id: number; name: string; lvl: number; gang: Gang | null; avatar: number; bot?: boolean; since: number; until: number;
  trip?: OnTrip["trip"];                                                  // en una misión
  chase?: { meet: number; from: Pt; at: Pt; targetName: string; path?: Pt[] }; // salió a buscar a alguien
}
/* dónde está ahora */
export function travelerPos(rutas: Rutas, t: TravelerView, now: number): Pt | null {
  if (t.trip) return tripPos(rutas, { since: t.since, until: t.until, trip: t.trip }, now);
  if (t.chase) return chasePos({ since: t.since, until: t.until, meet: t.chase.meet, from: t.chase.from, at: t.chase.at, path: t.chase.path }, now);
  return null;
}

/* volver a casa, visto como un viaje que ya está en la vuelta (sirve para el mapa y para los cruces) */
export function returnTrip(b: { since: number; until: number; mode: TravelMode; place: string; home: string; path?: Pt[] }): OnTrip {
  /* el camino de la vuelta va del lugar a casa; acá se da vuelta (casa → lugar) porque la fase "vuelta" lo recorre al revés */
  return { since: b.since, until: b.until, trip: { mode: b.mode, place: b.place, go: 0, back: Math.max(1, b.until - b.since), from: b.home,
    ...(b.path ? { path: [...b.path].reverse() } : {}) } };
}
/* dónde está ahora un jugador que viene volviendo a casa */
export function wherePlayer(rutas: Rutas, s: PlayerState, now: number): Pt {
  const b = s.busy;
  if (b?.kind === "vuelta") return tripPos(rutas, returnTrip(b), now) ?? homePt(s);
  if (b?.kind === "caza") return chasePos({ since: b.since, until: b.until, meet: b.meet, from: b.from, at: b.at, path: b.path }, now) ?? homePt(s);
  return homePt(s);
}
