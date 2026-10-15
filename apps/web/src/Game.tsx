import { useCallback, useEffect, useMemo, useState } from "react";
import { gangOf, nextMissionEvent, regen, TAB_NAMES, type Action, type FightView, type PlayerState, type TabKey } from "@pop/shared";
import { api, connectLive, type Snapshot } from "./api";
import { Boss, Situation } from "./cards";
import { Chronicle, Fight, Sheet } from "./parts";
import { Pane } from "./panes";
import { sceneFor } from "./art";

export type Act = (a: Action) => Promise<void>;
export interface Ui {
  s: PlayerState; now: number; act: Act; busy: boolean; mission: { ok: boolean; text: string } | null;
  ping: number;                                  // sube cuando llega un aviso en vivo de amigos o misiones de a dos
  refresh: () => Promise<void>; toast: (text: string, good?: boolean) => void;
}

const tabName = (s: PlayerState, k: TabKey) =>
  TAB_NAMES[k];

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
  const [ping, setPing] = useState(0);

  /* el reloj corre en la pantalla; la energía y la vida se recalculan con las mismas reglas del servidor */
  useEffect(() => { const t = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(t); }, []);
  const now = clock + offset;
  const s = useMemo(() => { const c = structuredClone(server); regen(c, now); return c; }, [server, now]);

  const apply = (snap: Snapshot) => { setServer(snap.state); setOffset(snap.now - Date.now()); setClock(Date.now()); };
  const refresh = useCallback(() => api.me().then(apply).catch(() => {}), []);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t); } }, [toast]);
  useEffect(() => connectLive(m => {
    if (m.type === "ring") { setPing(p => p + 1); refresh(); }
    if (m.type === "friend" || m.type === "coop") {
      const msgs: Record<string, string> = {
        request: "Te mandaron una solicitud de amistad.", accepted: m.type === "friend" ? "Aceptaron tu solicitud de amistad." : "Aceptaron tu misión de a dos.",
        invite: `${m.from ?? "Un amigo"} te invitó a una misión de a dos.`, start: "Arrancó tu misión de a dos.",
        done: "Terminó tu misión de a dos. Mirá la crónica.", declined: "No aceptaron tu misión de a dos.", cancelled: "Se canceló tu misión de a dos."
      };
      setToast({ text: msgs[m.what] ?? "Novedades de tus amigos.", good: m.what !== "cancelled" && m.what !== "declined" });
      setPing(p => p + 1);
      refresh();
    }
    if (m.type === "attacked") {
      setToast(m.won ? { text: `${m.by} te atacó y lo rechazaste.`, good: true } : { text: `${m.by} te atacó y te ganó. Mirá la crónica.` });
      refresh();
    }
  }, setLive), [refresh]);
  /* cuando termina el entrenamiento o la guardia, traer el estado del servidor */
  useEffect(() => {
    const ends = [server.busy?.until, server.home?.obra?.until, nextMissionEvent(server) ?? undefined].filter((x): x is number => !!x);
    if (!ends.length) return;
    const t = setTimeout(refresh, Math.max(0, Math.min(...ends) - (Date.now() + offset)) + 800);
    return () => clearTimeout(t);
  }, [server.busy, server.home?.obra, offset, refresh]);
  /* cada tanto, traer novedades (emboscadas de personajes del juego) */
  useEffect(() => { const t = setInterval(refresh, 60_000); return () => clearInterval(t); }, [refresh]);

  const act: Act = async a => {
    setBusy(true);
    try {
      const r = await api.act(a);
      apply(r);
      if (r.result.error) setToast({ text: r.result.error });
      if (a.type !== "seen") { setFight(r.result.fight ?? null); if (r.result.mission || a.type === "mstart") setMission(r.result.mission ?? null); }
      if (a.type === "claimTut" && r.state.tabs.length > s.tabs.length) setTab(r.state.tabs[r.state.tabs.length - 1]);
    } catch (e: any) { setToast({ text: e.message }); }
    finally { setBusy(false); }
  };

  const open = (k: TabKey) => { setTab(k); setFight(null); if (!s.seenTab[k]) act({ type: "seen", tab: k }); };
  useEffect(() => { if (!s.seenTab[tab]) act({ type: "seen", tab }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ui: Ui = { s, now, act, busy, mission, ping, refresh, toast: (text, good) => setToast({ text, good }) };
  /* la pestaña Amigos aparece después del tutorial (también en partidas viejas) */
  const tabs: TabKey[] = s.tutDone && !s.tabs.includes("amigos") ? [...s.tabs.slice(0, -1), "amigos", ...s.tabs.slice(-1)] : s.tabs;
  const showFight = fight && (tab === "ring" || tab === "misiones" || tab === "calle");

  return (
    <>
      <header className="top">
        <div><div className="tag">Malos Aires · de noche</div><h1>Malos <span className="o">Aires</span></h1></div>
        <div className="tag num">
          <span className={`live ${live ? "on" : ""}`}>{live ? "en línea" : "sin conexión"}</span>
          {s.tabs.includes("ring") && <> · Peleas ganadas {s.wins + s.c.duelW} · perdidas {s.losses + s.c.duelL}</>}
        </div>
      </header>
      <div className="game">
        <Sheet s={s} now={now} disabled={busy} onCancel={() => s.coop && s.busy?.kind === "mision"
          ? api.coopCancel(s.coop.id).then(refresh).catch(e => setToast({ text: e.message }))
          : act({ type: "cancel" })} />
        <main className="board">
          {s.tutDone ? <Situation {...ui} /> : <Boss {...ui} />}
          <nav className="tabs" role="tablist">
            {tabs.map(k => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => open(k)}>
                {tabName(s, k)}{!s.seenTab[k] && tab !== k && <span className="dot" aria-label="nuevo" />}
              </button>
            ))}
          </nav>
          <section className="pane">
            <div className="scene" style={{ backgroundImage: `url(${sceneFor(tab, gangOf(s))})` }} aria-hidden="true" />
            <Pane tab={tab} {...ui} />
          </section>
          {showFight && <Fight f={fight} s={s} />}
        </main>
      </div>
      <Chronicle s={s} onOut={onOut} />
      {toast && <div className={`toast ${toast.good ? "good" : ""}`} role="status">{toast.text}</div>}
    </>
  );
}
