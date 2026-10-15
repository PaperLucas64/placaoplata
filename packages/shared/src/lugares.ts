/* Los lugares de Maires, como los íconos del mapa de GTA: contactos que dan misiones, servicios, lugares para robar,
   trabajos, negocios y eventos. Cada uno está en un punto real del mapa, en un barrio (de ahí sale el viaje).
   Se destraban con el progreso (tutorial, nivel, rango) o con eventos del calendario (Halloween). */
import { houseOf } from "./casas.js";
import { GOLPES } from "./gangs.js";
import { POLICE_LVL } from "./missions.js";
import { JOBS } from "./data.js";
import { rankOf } from "./rules.js";
import type { Gang, PlayerState, TabKey } from "./types.js";

export type LugarKind =
  | "bar" | "casa" | "gym" | "estadio" | "mercado" | "salud" | "contacto" | "policia"
  | "golpe" | "laburo" | "negocio" | "concesionaria" | "evento" | "municipio";

export interface Lugar {
  id: string; name: string; kind: LugarKind; icon: string; barrio: string; lat: number; lng: number;
  help: string;
  color?: string;           // color del pin (si no, el de su categoría)
  gang?: Gang;              // contactos de pandilla
  job?: string;             // golpe o laburo que se hace acá
  prop?: string;            // negocio que se compra acá
  care?: "guardia" | "clinica";
  event?: string;           // solo durante ese evento
  tab?: TabKey;             // pestaña que tiene que estar destrabada
  lvl?: number; rank?: number; tutDone?: boolean;
}

/* colores por categoría (como los blips de GTA) */
export const KIND_COLOR: Record<LugarKind, string> = {
  bar: "#e6a14f", casa: "#e8e1d2", gym: "#5bc0de", estadio: "#5bc0de", mercado: "#8bd17c", salud: "#ff6b6b",
  contacto: "#e8e1d2", policia: "#cfd6e2", golpe: "#e0524f", laburo: "#9aa3ad", negocio: "#b98be0",
  concesionaria: "#b98be0", evento: "#ff8c1a", municipio: "#9aa3ad"
};
export const KIND_NAME: Record<LugarKind, string> = {
  bar: "Contacto", casa: "Tu casa", gym: "Gimnasio", estadio: "Ring", mercado: "Mercado", salud: "Salud", contacto: "Contacto",
  policia: "Contacto", golpe: "Para robar", laburo: "Trabajo", negocio: "Negocio", concesionaria: "Vehículos", evento: "Evento", municipio: "Ciudad"
};

