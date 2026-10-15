import type { Action, ActionResult, Gang, Mission, PlayerState, TravelerView } from "@pop/shared";

export class ApiError extends Error { constructor(msg: string, public status: number) { super(msg); } }

/* dirección del servidor: vacía = el mismo sitio que la pantalla */
const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(API + path, body === undefined ? { credentials: "include" } : {
    method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "Algo salió mal.", res.status);
  return data as T;
}

export interface Snapshot { state: PlayerState; now: number }
export interface BarrioView { barrio: string; owner: Gang | null; points: Record<Gang, number> }
export interface RingView {
  season: string; seasonName: string; rounds: number; done: number; nextRoundAt: number | null; closesAt: number; joined: boolean;
  table: { place: number; name: string; npc: boolean; me: boolean; points: number; wins: number; losses: number; lvl: number }[];
  matches: { round: number; rival: string | null; won: boolean }[];
  history: { season: string; name: string; place: number; points: number; entrants: number }[];
  champions: { season: string; seasonName: string; name: string; points: number }[];
}
export interface Person { id: number; name: string; lvl: number; gang: Gang | null; avatar: number; online: boolean; bot?: boolean }
export interface FriendsView {
  friends: Person[]; incoming: Person[]; outgoing: Person[];
  invites: { id: number; from: string; mission: Mission }[]; sent: { id: number; to: string; mission: Mission }[];
}
/* alguien que está en la calle ahora (para el mapa) */
export type Traveler = TravelerView;
export interface RankRow { name: string; gang: Gang | null; resp: number; lvl: number; me: boolean; npc: boolean; bot?: boolean }

export const api = {
  register: (username: string, password: string, avatar: number) => call("/api/auth/register", { username, password, avatar }),
  login: (username: string, password: string) => call("/api/auth/login", { username, password }),
  logout: () => call("/api/auth/logout", {}),
  me: () => call<Snapshot & { id: number }>("/api/me"),
  act: (a: Action) => call<Snapshot & { result: ActionResult }>("/api/action", a),
  ranking: () => call<RankRow[]>("/api/ranking"),
  news: () => call<{ t: number; msg: string }[]>("/api/news"),
  travelers: () => call<{ now: number; people: Traveler[]; online?: number }>("/api/travelers"),
  territory: () => call<{ map: BarrioView[]; owned: Record<Gang, number> }>("/api/territory"),
  friends: () => call<FriendsView>("/api/friends"),
  ring: () => call<RingView>("/api/ring"),
  ringJoin: () => call("/api/ring/join", {}),
  addFriend: (name: string) => call<{ ok: boolean; accepted: boolean }>("/api/friends/add", { name }),
  acceptFriend: (id: number) => call("/api/friends/accept", { id }),
  removeFriend: (id: number) => call("/api/friends/remove", { id }),
  coopInvite: (friendId: number) => call("/api/coop/invite", { friendId }),
  coopRespond: (id: number, accept: boolean) => call("/api/coop/respond", { id, accept }),
  coopCancel: (id: number) => call("/api/coop/cancel", { id })
};

/* Avisos en vivo. Se reconecta solo si se corta. */
export function connectLive(onMsg: (m: any) => void, onStatus: (up: boolean) => void) {
  let ws: WebSocket | null = null, stop = false, retry = 1000;
  const open = () => {
    const base = new URL(API || location.origin);
    ws = new WebSocket(`${base.protocol === "https:" ? "wss" : "ws"}://${base.host}/api/ws`);
    ws.onopen = () => { retry = 1000; onStatus(true); };
    ws.onmessage = e => { try { onMsg(JSON.parse(e.data)); } catch {} };
    ws.onclose = () => { onStatus(false); if (!stop) setTimeout(open, retry = Math.min(retry * 2, 30000)); };
  };
  open();
  return () => { stop = true; ws?.close(); };
}
