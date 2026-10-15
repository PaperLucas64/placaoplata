import type { Action, ActionResult, PlayerState } from "@pop/shared";

export class ApiError extends Error { constructor(msg: string, public status: number) { super(msg); } }

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? {} : {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "Algo salió mal.", res.status);
  return data as T;
}

export interface Snapshot { state: PlayerState; now: number }
export interface RankRow { name: string; side: "placa" | "plata"; resp: number; lvl: number; me: boolean; npc: boolean }

export const api = {
  register: (username: string, password: string) => call("/api/auth/register", { username, password }),
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
    ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/ws`);
    ws.onopen = () => { retry = 1000; onStatus(true); };
    ws.onmessage = e => { try { onMsg(JSON.parse(e.data)); } catch {} };
    ws.onclose = () => { onStatus(false); if (!stop) setTimeout(open, retry = Math.min(retry * 2, 30000)); };
  };
  open();
  return () => { stop = true; ws?.close(); };
}
