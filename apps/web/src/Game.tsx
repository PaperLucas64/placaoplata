import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gangOf, nextMissionEvent, regen, TAB_NAMES, type Action, type FightView, type PlayerState, type TabKey } from "@pop/shared";
import { api, connectLive, type Snapshot } from "./api";
import { Boss, Situation } from "./cards";
import { Chronicle, Fight, Sheet } from "./parts";
import { CityMap, Pane, PlacePanel } from "./panes";
import { sceneFor } from "./art";

export type Act = (a: Action) => Promise<void>;
export interface Ui {
  s: PlayerState; now: number; act: Act; busy: boolean; mission: { ok: boolean; text: string } | null;
  ping: number;                                  // sube cuando llega un aviso en vivo de amigos o misiones de a dos
  refresh: () => Promise<void>; toast: (text: string, good?: boolean) => void;
  lugar: string | null; setLugar: (id: string | null) => void; // el lugar del mapa que tocaste
}

/* todos los fondos, para cambiar de uno a otro con un fundido */
const BACKDROPS = [...new Set((["laburos", "gimnasio", "feria", "ring", "guardia", "misiones", "calle", "casa", "negocios", "amigos", "ranking"] as TabKey[])
  .flatMap(k => [sceneFor(k, null), ...(["familia", "sindicato", "barra", "amarillos"] as const).map(g => sceneFor(k, g))]))].filter(Boolean);

const tabName = (s: PlayerState, k: TabKey) =>
  TAB_NAMES[k];

export function Game({ initial, onOut }: { initial: Snapshot; onOut: () => void }) {
  const [server, setServer] = useState(initial.state);
  const [offset, setOffset] = useState(initial.now - Date.now()); // diferencia con el reloj del servidor
  const [clock, setClock] = useState(Date.now());
  const [tab, setTab] = useState<TabKey>(initial.state.tabs[initial.state.tabs.length - 1]);
  const [fight, setFight] = useState<FightView | null>(null);
  const [liveFight, setLiveFight] = useState<FightView | null>(null);
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
    /* peleas que pasan en el mapa (saliste a buscar a alguien, te buscaron o se cruzaron) */
    if (m.type === "fight" && m.fight) {
      setLiveFight(m.fight);
      setToast({ text: m.text, good: m.good });
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
      if (a.type === "chase" && !r.result.error && r.state.busy?.kind === "caza")
        setToast({ text: `Saliste a buscar a ${r.state.busy.targetName}. Lo cruzás cerca de ${r.state.busy.place}.`, good: true });
      if (a.type === "claimTut" && r.state.tabs.length > s.tabs.length) setTab(r.state.tabs[r.state.tabs.length - 1]);
    } catch (e: any) { setToast({ text: e.message }); }
    finally { setBusy(false); }
  };

  const lastIn = useRef<Record<string, TabKey>>({});
  const open = (k: TabKey) => { const g = GROUPS.find(x => x.tabs.includes(k)); if (g) lastIn.current[g.id] = k; setTab(k); setFight(null); setLiveFight(null); if (!s.seenTab[k]) act({ type: "seen", tab: k }); };
  useEffect(() => { if (!s.seenTab[tab]) act({ type: "seen", tab }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [lugar, setLugar] = useState<string | null>(null);
  const ui: Ui = { s, now, act, busy, mission, ping, refresh, toast: (text, good) => setToast({ text, good }), lugar,
    setLugar: id => { setLugar(id); setFight(null); setLiveFight(null); if (id) setTimeout(() => document.querySelector(".lugar")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); } };
  /* pestañas nuevas que aparecen después del tutorial (también en partidas viejas) */
  const tabs: TabKey[] = withEquipo(s.tutDone ? withNewTabs(s.tabs) : s.tabs);
  /* cinco pestañas grandes; adentro, sus secciones (solo las que ya destrabaste) */
  const groups = GROUPS.map(g => ({ ...g, tabs: g.tabs.filter(k => tabs.includes(k)) })).filter(g => g.tabs.length);
  const current = groups.find(g => g.tabs.includes(tab)) ?? groups[0];
  const unseen = (k: TabKey) => !s.seenTab[k] && tab !== k;
  const showFight = fight && (tab === "ring" || tab === "misiones" || tab === "calle" || tab === "ranking");

  return (
    <>
      {/* el fondo de la página es el lugar donde estás (cambia con la pestaña) */}
      <div className="backdrop" aria-hidden="true">
        {BACKDROPS.map(src => <div key={src} className={src === sceneFor(tab, gangOf(s)) ? "on" : ""} style={{ backgroundImage: `url(${src})` }} />)}
      </div>
      <header className="top">
        <div><div className="tag">Maires · de noche</div><h1>Mai<span className="o">res</span></h1></div>
        <div className="tag num">
          <span className={`live ${live ? "on" : ""}`}>{live ? "en línea" : "sin conexión"}</span>
          {s.tabs.includes("ring") && <> · Peleas ganadas {s.wins + s.c.duelW} · perdidas {s.losses + s.c.duelL}</>}
        </div>
      </header>
      <div className="game">
        <Sheet s={s} now={now} disabled={busy} onCancel={() => s.coop && s.busy?.kind === "mision"
          ? api.coopCancel(s.coop.id).then(refresh).catch(e => setToast({ text: e.message }))
          : act({ type: "cancel" })} />
        <CityMap {...ui} />
        <main className="board">
          {lugar && <PlacePanel {...ui} />}
          <nav className="tabs" role="tablist">
            {groups.map(g => (
              <button key={g.id} role="tab" aria-selected={current?.id === g.id}
                onClick={() => open(g.tabs.includes(lastIn.current[g.id] as TabKey) ? lastIn.current[g.id] as TabKey : g.tabs[0])}>
                {g.name}{g.tabs.some(unseen) && <span className="dot" aria-label="nuevo" />}
              </button>
            ))}
          </nav>
          {current && current.tabs.length > 1 && <nav className="subtabs" role="tablist">
            {current.tabs.map(k => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => open(k)}>
                {SUB_NAMES[k] ?? tabName(s, k)}{unseen(k) && <span className="dot" aria-label="nuevo" />}
              </button>
            ))}
          </nav>}
          {s.tutDone ? <Situation {...ui} /> : <Boss {...ui} />}
          <section className="pane">
            <Pane tab={tab} {...ui} />
          </section>
          {showFight && <Fight f={fight} s={s} />}
          {liveFight && !showFight && <Fight f={liveFight} s={s} />}
        </main>
      </div>
      <Chronicle s={s} onOut={onOut} />
      {toast && <div className={`toast ${toast.good ? "good" : ""}`} role="status">{toast.text}</div>}
    </>
  );
}

