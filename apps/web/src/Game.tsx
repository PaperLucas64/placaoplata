import { useCallback, useEffect, useMemo, useState } from "react";
import { regen, TAB_NAMES, type Action, type FightView, type PlayerState, type TabKey } from "@pop/shared";
import { api, connectLive, type Snapshot } from "./api";
import { Boss, Choice, Faction } from "./cards";
import { BusyBar, Chronicle, Fight, Sheet } from "./parts";
import { Pane } from "./panes";
import { sceneFor } from "./art";

export type Act = (a: Action) => Promise<void>;
export interface Ui { s: PlayerState; now: number; act: Act; busy: boolean; mission: { ok: boolean; text: string } | null }

const tabName = (s: PlayerState, k: TabKey) =>
  k === "laburos" && s.side ? (s.side === "placa" ? "Patrullaje" : "Golpes") : TAB_NAMES[k];

export function Game({ initial, onOut }: { initial: Snapshot; onOut: () => void }) {
  const [server, setServer] = useState(initial.state);
  const [offset, setOffset] = useState(initial.now - Date.now()); // diferencia con el reloj del servidor
  const [clock, setClock] = useState(Date.now());
  const [tab, setTab] = useState<TabKey>(initial.state.tabs[initial.state.tabs.length - 1]);
  const [fight, setFight] = useState<FightView | null>(null);
  const [mission, setMission] = useState<Ui["mission"]>(null);
  const [toast, setToast] = useState<{ text: string; good?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);

  /* el reloj corre en la pantalla; la energía y la vida se recalculan con las mismas reglas del servidor */
  useEffect(() => { const t = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(t); }, []);
  const now = clock + offset;
  const s = useMemo(() => { const c = structuredClone(server); regen(c, now); return c; }, [server, now]);

  const apply = (snap: Snapshot) => { setServer(snap.state); setOffset(snap.now - Date.now()); setClock(Date.now()); };
  const refresh = useCallback(() => api.me().then(apply).catch(() => {}), []);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t); } }, [toast]);
  useEffect(() => connectLive(m => {
    if (m.type === "attacked") {
      setToast(m.won ? { text: `${m.by} te atacó y lo rechazaste.`, good: true } : { text: `${m.by} te atacó y te ganó. Mirá la crónica.` });
      refresh();
    }
  }, setLive), [refresh]);
  /* cuando termina el entrenamiento o la guardia, traer el estado del servidor */
  useEffect(() => {
    if (!server.busy) return;
    const t = setTimeout(refresh, Math.max(0, server.busy.until - (Date.now() + offset)) + 800);
    return () => clearTimeout(t);
  }, [server.busy, offset, refresh]);
  /* cada tanto, traer novedades (emboscadas de personajes del juego) */
  useEffect(() => { const t = setInterval(refresh, 60_000); return () => clearInterval(t); }, [refresh]);

  const act: Act = async a => {
    setBusy(true);
    try {
      const r = await api.act(a);
      apply(r);
      if (r.result.error) setToast({ text: r.result.error });
      if (a.type !== "seen") { setFight(r.result.fight ?? null); if (r.result.mission || a.type === "mstart") setMission(r.result.mission ?? null); }
      if (a.type === "side") setTab("misiones");
      if (a.type === "claimTut" && r.state.tabs.length > s.tabs.length) setTab(r.state.tabs[r.state.tabs.length - 1]);
    } catch (e: any) { setToast({ text: e.message }); }
    finally { setBusy(false); }
  };

  const open = (k: TabKey) => { setTab(k); setFight(null); if (!s.seenTab[k]) act({ type: "seen", tab: k }); };
  useEffect(() => { if (!s.seenTab[tab]) act({ type: "seen", tab }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ui: Ui = { s, now, act, busy, mission };
  const showFight = fight && (tab === "ring" || tab === "misiones" || tab === "calle");

  return (
    <>
      <header className="top">
        <div><div className="tag">Bahía Gris · de noche</div><h1>Placa <span className="o">o</span> Plata</h1></div>
        <div className="tag num">
          <span className={`live ${live ? "on" : ""}`}>{live ? "en línea" : "sin conexión"}</span>
          {s.tabs.includes("ring") && <> · Peleas ganadas {s.wins + s.c.duelW} · perdidas {s.losses + s.c.duelL}</>}
        </div>
      </header>
      <div className="game">
        <Sheet s={s} now={now} />
        <main className="board">
          <BusyBar s={s} now={now} disabled={busy} onCancel={() => act({ type: "cancel" })} />
          {s.tutDone && !s.side ? <Choice act={act} busy={busy} /> : s.side ? <Faction {...ui} /> : <Boss {...ui} />}
          <nav className="tabs" role="tablist">
            {s.tabs.map(k => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => open(k)}>
                {tabName(s, k)}{!s.seenTab[k] && tab !== k && <span className="dot" aria-label="nuevo" />}
              </button>
            ))}
          </nav>
          <section className="pane">
            <div className="scene" style={{ backgroundImage: `url(${sceneFor(tab, s.side)})` }} aria-hidden="true" />
            <Pane tab={tab} {...ui} />
          </section>
          {showFight && <Fight f={fight} avatar={s.avatar} side={s.side} />}
        </main>
      </div>
      <Chronicle s={s} onOut={onOut} />
      {toast && <div className={`toast ${toast.good ? "good" : ""}`} role="status">{toast.text}</div>}
    </>
  );
}
