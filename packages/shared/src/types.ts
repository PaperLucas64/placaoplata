import type { TravelMode, TripState } from "./geo.js";

export type Gang = "familia" | "sindicato" | "barra" | "amarillos";
export type StatKey = "fue" | "dur" | "ref" | "agu" | "lab";
export type TabKey = "laburos" | "gimnasio" | "feria" | "ring" | "guardia" | "misiones" | "calle" | "casa" | "negocios" | "amigos" | "ranking" | "equipo";
export type Rng = () => number;

export interface Job {
  id: string; name: string; cost: number; risk: 1 | 2 | 3;
  gold: [number, number]; xp: [number, number]; lvl: number; fail: string;
  resp?: number; heat?: number;
}
export interface RingRival { name: string; lvl: number; mult: number; lore: string }
/* lugares de equipo, estilo RPG: dos para pegar y tres para que no te peguen */
export type Slot = "blanca" | "fuego" | "cabeza" | "torso" | "ropa";
export interface Item {
  id: string; slot: Slot | "consumible"; name: string; val: number; price: number; lvl: number;
  bonus?: Partial<Record<StatKey, number>>; // lo que te suma a cada atributo mientras lo tenés puesto
  event?: string;           // ítem de un evento: no se vende
  rank?: number;
}
export interface MissionStep {
  text: string; energy: number;
  stat?: StatKey; diff?: number; dmg?: number; ok?: string; ko?: string;
  fight?: { name: string; mult: number }; win?: string; lose?: string;
  auto?: boolean;
}
export interface Mission {
  id: string; rank: number; title: string; intro: string; steps: MissionStep[]; outro: string;
  gang?: Gang; tier?: number; // misiones de pandilla: de quién es y si es la 1ª, 2ª o 3ª del hilo
  mins?: number;               // duración en minutos de verdad (si no está, se calcula por tipo)
  req?: Partial<Record<StatKey, number>>; // atributos mínimos para empezarla
  aff?: number;                // afinidad que suma (misiones de calle)
  street?: boolean; difficulty?: number; // misiones de calle generadas: 0 fácil a 3 jodida
  place?: string;              // barrio (o ciudad del interior) donde pasa: ahí viaja tu personaje y ahí suma influencia
  client?: string;             // quién la encarga si no es una pandilla: "vecinos", "policia" o un negocio tuyo
  target?: Gang;               // trabajo sucio para la policía: la pandilla a la que perjudica
  arc?: string; chapter?: number; pov?: Gang | "policia"; // historias de la ciudad: capítulo y bando
  hours?: number;              // trabajos largos en el conurbano: cuántas horas de trabajo
  event?: string;              // solo durante ese evento del calendario
  prize?: string;              // ítem de regalo al salir bien
  reward?: { gold: number; xp: number; resp: number; heat?: number };
  until?: number;              // misiones temporales: se van del mapa a esta hora
  who?: string;                // encuentros raros: quién te lo pide
}

export interface LogEntry { t: number; msg: string; cls?: "good" | "bad" | "gold" }

/* Rivales de La calle: personajes del juego o jugadores reales de otra pandilla (o sueltos) */
export type Target =
  | { kind: "npc"; name: string; lvl: number; gold: number; gang: Gang }
  | { kind: "player"; id: number; name: string; lvl: number; gold: number; avatar?: number; gang: Gang | null; bot?: boolean };

export interface Home {
  cama: number; caja: number; armario: number;
  safe: number;        // plata en la caja fuerte (a salvo de robos y fianzas)
  closet: string[];    // (versión vieja: el armario; ahora todo va al inventario)
  obra: { part: "cama" | "caja" | "armario"; since: number; until: number } | null; // mejora en construcción
  house?: string;      // qué casa tenés (si no está, la pieza de pensión)
  spawn?: string;      // el barrio donde naciste (ahí está tu pieza de pensión)
}

