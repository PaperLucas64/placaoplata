/* Tu guarida: arrancás en una pieza de pensión arriba del bar de Marga y te podés mudar a algo mejor.
   Todos los viajes salen de tu casa (el lugar importa: más cerca o más lejos de donde trabajás),
   y cada casa deja mejorar la cama, la caja fuerte y el armario hasta cierto punto. */
import type { PlayerState } from "./types.js";

export interface House { id: string; name: string; place: string; lvl: number; price: number; cap: number; help: string }
export const HOUSES: House[] = [
  { id: "pension", name: "Pieza de pensión",            place: "San Telmón",    lvl: 1,  price: 0,      cap: 1, help: "Arriba del bar La Esquina. Marga te cobra en favores." },
  { id: "depto",   name: "Departamento de un ambiente", place: "Once y Medio",  lvl: 6,  price: 4000,   cap: 2, help: "Contrafrente, sexto piso sin ascensor. Cerca de todo." },
  { id: "ph",      name: "PH con terraza",              place: "Villa Crespa",  lvl: 10, price: 10000,  cap: 3, help: "Un pasillo largo, una terraza y vecinos que no preguntan." },
  { id: "casa",    name: "Casa con patio",              place: "Barrancas",     lvl: 15, price: 25000,  cap: 4, help: "Portón para el auto y un sótano que nadie conoce." },
  { id: "chalet",  name: "Chalet con pileta",           place: "San Isidrón",   lvl: 22, price: 60000,  cap: 5, help: "En Zona Norte, lejos del ruido. Y de todo lo demás." },
  { id: "mansion", name: "Mansión",                     place: "Reloquita", lvl: 28, price: 120000, cap: 5, help: "Para que todo Maires sepa quién manda." }
];
export const houseOf = (s: Pick<PlayerState, "home">) => HOUSES.find(h => h.id === s.home?.house) ?? HOUSES[0];
/* el barrio donde vivís: de ahí salen y ahí vuelven todos tus viajes */
export const homePlace = (s: Pick<PlayerState, "home">) => houseOf(s).place;