/* Las pestañas grandes y qué secciones tiene cada una */
const GROUPS: { id: string; name: string; tabs: TabKey[] }[] = [
  { id: "calle", name: "Calle", tabs: ["laburos", "misiones", "calle", "negocios"] },
  { id: "gym", name: "Gimnasio", tabs: ["gimnasio", "ring"] },
  { id: "mercado", name: "Mercado", tabs: ["feria"] },
  { id: "casa", name: "Casa", tabs: ["casa", "equipo", "guardia"] },
  { id: "ciudad", name: "Ciudad", tabs: ["ranking", "amigos"] }
];
const SUB_NAMES: Partial<Record<TabKey, string>> = {
  laburos: "Trabajos", misiones: "Misiones", calle: "Pelear", negocios: "Negocios", gimnasio: "Entrenar", ring: "Ring",
  casa: "Tu casa", equipo: "Equipo", guardia: "Clínica", ranking: "Barrios y ranking", amigos: "Amigos"
};
/* el equipo aparece con el mercado */
const withEquipo = (tabs: TabKey[]): TabKey[] => (tabs.includes("feria") && !tabs.includes("equipo") ? [...tabs, "equipo"] : tabs);

/* Negocios va después de Casa y Amigos antes de Ciudad, aunque la partida sea de antes de que existieran */
function withNewTabs(tabs: TabKey[]): TabKey[] {
  const out = [...tabs];
  if (!out.includes("negocios")) out.splice(out.includes("casa") ? out.indexOf("casa") + 1 : out.length, 0, "negocios");
  if (!out.includes("amigos")) out.splice(out.includes("ranking") ? out.indexOf("ranking") : out.length, 0, "amigos");
  return out;
}