const L = (l: Lugar) => l;
export const LUGARES: Lugar[] = [
  /* contactos (los «Lester» de Maires) */
  L({ id: "bar-esquina", name: "Bar La Esquina", kind: "bar", icon: "bar", barrio: "San Telmón", lat: -34.6206, lng: -58.3718,
      help: "El bar de Marga. Acá empezó todo: sus encargos y La valija." }),
  L({ id: "senora", name: "La casona de La Señora", kind: "contacto", icon: "familia", gang: "familia", barrio: "Puerto Mareo", lat: -34.6088, lng: -58.3626,
      help: "La Familia. La Señora recibe de noche y no repite las cosas.", tutDone: true }),
  L({ id: "galpon3", name: "Galpón 3 del Sindicato", kind: "contacto", icon: "sindicato", gang: "sindicato", barrio: "Barrancas", lat: -34.6470, lng: -58.3770,
      help: "El Sindicato. El Gordo Bermejo atiende entre grúas y bombos.", tutDone: true }),
  L({ id: "bombonerita", name: "La Bombonerita", kind: "contacto", icon: "barra", gang: "barra", barrio: "La Bocota", lat: -34.6356, lng: -58.3647,
      help: "La Barra. El Tano Lucero vive en la tribuna, aunque no haya partido.", tutDone: true }),
  L({ id: "remises-rita", name: "Remises Rita", kind: "contacto", icon: "amarillos", gang: "amarillos", barrio: "Once y Medio", lat: -34.6095, lng: -58.4045,
      help: "Los Amarillos. Rita «Taxi» Quiroga maneja la ciudad desde una radio.", tutDone: true }),
  L({ id: "comisaria", name: "Comisaría 4ª", kind: "policia", icon: "policia", barrio: "San Telmón", lat: -34.6178, lng: -58.3757,
      help: "El comisario Funes ofrece trabajos sucios. La comisaria Ríos no se tiene que enterar.", lvl: POLICE_LVL }),
  /* servicios */
  L({ id: "gimnasio", name: "Gimnasio de Don Tito", kind: "gym", icon: "gym", barrio: "San Telmón", lat: -34.6232, lng: -58.3742,
      help: "Entrenar y el ring de práctica. Don Tito vende también el suplemento.", tab: "gimnasio" }),
  L({ id: "luna-parquecito", name: "Estadio Luna Parquecito", kind: "estadio", icon: "estadio", barrio: "San Telmón", lat: -34.6025, lng: -58.3685,
      help: "El torneo mensual del Ring, en rondas suizas.", tab: "ring" }),
  L({ id: "feria", name: "Feria de usados de Pompeya Chica", kind: "mercado", icon: "mercado", barrio: "Pompeya Chica", lat: -34.6512, lng: -58.4168,
      help: "Armas, cascos, chalecos y ropa. Al fondo, el mercado negro.", tab: "feria" }),
  L({ id: "autos-bajo", name: "Concesionaria Autos del Bajo", kind: "concesionaria", icon: "concesionaria", barrio: "Florida Vieja", lat: -34.5303, lng: -58.4880,
      help: "Motos y autos usados, y arreglos para el que tenga con qué.", tutDone: true }),
  L({ id: "municipalidad", name: "Municipalidad de Maires", kind: "municipio", icon: "municipio", barrio: "Recoleta Bien", lat: -34.5905, lng: -58.3915,
      help: "Acá se ve quién manda en cada barrio y el ranking de la ciudad.", tutDone: true }),
  /* para robar (los golpes pasan siempre en estos lugares) */
  L({ id: "plaza-misere", name: "Plaza Misere", kind: "golpe", icon: "celulares", job: "celu", barrio: "Once y Medio", lat: -34.6098, lng: -58.4060,
      help: "Mucha gente mirando el teléfono. Mucha.", tutDone: true }),
  L({ id: "estacionamiento-soja", name: "Estacionamiento de Palermo Soja", kind: "golpe", icon: "estereos", job: "estereo", barrio: "Palermo Soja", lat: -34.5876, lng: -58.4318,
      help: "Autos caros, estéreos más caros.", tutDone: true }),
  L({ id: "desarmadero-tuerca", name: "Desarmadero El Tuerca", kind: "golpe", icon: "desarmadero", job: "desarme", barrio: "Barrancas", lat: -34.6505, lng: -58.3860,
      help: "Piezas sin número de motor, a la vista de todos.", tutDone: true }),
  L({ id: "desarmadero-cacho", name: "Autopartes Lo de Cacho", kind: "golpe", icon: "desarmadero", job: "desarme", barrio: "Liniers Sur", lat: -34.6445, lng: -58.5225,
      help: "Si te falta un repuesto, Cacho te lo consigue. De algún auto.", tutDone: true }),
  L({ id: "estacion-costanera", name: "YPFita de la Costanera", kind: "golpe", icon: "estacion", job: "estacion", barrio: "Puerto Mareo", lat: -34.6050, lng: -58.3602,
      help: "Abierta las 24 horas. El playero, también.", tutDone: true }),
  L({ id: "estacion-avenida", name: "Shellita Avenida", kind: "golpe", icon: "estacion", job: "estacion", barrio: "Liniers Sur", lat: -34.6400, lng: -58.5150,
      help: "Sobre la General Paz de mentira.", tutDone: true }),
  L({ id: "muelle4", name: "Muelle 4", kind: "golpe", icon: "puerto", job: "contra", barrio: "Puerto Mareo", lat: -34.6002, lng: -58.3642,
      help: "Lo que entra sin papeles entra por acá.", tutDone: true }),
  L({ id: "financiera", name: "Financiera Las Cuevas", kind: "golpe", icon: "banco", job: "financ", barrio: "Once y Medio", lat: -34.6075, lng: -58.4000,
      help: "Cambian dólares, prestan pesos y no preguntan nada.", tutDone: true }),
  /* trabajos honestos */
  L({ id: "bicis-rodado", name: "Bicis Rodado 26", kind: "laburo", icon: "reparto", job: "bici", barrio: "Palermo Soja", lat: -34.5896, lng: -58.4285,
      help: "Repartos en bici. Paga poco, se cobra en el día." }),
  L({ id: "lavadero-costanera", name: "Lavadero de la estación", kind: "laburo", icon: "lavadero", job: "lavado", barrio: "Puerto Mareo", lat: -34.6058, lng: -58.3612,
      help: "Lavar autos que no son tuyos, por ahora." }),
  L({ id: "boliche-puerta", name: "Puerta del boliche Soja", kind: "laburo", icon: "boliche", job: "puerta", barrio: "Palermo Soja", lat: -34.5866, lng: -58.4308,
      help: "Decidir quién entra y quién no." }),
  L({ id: "remiseria-noche", name: "Remisería Nocturna", kind: "laburo", icon: "taxi", job: "chofer", barrio: "Once y Medio", lat: -34.6110, lng: -58.4025,
      help: "Manejar de noche a gente que no quiere ser vista." }),
  L({ id: "deposito7", name: "Depósito 7", kind: "laburo", icon: "deposito", job: "deposito", barrio: "Puerto Mareo", lat: -34.6030, lng: -58.3655,
      help: "Seguridad en un depósito del puerto. Mirar sin ver." }),
  /* evento: Halloween */
  L({ id: "cementerio", name: "Cementerio de Recoleta Bien", kind: "evento", icon: "calabaza", event: "halloween", barrio: "Recoleta Bien", lat: -34.5876, lng: -58.3932,
      help: "Noche de Brujas: alguien está robando de las bóvedas.", tutDone: true })
];

