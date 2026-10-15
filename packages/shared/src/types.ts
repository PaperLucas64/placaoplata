export type Side = "placa" | "plata";
export type StatKey = "fue" | "dur" | "ref" | "agu" | "lab";
export type TabKey = "laburos" | "gimnasio" | "feria" | "ring" | "guardia" | "misiones" | "calle" | "ranking";
export type Rng = () => number;

export interface Job {
  id: string; name: string; cost: number; risk: 1 | 2 | 3;
  gold: [number, number]; xp: [number, number]; lvl: number; fail: string;
  resp?: number; heat?: number;
}
export interface RingRival { name: string; lvl: number; mult: number; lore: string }
export interface Item {
  id: string; slot: "arma" | "armadura" | "consumible"; name: string; val: number; price: number; lvl: number;
  side?: Side; rank?: number;
}
export interface MissionStep {
  text: string; energy: number;
  stat?: StatKey; diff?: number; dmg?: number; ok?: string; ko?: string;
  fight?: { name: string; mult: number }; win?: string; lose?: string;
  auto?: boolean;
}
export interface Mission {
  id: string; rank: number; title: string; intro: string; steps: MissionStep[]; outro: string;
  reward?: { gold: number; xp: number; resp: number; heat?: number };
}

export interface LogEntry { t: number; msg: string; cls?: "good" | "bad" | "gold" }

/* Rivales de La calle: personajes del juego o jugadores reales del otro bando */
export type Target =
  | { kind: "npc"; name: string; lvl: number; gold: number }
  | { kind: "player"; id: number; name: string; lvl: number; gold: number };

export interface PlayerState {
  name: string; lvl: number; xp: number; gold: number; energy: number; hp: number;
  stats: Record<StatKey, number>;
  gear: { arma: string | null; armadura: string | null };
  potions: number; wins: number; losses: number;
  tut: number; tutDone: boolean; tabs: TabKey[]; seenTab: Partial<Record<TabKey, boolean>>;
  c: { jobs: number; train: number; buy: number; spar: number; heal: number; valija: number; duelW: number; duelL: number };
  mis: { id: string; step: number } | null;
  side: Side | null; respect: number; heat: number; done: Record<string, boolean>; targets: Target[];
  tEnergy: number; tHeal: number; tSalary: number; tAttack: number; tHeat: number;
  log: LogEntry[];
}

export interface Fighter { name: string; hp: number; max: number; fue: number; dur: number; ref: number; arma: number; armadura: number }
export interface FightView { p: Fighter; e: Fighter; rounds: { who: "p" | "e"; txt: string }[]; won: boolean }

/* Lo que vuelve de cada acción además del estado nuevo */
export interface ActionResult { error?: string; fight?: FightView; mission?: { ok: boolean; text: string } }

export type Action =
  | { type: "claimTut" }
  | { type: "seen"; tab: TabKey }
  | { type: "job"; id: string }
  | { type: "train"; stat: StatKey }
  | { type: "buy"; id: string }
  | { type: "kit" }
  | { type: "heal" }
  | { type: "spar"; i: number }
  | { type: "mstart"; id: string }
  | { type: "mstep" }
  | { type: "side"; side: Side }
  | { type: "salary" }
  | { type: "lawyer" }
  | { type: "scout" }
  | { type: "duel"; i: number };
