import { useEffect, useState } from "react";
import { api, ApiError, type Snapshot } from "./api";
import { Auth } from "./Auth";
import { Game } from "./Game";

export function App() {
  const [snap, setSnap] = useState<Snapshot | null | "loading">("loading");
  const [tries, setTries] = useState(0);

  const load = () => api.me().then(setSnap).catch(e => {
    if (e instanceof ApiError && e.status === 401) setSnap(null);
    else { setTries(t => t + 1); setTimeout(load, 3000); } // el servidor está arrancando o dormido
  });
  useEffect(() => { load(); }, []);

  if (snap === "loading") return (
    <section id="auth">
      <div><div className="tag">Malos Aires · de noche</div><h1>Malos <span className="o">Aires</span></h1></div>
      <p className="tag">{tries < 3 ? "Cargando Malos Aires…" : "El servidor del juego no responde. Si estuvo un rato sin jugadores puede tardar un minuto en despertar; si no, todavía no está publicado. Seguimos intentando…"}</p>
    </section>
  );
  if (!snap) return <Auth onIn={load} />;
  return <Game initial={snap} onOut={() => api.logout().finally(() => setSnap(null))} />;
}
