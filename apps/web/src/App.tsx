import { useEffect, useState } from "react";
import { api, ApiError, type Snapshot } from "./api";
import { Auth } from "./Auth";
import { Game } from "./Game";

export function App() {
  const [snap, setSnap] = useState<Snapshot | null | "loading">("loading");

  const load = () => api.me().then(setSnap).catch(e => {
    if (e instanceof ApiError && e.status === 401) setSnap(null);
    else setTimeout(load, 3000); // el servidor todavía está arrancando
  });
  useEffect(() => { load(); }, []);

  if (snap === "loading") return <p className="tag">Cargando Bahía Gris…</p>;
  if (!snap) return <Auth onIn={load} />;
  return <Game initial={snap} onOut={() => api.logout().finally(() => setSnap(null))} />;
}
