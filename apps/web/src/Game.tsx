import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { money, xpNeed, energyMax, allStory, canStart, GOLPES, JOBS, maxHp, meetsReq, missionEnergy, gangOf, nextMissionEvent, regen, TAB_NAMES, type Action, type FightView, type PlayerState, type TabKey } from "@pop/shared";
import { api, connectLive, type Snapshot } from "./api";
import { Boss, Situation } from "./cards";
import { Chronicle, Fight, Hud, Sheet } from "./parts";
import { CityMap, Pane, PlacePanel, SearchPanel, Street } from "./panes";
import { GangRing } from "./art";
import { sceneFor } from "./art";

export type Act = (a: Action) => Promise<void>;
export interface Ui {
  s: PlayerState; now: number; act: Act; busy: boolean; mission: { ok: boolean; text: string } | null;
  ping: number;                                  // sube cuando llega un aviso en vivo de amigos o misiones de a dos
  refresh: () => Promise<void>; toast: (text: string, good?: boolean) => void;
  lugar: string | null; setLugar: (id: string | null) => void; // el lugar del mapa que tocaste
  openMe?: () => void;                                          // abrir tu panel (al tocarte en el mapa)
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
  const [panel, setPanel] = useState<Panel>(initial.state.tutDone ? null : "me"); // en el tutorial, Marga a la vista
  const [filter, setFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState(false);
  /* actividad rápida: una misión o un trabajo al azar, de los que podés hacer ahora */
  const quick = () => {
    if (s.busy && s.busy.kind !== "vuelta") { setToast({ text: "Estás ocupado: esperá a que termine lo que estás haciendo." }); return; }
    const okHp = s.hp >= maxHp(s) * 0.5;
    const missions = okHp ? [...allStory(), ...s.board].filter(m => canStart(s, m) && meetsReq(s, m) && s.energy >= missionEnergy(m) && !m.hours) : [];
    const golpes = s.tutDone && okHp ? GOLPES.filter(j => j.lvl <= s.lvl && s.energy >= j.cost) : [];
    const jobs = JOBS.filter(j => j.lvl <= s.lvl && s.energy >= j.cost);
    const pickOne = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    if (missions.length) { const m = pickOne(missions); setToast({ text: `Actividad rápida: «${m.title}».`, good: true }); act({ type: "mstart", id: m.id }); return; }
    if (golpes.length) { const j = pickOne(golpes); setToast({ text: `Actividad rápida: ${j.name}.`, good: true }); act({ type: "job", id: j.id }); return; }
    if (jobs.length) { const j = pickOne(jobs); act({ type: "job", id: j.id }); return; }
    setToast({ text: okHp ? "No te alcanza la energía para nada: esperá un rato." : "Estás muy golpeado: curate primero." });
  };
  const cancel = () => (s.coop && s.busy?.kind === "mision"
    ? api.coopCancel(s.coop.id).then(refresh).catch(e => setToast({ text: e.message }))
    : act({ type: "cancel" }));
  const ui: Ui = { s, now, act, busy, mission, ping, refresh, toast: (text, good) => setToast({ text, good }), lugar,
    setLugar: id => { setLugar(id); setPanel(null); setFight(null); setLiveFight(null); },
    openMe: () => { setLugar(null); setPanel("me"); } };
  /* pestañas nuevas que aparecen después del tutorial (también en partidas viejas) */
  const tabs: TabKey[] = withEquipo(s.tutDone ? withNewTabs(s.tabs) : s.tabs);
  /* cinco pestañas grandes; adentro, sus secciones (solo las que ya destrabaste) */
  const groups = GROUPS.map(g => ({ ...g, tabs: g.tabs.filter(k => tabs.includes(k)) })).filter(g => g.tabs.length);
  const current = groups.find(g => g.tabs.includes(tab)) ?? groups[0];
  const unseen = (k: TabKey) => !s.seenTab[k] && tab !== k;
  const showFight = fight && (tab === "ring" || tab === "misiones" || tab === "calle" || tab === "ranking");

  /* abrir un menú del costado: la sección que usaste la última vez en ese grupo, o la primera */
  const openGroup = (g: { id: string; tabs: TabKey[] }) => {
    setLugar(null);
    if (panel === g.id) { setPanel(null); return; }
    setPanel(g.id);
    open(g.tabs.includes(lastIn.current[g.id] as TabKey) ? lastIn.current[g.id] as TabKey : g.tabs[0]);
  };
  const openPanel = (k: Panel) => { setLugar(null); setPanel(panel === k ? null : k); };
  const shown = lugar ? "lugar" : panel;

  /* Como Google Maps: el mapa ocupa todo; a la izquierda los menús, arriba buscar y los filtros, arriba a la derecha vos */
  return (
    <div className={`gm ${shown ? "with-panel" : ""}`}>
      <CityMap {...ui} filter={filter} />

      <News />
      <nav className="rail" aria-label="Menú">
        <div className="rail-logo">Malan<span className="o">dro</span></div>
        <button className={shown === "me" ? "on" : ""} onClick={() => openPanel("me")}><span className="ri" aria-hidden="true">🧍</span><span>Vos</span></button>
        <button className={shown === "inv" ? "on" : ""} onClick={() => { setLugar(null); setPanel(panel === "inv" ? null : "inv"); open("equipo"); }}>
          <span className="ri" aria-hidden="true">🎒</span><span>Inventario</span></button>
        <button className={shown === "amigos" ? "on" : ""} onClick={() => { setLugar(null); setPanel(panel === "amigos" ? null : "amigos"); open("amigos"); }}>
          <span className="ri" aria-hidden="true">👥</span><span>Amigos</span></button>
        <button className={shown === "cronica" ? "on" : ""} onClick={() => openPanel("cronica")}>
          <span className="ri" aria-hidden="true">📜</span><span>Crónica</span></button>
        <button className={shown === "clan" ? "on" : ""} onClick={() => openPanel("clan")}>
          <span className="ri" aria-hidden="true">🛡️</span><span>Crear clan</span></button>
      </nav>

      <div className="topbar">
        <form className="search" onSubmit={e => { e.preventDefault(); setLugar(null); setPanel("buscar"); }}>
          <input value={query} placeholder="Buscar amigo o lugar" aria-label="Buscar amigo o lugar"
            onChange={e => { setQuery(e.target.value); setLugar(null); setPanel(e.target.value ? "buscar" : panel === "buscar" ? null : panel); }}
            onFocus={() => { if (query) { setLugar(null); setPanel("buscar"); } }} />
          <button type="submit" className="search-go" aria-label="Buscar">🔍</button>
        </form>
        <div className="vitals" aria-label="Tu estado">
          <span title="Vida"><i className="v-hp" style={{ width: `${Math.min(100, s.hp / maxHp(s) * 100)}%` }} />❤ {Math.round(s.hp)}/{maxHp(s)}</span>
          <span title="Energía"><i className="v-en" style={{ width: `${Math.min(100, s.energy / energyMax(s) * 100)}%` }} />⚡ {s.energy}/{energyMax(s)}</span>
          <span title="Experiencia"><i className="v-xp" style={{ width: `${Math.min(100, s.xp / xpNeed(s) * 100)}%` }} />★ nv {s.lvl}</span>
          <span className="v-gold">{money(s.gold)}</span>
        </div>
        <div className="chips">
          <button className="chip do" disabled={busy} onClick={quick}>🎯 Cosas que hacer</button>
          {CHIPS.map(c => <button key={c.id} className={`chip ${filter === c.id ? "on" : ""}`} onClick={() => setFilter(filter === c.id ? null : c.id)}>{c.icon} {c.name}</button>)}
        </div>
      </div>

      {s.tutDone && <button className={`pvp ${shown === "pvp" ? "on" : ""}`} onClick={() => openPanel("pvp")} aria-label="Pelear" title="Pelear">
        <span aria-hidden="true">⚔️</span><span>Pelear</span></button>}
      <button className={`me ${shown === "me" ? "on" : ""}`} onClick={() => openPanel("me")} aria-label="Tu personaje">
        <GangRing s={s} size={42} />
        <span className="me-bars">
          <span className="me-bar hp" style={{ width: `${Math.min(100, s.hp / maxHp(s) * 100)}%` }} />
          <span className="me-bar en" style={{ width: `${Math.min(100, s.energy / energyMax(s) * 100)}%` }} />
        </span>
      </button>

      {shown && <aside className="panel" aria-label="Panel">
        <div className="panel-head">
          <b>{shown === "me" ? s.name : shown === "lugar" ? "" : shown === "cronica" ? "Crónica" : shown === "buscar" ? "Buscar"
            : shown === "inv" ? "Inventario" : shown === "amigos" ? "Amigos" : shown === "clan" ? "Clan" : shown === "pvp" ? "Pelear" : groups.find(g => g.id === shown)?.name}</b>
          <button className="link" onClick={() => { setLugar(null); setPanel(null); }}>Cerrar</button>
        </div>
        {fight && <Fight f={fight} s={s} />}
        {liveFight && <Fight f={liveFight} s={s} />}
        {shown === "lugar" && <PlacePanel {...ui} />}
        {shown === "me" && <>
          {s.tutDone ? <Situation {...ui} /> : <Boss {...ui} />}
          <Sheet s={s} now={now} disabled={busy} onCancel={cancel} />
          <p className="tag num"><span className={`live ${live ? "on" : ""}`}>{live ? "en línea" : "sin conexión"}</span>
            {s.tabs.includes("ring") && <> · peleas ganadas {s.wins + s.c.duelW} · perdidas {s.losses + s.c.duelL}</>}</p>
        </>}
        {shown === "cronica" && <Chronicle s={s} onOut={onOut} />}
        {shown === "inv" && <section className="pane"><Pane tab="equipo" {...ui} /></section>}
        {shown === "amigos" && <section className="pane"><Pane tab="amigos" {...ui} /></section>}
        {shown === "pvp" && <section className="pane"><Street {...ui} /></section>}
        {shown === "clan" && <div className="soon"><h2>Clanes</h2><p>Próximamente: armá tu propio clan con amigos, con chat, territorio y misiones de clan.</p></div>}
        {shown === "buscar" && <SearchPanel {...ui} query={query} />}
        {groups.some(g => g.id === shown) && (() => {
          const g = groups.find(x => x.id === shown)!;
          return <>
            {g.tabs.length > 1 && <nav className="subtabs" role="tablist">
              {g.tabs.map(k => <button key={k} role="tab" aria-selected={tab === k} onClick={() => open(k)}>
                {SUB_NAMES[k] ?? tabName(s, k)}{unseen(k) && <span className="dot" aria-label="nuevo" />}</button>)}
            </nav>}
            <section className="pane"><Pane tab={g.tabs.includes(tab) ? tab : g.tabs[0]} {...ui} /></section>
          </>;
        })()}
      </aside>}

      {toast && <div className={`toast ${toast.good ? "good" : ""}`} role="status">{toast.text}</div>}
    </div>
  );
}

/* íconos de los menús del costado y filtros del mapa (como «Restaurantes», «Hoteles» en Google Maps) */
const GROUP_ICON: Record<string, string> = { calle: "🚩", gym: "🥊", mercado: "🛒", casa: "🏠", ciudad: "🏙️" };
export const CHIPS: { id: string; name: string; icon: string }[] = [
  { id: "misiones", name: "Misiones", icon: "🚩" }, { id: "robar", name: "Para robar", icon: "💰" }, { id: "trabajos", name: "Trabajos", icon: "🧰" },
  { id: "salud", name: "Salud", icon: "🏥" }, { id: "casas", name: "Casas", icon: "🏘️" }, { id: "subte", name: "Subte", icon: "🚇" },
  { id: "kioscos", name: "Kioscos y mercado", icon: "🏪" }, { id: "negocios", name: "Negocios", icon: "💼" }, { id: "servicios", name: "Gimnasio y ciudad", icon: "🏋️" }
];
type Panel = string | null;

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

/* Noticias locales: lo último que pasó en la ciudad, pasando abajo del mapa (como el diario del SimCity) */
const AMBIENT = [
  "Corte de luz en media Floreros: los vecinos sacaron las sillas a la vereda.",
  "La Municipalidad de Maires promete arreglar los baches «antes del Mundial».",
  "Paro sorpresa de colectivos: el Sindicato dice que no sabe nada.",
  "Se vendió un PH en Villa Crespa a precio de mansión de Reloquita.",
  "Vieron a La Señora cenando en Puerto Mareo. Nadie se animó a pedirle una foto.",
  "Rita «Taxi» Quiroga baja la bajada de bandera. Los remiseros, furiosos.",
  "El Tano Lucero prometió un trapo nuevo para el clásico.",
  "Un perro ocupó la línea Mar del Plata del subte y no se quiere bajar.",
  "Ola de robos de estéreos en Palermo Soja: los dueños ya no compran estéreos.",
  "El kiosquero de Mosecraft cumple 40 años detrás del mostrador."
];
function News() {
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => api.news().then(n => { if (alive) setItems(n.map(x => x.msg)); }).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  /* si pasó poco, se completa con noticias del barrio */
  const list = items.length >= 6 ? items.slice(0, 15) : [...items, ...AMBIENT.slice(0, 8 - items.length)];
  return <div className="news" aria-label="Noticias locales">
    <b className="news-tag">Noticias locales</b>
    <div className="news-roll"><div className="news-track" style={{ animationDuration: `${list.length * 9}s` }}>
      {[...list, ...list].map((m, i) => <span key={i}>{m}</span>)}
    </div></div>
  </div>;
}
