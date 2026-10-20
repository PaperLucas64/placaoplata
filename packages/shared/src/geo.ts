/* GPS y transporte. Cada misión pasa en un lugar: tu personaje sale de su casa, viaja, hace el trabajo y vuelve.
   Los recorridos son reales (OpenStreetMap, ver tools/geo/build.py) y el tiempo de viaje sale de la distancia y del medio:
   a pie es gratis pero lento; con auto o moto vas rápido pero te pueden parar. El viaje dura lo mismo que en la vida real. */
import { GEO_HOME, GEO_PLACES, GEO_ROUTES } from "./geo-data.js";
import { tierOf } from "./barrios.js";
import { homePlace } from "./casas.js";
import { addHeat, gangOf, log, money, pick } from "./rules.js";
import type { PlayerState, Rng } from "./types.js";

export type Zone = "norte" | "sur" | "oeste";
export const ZONE_NAMES: Record<Zone, string> = { norte: "Zona Norte", sur: "Zona Sur", oeste: "Zona Oeste" };
export interface GeoPlace { lat: number; lng: number; real: string; interior?: boolean; zone?: Zone }
export interface GeoLeg { kind: "pie" | "subte" | "tren"; line?: string; from?: string; to?: string; km: number }
export interface GeoRoute { calle: number; pie?: number; riel?: GeoLeg[] }
export { GEO_HOME, GEO_PLACES, GEO_ROUTES };

export type TravelMode = "pie" | "colectivo" | "riel" | "taxi" | "micro" | "moto" | "auto" | "ambulancia";
export type Vehicle = "moto" | "auto";
export const TRAVEL_MODES: TravelMode[] = ["pie", "colectivo", "riel", "taxi", "micro", "moto", "auto"]; // la ambulancia es solo para curarte

/* El viaje dura lo que dura en la vida real (docs/MUNDO.md, etapa 1). Antes se comprimía (×4 en la ciudad, ×8 en la ruta);
   quedan las constantes en 1 por si alguna vez hace falta una prueba acelerada. */
const MIN = 60_000;
export const TRAVEL_SCALE = 1, TRAVEL_SCALE_FAR = 1, FAR_KM = 50;

export const VEHICLES: Record<Vehicle, { name: string; lvl: number; price: number; city: number; road: number; help: string }> = {
  moto: { name: "Moto 150 usada", lvl: 15, price: 6000, city: 32, road: 100, help: "Rápida en la ciudad. Te paran seguido." },
  auto: { name: "Sedán del 79 con historia", lvl: 25, price: 25000, city: 28, road: 110, help: "El más rápido en la ruta. Se puede polarizar." }
};
export type ModKey = "motor" | "papeles" | "polarizado";
export const MODS: Record<ModKey, { name: string; help: string; price: Partial<Record<Vehicle, number>> }> = {
  motor:      { name: "Motor preparado",     help: "+25% de velocidad",                              price: { moto: 2500, auto: 6000 } },
  papeles:    { name: "Papeles en regla",    help: "Te paran la mitad de las veces",                  price: { moto: 1500, auto: 3000 } },
  polarizado: { name: "Vidrios polarizados", help: "No te ven llegar y en los controles no te reconocen", price: { auto: 4000 } }
};
export const hasVehicle = (s: PlayerState, v: Vehicle) => !!s.garage?.[v];
export const hasMod = (s: PlayerState, v: Vehicle, m: ModKey) => !!s.garage?.[v]?.includes(m);

export const TRAVEL: Record<TravelMode, { name: string; verb: string }> = {
  pie:       { name: "A pie",               verb: "caminando" },
  colectivo: { name: "Colectivo",           verb: "en colectivo" },
  riel:      { name: "Subte y tren",        verb: "en subte y tren" },
  taxi:      { name: "Taxi",                verb: "en taxi" },
  micro:     { name: "Micro de larga distancia", verb: "en micro" },
  moto:      { name: "Tu moto",             verb: "en tu moto" },
  auto:      { name: "Tu auto",             verb: "en tu auto" },
  ambulancia:{ name: "Ambulancia",          verb: "en ambulancia" }
};
/* líneas de colectivo de verdad, para la crónica */
const BUS_LINES = ["29", "152", "60", "39", "10", "64", "86", "24", "33", "130", "168", "17"];

