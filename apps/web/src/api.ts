import type { Action, ActionResult, Gang, PlayerState } from "@pop/shared";

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
export interface RankRow { name: string; gang: Gang | null; resp: number; lvl: number; me: boolean; npc: boolean }

export const api = {
  register: (username: string, password: string, avatar: number) => call("/api/auth/register", { username, password, avatar }),
  login: (username: string, password: string) => call("/api/auth/login", { username, password }),
  logout: () => call("/api/auth/logout", {}),
  me: () => call<Snapshot & { id: number }>("/api/me"),
  act: (a: Action) => call<Snapshot & { result: ActionResult }>("/api/action", a),
  ranking: () => call<RankRow[]>("/api/ranking")
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
