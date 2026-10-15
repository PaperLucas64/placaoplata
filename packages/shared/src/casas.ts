/* Tu guarida: arrancás en una pieza de pensión en el barrio donde caíste y te podés mudar.
   Cada barrio vende tres casas, más caras o más baratas según el barrio. Todos los viajes salen de tu casa,
   y cada casa deja mejorar la cama, la caja fuerte y el armario hasta cierto punto. */
import { tierOf, type Tier } from "./barrios.js";
import { GEO_HOME, GEO_PLACES } from "./geo-data.js";
import type { PlayerState } from "./types.js";

export interface HouseType { name: string; lvl: number; price: number; cap: number; help: string }
export const HOUSE_TYPES: Record<string, HouseType> = {
  pieza:   { name: "Pieza de pensión",            lvl: 1,  price: 0,      cap: 1, help: "Una pieza en el barrio donde caíste. Marga te la consiguió." },
  depto:   { name: "Departamento de un ambiente", lvl: 6,  price: 4000,   cap: 2, help: "Contrafrente, sexto piso sin ascensor." },
  ph:      { name: "PH con terraza",              lvl: 10, price: 10000,  cap: 3, help: "Un pasillo largo, una terraza y vecinos que no preguntan." },
  casa:    { name: "Casa con patio",              lvl: 15, price: 25000,  cap: 4, help: "Portón para el auto y un sótano que nadie conoce." },
  chalet:  { name: "Chalet con pileta",           lvl: 22, price: 60000,  cap: 5, help: "Árboles, silencio y vecinos con alarma." },
  mansion: { name: "Mansión",                     lvl: 28, price: 120000, cap: 5, help: "Para que todo Maires sepa quién manda." }
};
/* qué casas vende cada clase de barrio, y cuánto más caras o más baratas */
const OFFER: Record<Tier, string[]> = { humilde: ["depto", "ph", "casa"], medio: ["depto", "ph", "casa"], rico: ["depto", "chalet", "mansion"] };
const MULT: Record<Tier, number> = { humilde: 0.7, medio: 1, rico: 1.5 };

/* un punto fijo adentro de un barrio para cada cosa (siempre el mismo para la misma clave) */
export function spotIn(barrio: string, key: string): [number, number] {
  const c = GEO_PLACES[barrio] ?? GEO_PLACES[GEO_HOME];
  let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const a = (h % 360) * Math.PI / 180, r = 0.0025 + ((h >>> 8) % 100) / 100 * 0.004;
  return [c.lat + Math.sin(a) * r, c.lng + Math.cos(a) * r];
}

/* Las pensiones donde podés arrancar: naciste en una de estas, al azar */
export const PENSIONES: Record<string, string> = {
  "Once y Medio": "Pensión La Estrella", "Mosecraft": "Hotel Familiar Los Andes", "Floreros": "Pensión Doña Rosa",
  "Villa Crespa": "Residencial El Ombú", "Liniers Sur": "Pensión San Cayetano", "San Nicolasito": "Hotel Familiar Paraná",
  "La Paterna": "Pensión El Tablón", "Villa Mitrecito": "Residencial Mitrecito", "Almagrito": "Pensión Medrano",
  "Villa Lurio": "Hotel Familiar El Trébol"
};

export interface House extends HouseType { id: string; type: string; place: string; lat: number; lng: number }
const make = (type: string, barrio: string): House => {
  const t = HOUSE_TYPES[type];
  const id = type === "pieza" ? "pension" : `${type}@${barrio}`;
  const [lat, lng] = spotIn(barrio, type === "pieza" ? `pension-${barrio}` : id); // cada casa tiene su dirección
  return { ...t, ...(type === "pieza" && PENSIONES[barrio] ? { name: `Pieza en la ${PENSIONES[barrio]}` } : {}),
    id, type, place: barrio, lat, lng, price: Math.round(t.price * MULT[tierOf(barrio)] / 100) * 100 };
};
/* las tres casas que se venden en un barrio */
export const housesIn = (barrio: string): House[] => OFFER[tierOf(barrio)].map(t => make(t, barrio));

/* casas de versiones anteriores (cuando había una de cada tipo, en un barrio fijo) */
const LEGACY: Record<string, string> = { depto: "depto@Once y Medio", ph: "ph@Villa Crespa", casa: "casa@Villa Devota", chalet: "chalet@Belgranito", mansion: "mansion@Reloquita" };
export function houseById(id?: string): House | undefined {
  if (!id || id === "pension") return undefined;
  const [type, barrio] = (LEGACY[id] ?? id).split("@");
  return HOUSE_TYPES[type] && GEO_PLACES[barrio] ? make(type, barrio) : undefined;
}
export const houseOf = (s: Pick<PlayerState, "home">): House =>
  houseById(s.home?.house) ?? make("pieza", s.home?.spawn && GEO_PLACES[s.home.spawn] ? s.home.spawn : GEO_HOME);
/* el barrio donde vivís: de ahí salen y ahí vuelven todos tus viajes */
export const homePlace = (s: Pick<PlayerState, "home">) => houseOf(s).place;
