export type Gang = "familia" | "sindicato" | "barra" | "amarillos";
export type StatKey = "fue" | "dur" | "ref" | "agu" | "lab";
export type TabKey = "laburos" | "gimnasio" | "feria" | "ring" | "guardia" | "misiones" | "calle" | "casa" | "amigos" | "ranking";
export type Rng = () => number;

export interface Job {
  id: string; name: string; cost: number; risk: 1 | 2 | 3;
  gold: [number, number]; xp: [number, number]; lvl: number; fail: string;
  resp?: number; heat?: number;
}
export interface RingRival { name: string; lvl: number; mult: number; lore: string }
export interface Item {
  id: string; slot: "arma" | "armadura" | "consumible"; name: string; val: number; price: number; lvl: number;
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
  place?: string;              // barrio donde pasa (suma influencia ahí)
  reward?: { gold: number; xp: number; resp: number; heat?: number };
}

export interface LogEntry { t: number; msg: string; cls?: "good" | "bad" | "gold" }

/* Rivales de La calle: personajes del juego o jugadores reales de otra pandilla (o sueltos) */
export type Target =
  | { kind: "npc"; name: string; lvl: number; gold: number; gang: Gang }
  | { kind: "player"; id: number; name: string; lvl: number; gold: number; avatar?: number; gang: Gang | null };

export interface Home {
  cama: number; caja: number; armario: number;
  safe: number;        // plata en la caja fuerte (a salvo de robos y fianzas)
  closet: string[];    // equipo guardado en el armario
  obra: { part: "cama" | "caja" | "armario"; since: number; until: number } | null; // mejora en construcción
}

export interface PlayerState {
  v?: number; // versión del formato (2: pandillas y casa)
  name: string; lvl: number; xp: number; gold: number; energy: number; hp: number;
  avatar?: number; // retrato elegido al crear el personaje (1 a 4)
  hpBonus?: number; // vida máxima extra para siempre (suplementos)
  stats: Record<StatKey, number>;
  gear: { arma: string | null; armadura: string | null };
  potions: number; wins: number; losses: number;
  tut: number; tutDone: boolean; tabs: TabKey[]; seenTab: Partial<Record<TabKey, boolean>>;
  c: { jobs: number; train: number; buy: number; spar: number; heal: number; valija: number; duelW: number; duelL: number };
  aff: Record<Gang, number>; // afinidad con cada pandilla (de ahí sale a cuál pertenecés)
  respect: number; heat: number; done: Record<string, boolean>; targets: Target[];
  home: Home;
  board: Mission[]; tBoard: number; // tablón de misiones de calle y cuándo se armó
  /* misión de a dos aceptada: esperando a que los dos estén libres, o en curso */
  coop?: { id: number; partner: string; partnerId: number; mission: Mission; status: "waiting" | "running" } | null;
  influence?: { gang: Gang; barrio: string; pts: number }[]; // influencia generada, que el servidor suma al mapa
  turf?: number; // barrios que controla tu pandilla (lo completa el servidor)
  tEnergy: number; tHeal: number; tAttack: number; tHeat: number;
  /* algo que lleva tiempo de verdad: mientras dura no se puede trabajar ni pelear */
  busy?: Busy | null;
  log: LogEntry[];
}

export type Busy =
  | { kind: "gym"; since: number; until: number; stat: StatKey }
  | { kind: "guardia"; since: number; until: number; hpFrom: number }
  | { kind: "mision"; since: number; until: number; id: string; done: number; ok: number; res?: boolean[] }; // etapas resueltas, cuántas salieron bien y cuáles

export interface Fighter { name: string; hp: number; max: number; fue: number; dur: number; ref: number; arma: number; armadura: number }
export interface FightView { p: Fighter; e: Fighter; rounds: { who: "p" | "e"; txt: string }[]; won: boolean }

/* Lo que vuelve de cada acción además del estado nuevo */
export interface ActionResult { error?: string; fight?: FightView; mission?: { ok: boolean; text: string } }

export type Action =
  | { type: "claimTut" }
  | { type: "seen"; tab: TabKey }
  | { type: "job"; id: string }
  | { type: "encargo"; gang: Gang }
  | { type: "train"; stat: StatKey }
  | { type: "buy"; id: string }
  | { type: "equip"; id: string }       // sacar algo del armario
  | { type: "kit" }
  | { type: "heal" }                    // clínica: paga y es al instante
  | { type: "guardia" }                 // hospital público: gratis, pero esperás
  | { type: "cancel" }                  // cortar lo que estés haciendo
  | { type: "spar"; i: number }
  | { type: "mstart"; id: string }
  | { type: "reroll" }                  // renovar el tablón de misiones de calle
  | { type: "lawyer" }
  | { type: "build"; part: "cama" | "caja" | "armario" }
  | { type: "deposit"; amount: number }
  | { type: "withdraw"; amount: number }
  | { type: "scout" }
  | { type: "duel"; i: number };