export interface PlayerState {
  v?: number; // versión del formato (2: pandillas y casa)
  name: string; lvl: number; xp: number; gold: number; energy: number; hp: number;
  avatar?: number; // retrato elegido al crear el personaje (1 a 4)
  hpBonus?: number; // vida máxima extra para siempre (suplementos)
  stats: Record<StatKey, number>;
  gear: Record<Slot, string | null>; // lo que tenés puesto en cada lugar
  inv: string[];                     // lo que tenés y no te pusiste (entra según tu armario)
  potions: number; wins: number; losses: number;
  tut: number; tutDone: boolean; tabs: TabKey[]; seenTab: Partial<Record<TabKey, boolean>>;
  c: { jobs: number; train: number; buy: number; spar: number; heal: number; valija: number; duelW: number; duelL: number };
  aff: Record<Gang, number>; // afinidad con cada pandilla (de ahí sale a cuál pertenecés)
  respect: number; heat: number; done: Record<string, boolean>; targets: Target[];
  home: Home;
  board: Mission[]; tBoard: number; // tablón de misiones de calle y cuándo se armó
  tOdd?: number;                     // cuándo apareció el último encuentro raro
  /* misión de a dos aceptada: esperando a que los dos estén libres, o en curso */
  coop?: { id: number; partner: string; partnerId: number; mission: Mission; status: "waiting" | "running" } | null;
  influence?: { gang: Gang; barrio: string; pts: number }[]; // influencia generada, que el servidor suma al mapa
  turf?: number; // barrios que controla tu pandilla (lo completa el servidor)
  props?: Record<string, number>; // negocios que tenés y cuándo cobraste por última vez
  garage?: Partial<Record<"moto" | "auto", string[]>>; // vehículos que tenés y sus arreglos
  tEnergy: number; tHeal: number; tAttack: number; tHeat: number;
  /* algo que lleva tiempo de verdad: mientras dura no se puede trabajar ni pelear */
  busy?: Busy | null;
  log: LogEntry[];
}

export type Busy =
  | { kind: "gym"; since: number; until: number; stat: StatKey }
  | { kind: "guardia"; since: number; until: number; hpFrom: number; trip?: TripState | null; clinic?: boolean } // curándote (intocable)
  /* un golpe o un encargo: vas al barrio, lo hacés y volvés (el resultado se sabe al llegar) */
  | { kind: "salida"; since: number; until: number; what: "golpe" | "encargo"; ref: string; place: string; trip?: TripState | null }
  /* volviendo a casa después de algo: estás en la calle y podés arrancar otra cosa desde donde estés */
  | { kind: "vuelta"; since: number; until: number; mode: TravelMode; place: string; home: string; path?: [number, number][]; safe?: boolean;
      label?: string; ok?: boolean } // de qué venís (y si salió bien), para la leyenda del mapa
  | { kind: "mision"; since: number; until: number; id: string; done: number; ok: number; res?: boolean[]; // etapas resueltas, cuántas salieron bien y cuáles
      trip?: TripState | null }                                                                           // el viaje: medio, destino, ida y vuelta
  /* saliste a cruzar a alguien: vas hasta donde lo alcanzás (meet), pelean y volvés */
  | { kind: "caza"; since: number; until: number; meet: number; target: number; targetName: string; place: string;
      from: [number, number]; at: [number, number]; mode: "pie" | "taxi" | "moto" | "auto"; path?: [number, number][] };

export interface Fighter { name: string; hp: number; max: number; fue: number; dur: number; ref: number; arma: number; armadura: number }
export interface FightView { p: Fighter; e: Fighter; rounds: { who: "p" | "e"; txt: string }[]; won: boolean }

/* Lo que vuelve de cada acción además del estado nuevo */
export interface ActionResult { error?: string; fight?: FightView; mission?: { ok: boolean; text: string } }

export type Action =
  | { type: "claimTut" }
  | { type: "seen"; tab: TabKey }
  | { type: "job"; id: string; at?: string } // at: el lugar del mapa donde lo hacés (los golpes)
  | { type: "encargo"; gang: Gang }
  | { type: "train"; stat: StatKey }
  | { type: "buy"; id: string }
  | { type: "equip"; id: string }       // ponerte algo del inventario
  | { type: "unequip"; slot: Slot }     // sacártelo (vuelve al inventario)
  | { type: "sell"; id: string }        // vender algo del inventario en la feria
  | { type: "kit" }
  | { type: "heal" }                    // clínica: paga y es al instante
  | { type: "guardia" }                 // hospital público: gratis, pero esperás
  | { type: "cancel" }                  // cortar lo que estés haciendo
  | { type: "spar"; i: number }
  | { type: "mstart"; id: string; mode?: TravelMode }
  | { type: "prop"; id: string }        // comprar un negocio
  | { type: "collect" }                 // cobrar lo que juntaron tus negocios
  | { type: "vehicle"; v: "moto" | "auto" }
  | { type: "mod"; v: "moto" | "auto"; mod: string }
  | { type: "reroll" }                  // renovar el tablón de misiones de calle
  | { type: "lawyer" }
  | { type: "build"; part: "cama" | "caja" | "armario" }
  | { type: "move"; id: string }        // mudarte a otra casa
  | { type: "deposit"; amount: number }
  | { type: "withdraw"; amount: number }
  | { type: "scout" }
  | { type: "duel"; i: number }
  | { type: "chase"; id: number; mode: "pie" | "taxi" | "moto" | "auto" }; // salir a cruzar a un jugador que está en la calle