/* hospitales y clínicas: ya existen, se ubican cerca del centro de su barrio */
export const careLugar = (name: string, place: string, care: "guardia" | "clinica", lat: number, lng: number): Lugar =>
  ({ id: `${care}-${place}`, name, kind: "salud", icon: care === "guardia" ? "hospital" : "clinica", care, barrio: place, lat, lng,
     help: care === "guardia" ? "Guardia gratis: vas caminando y esperás." : "Clínica privada: pagás y te busca una ambulancia.", tab: "guardia" });

/* ---------- eventos del calendario ---------- */
export interface GameEvent { id: string; name: string; from: [number, number]; to: [number, number] } // [mes, día], hora de Argentina
export const EVENTS: GameEvent[] = [{ id: "halloween", name: "Noche de Brujas", from: [10, 24], to: [11, 2] }];
export function activeEvents(now: number): string[] {
  const d = new Date(now - 3 * 3_600_000);  // Argentina
  const md = (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  return EVENTS.filter(e => md >= e.from[0] * 100 + e.from[1] && md <= e.to[0] * 100 + e.to[1]).map(e => e.id);
}

/* ¿ya podés ir? */
export function lugarOpen(s: PlayerState, l: Lugar, now: number) {
  if (l.event && !activeEvents(now).includes(l.event)) return false;
  if (l.tutDone && !s.tutDone) return false;
  if (l.tab && !s.tabs.includes(l.tab)) return false;
  if (l.lvl && s.lvl < l.lvl) return false;
  if (l.rank && rankOf(s) < l.rank) return false;
  if (l.job) {
    const j = [...JOBS, ...GOLPES].find(x => x.id === l.job);
    if (j && s.lvl + 2 < j.lvl) return false; // se ve un poco antes de poder hacerlo
  }
  return true;
}
export const lugarOf = (id: string) => LUGARES.find(l => l.id === id);
export const gangLugar = (g: Gang) => LUGARES.find(l => l.kind === "contacto" && l.gang === g)!;
export const homeLugar = (s: PlayerState): Lugar => {
  const h = houseOf(s);
  return { id: "casa", name: h.name, kind: "casa", icon: "casa", barrio: h.place, lat: 0, lng: 0, help: "Tu guarida: de acá salen y acá vuelven tus viajes." };
};