/* el recorrido de un lugar a otro (desde tu casa); si es el mismo barrio, no hay viaje.
   Si no hay uno guardado, se estima por la distancia (el servidor después lo calcula por las cuadras). */
export const kmAir = (a: string, b: string) => {
  const p = GEO_PLACES[a], q = GEO_PLACES[b];
  if (!p || !q) return 0;
  const R = 6371, r = Math.PI / 180;
  const h = Math.sin((q.lat - p.lat) * r / 2) ** 2 + Math.cos(p.lat * r) * Math.cos(q.lat * r) * Math.sin((q.lng - p.lng) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
export const routeTo = (from: string, place?: string): GeoRoute | undefined => {
  if (!place || place === from || !GEO_PLACES[place] || !GEO_PLACES[from]) return undefined;
  const saved = GEO_ROUTES[from]?.[place];
  if (saved) return saved;
  const km = Math.round(kmAir(from, place) * 1.3 * 100) / 100;
  return { calle: km, ...(km < 20 ? { pie: km } : {}) };
};
export const isFar = (place: string) => !!GEO_PLACES[place]?.interior;

/* desde un punto cualquiera de la calle (volviendo de algo) no hay subte ni tren: el recorrido es por las calles */
export interface FromPoint { km: number; path?: [number, number][] }
const routeFrom = (s: PlayerState, place: string, fp?: FromPoint): GeoRoute | undefined =>
  fp ? { calle: fp.km, ...(fp.km < 20 ? { pie: fp.km } : {}) } : routeTo(homePlace(s), place);

/* medios que se pueden usar para ir a un lugar (desde tu casa, o desde donde estés) */
export function travelModes(s: PlayerState, place: string, fp?: FromPoint): TravelMode[] {
  const r = routeFrom(s, place, fp);
  if (!r) return [];
  const far = isFar(place);
  return TRAVEL_MODES.filter(m =>
    m === "pie" ? !far && !!r.pie :
    m === "colectivo" ? !far :
    m === "riel" ? !!r.riel :
    m === "micro" ? far :
    m === "moto" || m === "auto" ? hasVehicle(s, m) : true);
}

const roadSpeed = (km: number, city: number, road: number) => (km > FAR_KM ? road : city);
/* horas de viaje (de verdad, sin comprimir), solo ida */
function tripHours(s: PlayerState, mode: TravelMode, r: GeoRoute): number {
  const km = r.calle;
  switch (mode) {
    case "pie": return (r.pie ?? km) / 5;
    case "colectivo": return km / 14 + 0.1;
    case "riel": return (r.riel ?? []).reduce((a, l) => a + (l.kind === "pie" ? l.km / 5 : l.km / (l.kind === "subte" ? 30 : l.km > FAR_KM ? 60 : 40) + 0.07), 0);
    case "taxi": return km / roadSpeed(km, 25, 85);
    case "micro": return km / 70 + 0.33;
    case "ambulancia": return km / roadSpeed(km, 45, 110);
    case "moto": case "auto": {
      const v = VEHICLES[mode];
      return km / (roadSpeed(km, v.city, v.road) * (hasMod(s, mode, "motor") ? 1.25 : 1));
    }
  }
}
/* minutos de verdad que tarda la ida (la vuelta es igual) */
export function tripMins(s: PlayerState, mode: TravelMode, place: string, fp?: FromPoint): number {
  const r = routeFrom(s, place, fp);
  if (!r) return 0;
  return Math.max(1, Math.round(tripHours(s, mode, r) * 60 / (r.calle > FAR_KM ? TRAVEL_SCALE_FAR : TRAVEL_SCALE)));
}
/* lo que sale el viaje (ida y vuelta) */
export function tripCost(s: PlayerState, mode: TravelMode, place: string, fp?: FromPoint): number {
  const r = routeFrom(s, place, fp);
  if (!r) return 0;
  const km = r.calle;
  const one =
    mode === "colectivo" ? 1 :
    mode === "riel" ? (r.riel ?? []).reduce((a, l) => a + (l.kind === "pie" ? 0 : l.km > FAR_KM ? Math.round(l.km * 0.05) : 1), 0) :
    mode === "taxi" ? (gangOf(s) === "amarillos" ? 0 : Math.round(km * 2.5)) : // a los Amarillos los lleva un compañero
    mode === "micro" ? Math.round(km * 0.1) :
    mode === "moto" ? Math.round(km * 0.15) :
    mode === "auto" ? Math.round(km * 0.3) : 0;
  return one * 2;
}
/* Caminar cansa: cada km a pie gasta 1 de energía (también los tramos a pie del subte y tren). Se cobra la ida al salir
   y la vuelta al volver. Ir a curarte es la excepción: no se cobra. */
export const WALK_KM_PER_ENERGY = 1;
export function walkKm(s: PlayerState, mode: TravelMode, place: string, fp?: FromPoint): number {
  const r = routeFrom(s, place, fp);
  if (!r) return 0;
  return mode === "pie" ? r.pie ?? r.calle : mode === "riel" ? (r.riel ?? []).reduce((a, l) => a + (l.kind === "pie" ? l.km : 0), 0) : 0;
}
export const walkEnergy = (s: PlayerState, mode: TravelMode, place: string, fp?: FromPoint) =>
  Math.round(walkKm(s, mode, place, fp) / WALK_KM_PER_ENERGY);

/* cómo de riesgoso es cada medio (para mostrar) */
export const TRAVEL_RISK: Record<TravelMode, string> = {
  pie: "lento, casi sin riesgo", colectivo: "barato; algún punga", riel: "rápido y barato; algún punga",
  taxi: "rápido; el taxista puede ser buchón", micro: "controles en la ruta",
  moto: "rápido; te paran y te ven llegar", auto: "rápido; te paran y te ven llegar", ambulancia: "a los pedos"
};

/* ---------- dónde te curan ---------- */
/* guardias de hospitales públicos (gratis, vas caminando) y clínicas privadas (pagás y te busca una ambulancia) */
const NAMED_HOSPITALS: { place: string; name: string }[] = [
  { place: "Balvanera", name: "Hospital Ramos Mejido" }, { place: "Palermo", name: "Hospital Fernandito" },
  { place: "Liniers", name: "Hospital Santojanito" }, { place: "Recoleta", name: "Hospital Rivadavio" },
  { place: "Coghlan", name: "Hospital Pirovanito" }, { place: "Caballito", name: "Hospital Durandito" },
  { place: "Villa Devoto", name: "Hospital Zubizarretita" }, { place: "Flores", name: "Hospital Álvarez Chico" },
  { place: "Villa Ortúzar", name: "Hospital Tornucito" }
];
const NAMED_CLINICS: { place: string; name: string }[] = [
  { place: "Recoleta", name: "Sanatorio Recoleta" }, { place: "Palermo", name: "Clínica Palermo" },
  { place: "Puerto Madero", name: "Clínica del Puerto" }, { place: "Belgrano", name: "Sanatorio Belgrano" }
];
/* cada barrio tiene dónde curarse: los que no tienen hospital, una salita; los barrios caros, además, una clínica */
export const HOSPITALS = [...NAMED_HOSPITALS, ...Object.keys(GEO_PLACES).filter(b => !NAMED_HOSPITALS.some(h => h.place === b))
  .map(b => ({ place: b, name: `Salita de ${b}` }))];
export const CLINICS = [...NAMED_CLINICS, ...Object.keys(GEO_PLACES).filter(b => tierOf(b) === "rico" && !NAMED_CLINICS.some(h => h.place === b))
  .map(b => ({ place: b, name: `Clínica ${b}` }))];
/* el más cerca de tu casa (o de un punto, si ya andás por la calle) */
export function nearestCare(s: PlayerState, kind: "guardia" | "clinica", kmFrom?: (place: string) => number) {
  const list = kind === "guardia" ? HOSPITALS : CLINICS, home = homePlace(s);
  const km = kmFrom ?? ((p: string) => (p === home ? 0 : kmAir(home, p)));
  return [...list].sort((a, b) => km(a.place) - km(b.place))[0];
}

/* Lo que puede pasar en un tramo del viaje. Devuelve true si pasó algo. */
export function tripEvent(s: PlayerState, mode: TravelMode, place: string, back: boolean, at: number, rng: Rng): boolean {
  const where = back ? "tu casa" : place;
  const punga = (chance: number, share: number, how: string) => {
    if (rng() >= chance || s.gold <= 0) return false;
    const lost = Math.max(1, Math.round(s.gold * share)); s.gold -= lost;
    log(s, at, `Viajando ${how} a ${where} te afanaron ${money(lost)} de la mochila.`, "bad");
    return true;
  };
  switch (mode) {
    case "ambulancia": return false;
    case "pie": return punga(0.03, 0.03, "caminando");
    case "colectivo": return punga(0.06, 0.05, `en el ${pick(rng, BUS_LINES)}`);
    case "riel": return punga(0.04, 0.04, "en el subte");
    case "taxi":
      if (gangOf(s) === "amarillos" || rng() >= 0.08) return false;
      addHeat(s, 4);
      log(s, at, `El taxista que te llevó a ${where} era buchón: la policía ya sabe dónde anduviste. +4 de búsqueda.`, "bad");
      return true;
    case "micro":
      if (s.heat < 30 || rng() >= 0.1) return false;
      addHeat(s, 5);
      log(s, at, "Gendarmería paró el micro en la ruta y te miraron demasiado. +5 de búsqueda.", "bad");
      return true;
    case "moto": case "auto": {
      const tint = mode === "auto" && hasMod(s, "auto", "polarizado");
      let happened = false;
      if (!tint) addHeat(s, 1); // te ven llegar
      const chance = (mode === "moto" ? 0.12 : 0.1) * (hasMod(s, mode, "papeles") ? 0.5 : 1);
      if (rng() < chance) {
        const known = s.heat >= 40 && !tint;
        const fine = Math.min(s.gold, (15 + s.lvl * 5) * (known ? 2 : 1));
        s.gold -= fine;
        if (known) addHeat(s, 6);
        log(s, at, known ? `Control policial camino a ${where}: te reconocieron. Multa de ${money(fine)} y +6 de búsqueda.`
                         : `Control policial camino a ${where}: multa de ${money(fine)}.`, "bad");
        happened = true;
      }
      return happened;
    }
  }
}

/* texto para la crónica al salir */
export function tripText(s: PlayerState, mode: TravelMode, place: string, rng: Rng, fp?: FromPoint) {
  const r = routeFrom(s, place, fp)!;
  const how = mode === "colectivo" ? `en el ${pick(rng, BUS_LINES)}`
    : mode === "riel" ? (r.riel ?? []).filter(l => l.kind !== "pie").map(l => l.kind === "subte" ? `la línea ${l.line} del subte` : `el tren ${l.line}`).join(" y ")
    : TRAVEL[mode].verb;
  return `${mode === "riel" ? "Tomás " : "Salís "}${how} hacia ${place} (${Math.round(r.calle)} km).`;
}

/* ---------- dónde está tu personaje (para el GPS) ---------- */
export interface TripState { mode: TravelMode; place: string; go: number; back: number; ev: number; from?: string; // from: de qué casa salió (antes: la pensión)
  path?: [number, number][] } // si salió desde un punto de la calle: el camino por las cuadras
export type TripPhase = { phase: "ida" | "alla" | "vuelta"; frac: number; left: number }; // left: ms que faltan para llegar
export function tripPhase(b: { since: number; until: number; trip?: TripState | null }, now: number): TripPhase | null {
  const t = b.trip;
  if (!t) return null;
  const arrive = b.since + t.go, leave = b.until - t.back;
  if (now < arrive) return { phase: "ida", frac: (now - b.since) / Math.max(1, t.go), left: arrive - now };
  if (now < leave) return { phase: "alla", frac: 1, left: 0 };
  return { phase: "vuelta", frac: Math.min(1, (now - leave) / Math.max(1, t.back)), left: Math.max(0, b.until - now) };
}
export const tripMs = (mins: number) => mins * MIN;
export const tripKm = (from: string, place: string, mode: TravelMode) => {
  const r = routeTo(from, place);
  if (!r) return 0;
  return mode === "pie" ? r.pie ?? r.calle : mode === "riel" ? (r.riel ?? []).reduce((a, l) => a + l.km, 0) : r.calle;
};
export const randomPlace = (rng: Rng, far = false) =>
  pick(rng, Object.keys(GEO_PLACES).filter(p => !!GEO_PLACES[p].interior === far && p !== GEO_HOME));
