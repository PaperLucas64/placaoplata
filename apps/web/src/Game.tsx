import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rankOf, money, xpNeed, energyMax, allStory, canStart, GOLPES, JOBS, maxHp, meetsReq, missionEnergy, gangOf, nextMissionEvent, regen, TAB_NAMES, type Action, type FightView, type PlayerState, type TabKey } from "@pop/shared";
import { api, connectLive, type ChatMsg, type Snapshot } from "./api";
import { Chat } from "./chat";
import { ProfilePanel } from "./profile";
import { Away, AWAY_MIN_MS, Celebration, lastSeen, markSeen, type Moment } from "./celebrate";
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
  openProfile?: (id: number) => void;                           // ver el perfil de otro jugador
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
  /* el chat: los mensajes llegan en vivo aunque el panel esté cerrado (así se cuentan los que no leíste) */
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [unread, setUnread] = useState(0);
  const chatOpen = useRef(false);
  const addChat = useCallback((m: ChatMsg) => setChat(c => (c.some(x => x.id === m.id) ? c : [...c, m].slice(-200))), []);
  useEffect(() => { api.chat().then(setChat).catch(() => {}); }, []);

  /* subir de nivel, de rango o entrar a una pandilla: su tarjeta (se encolan si pasan varias juntas) */
  const [moments, setMoments] = useState<Moment[]>([]);
  const prevUp = useRef({ lvl: initial.state.lvl, rank: rankOf(initial.state), gang: gangOf(initial.state) });
  useEffect(() => {
    const p = prevUp.current, lvl = server.lvl, rank = rankOf(server), gang = gangOf(server);
    const add: Moment[] = [];
    if (gang && gang !== p.gang) add.push({ kind: "gang", gang });
    if (rank > p.rank) add.push({ kind: "rank", rank, gang });
    if (lvl > p.lvl) add.push({ kind: "lvl", lvl });
    prevUp.current = { lvl, rank, gang };
    if (add.length) setMoments(m => [...m, ...add]);
  }, [server]);

  /* «Mientras no estabas»: si hace un rato que no entrabas, lo que pasó (la marca vive en este navegador) */
  const [away, setAway] = useState<number | null>(() => {
    const since = lastSeen(initial.state.name);
    return initial.state.tutDone && since && initial.now - since > AWAY_MIN_MS ? since : null;
  });
  useEffect(() => {
    const mark = () => markSeen(initial.state.name, Date.now());
    const t = setInterval(mark, 60_000);
    const hide = () => { if (document.visibilityState === "hidden") mark(); };
    window.addEventListener("beforeunload", mark); document.addEventListener("visibilitychange", hide);
    return () => { clearInterval(t); window.removeEventListener("beforeunload", mark); document.removeEventListener("visibilitychange", hide); mark(); };
  }, [initial.state.name]);

  /* el título de la pestaña con lo pendiente: «(2) Malandro» */
  const [alerts, setAlerts] = useState(0);
  const alertHidden = useCallback(() => { if (document.hidden) setAlerts(a => a + 1); }, []);
  useEffect(() => {
    const seen = () => { if (!document.hidden) setAlerts(0); };
    document.addEventListener("visibilitychange", seen);
    return () => document.removeEventListener("visibilitychange", seen);
  }, []);

  /* el reloj corre en la pantalla; la energía y la vida se recalculan con las mismas reglas del servidor */
  useEffect(() => { const t = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(t); }, []);
  const now = clock + offset;
  const s = useMemo(() => { const c = structuredClone(server); regen(c, now); return c; }, [server, now]);

  const apply = (snap: Snapshot) => { setServer(snap.state); setOffset(snap.now - Date.now()); setClock(Date.now()); };
  const refresh = useCallback(() => api.me().then(apply).catch(() => {}), []);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t); } }, [toast]);
  useEffect(() => connectLive(m => {
    if (m.type === "chat" && m.m) { addChat(m.m); if (!chatOpen.current) setUnread(u => u + 1); return; }
    if (m.type === "attacked" || m.type === "fight" || m.type === "coop" || m.type === "friend") alertHidden();
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
  }, up => { setLive(up); if (up) api.chat().then(c => setChat(c)).catch(() => {}); }), [refresh, addChat, alertHidden]); // al reconectar, lo que se perdió
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
  const [profileId, setProfileId] = useState<number | null>(null);
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
    openMe: () => { setLugar(null); setPanel("me"); },
    openProfile: id => { setLugar(null); setProfileId(id); setPanel("perfil"); } };
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
  chatOpen.current = shown === "chat";
  useEffect(() => { if (shown === "chat") setUnread(0); }, [shown, chat.length]);
  useEffect(() => { const n = alerts + unread; document.title = n ? `(${n > 9 ? "9+" : n}) Malandro` : "Malandro"; }, [alerts, unread]);

  /* Como Google Maps: el mapa ocupa todo; a la izquierda los menús, arriba buscar y los filtros, arriba a la derecha vos */
  return (
    <div className={`gm ${shown ? "with-panel" : ""}`}>
      <CityMap {...ui} filter={filter} />

      <News chat={chat} now={now} />
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
          <span className="ri" aria-hidden="true">🛡️</span><span>Clan</span></button>
        <button className={shown === "chat" ? "on" : ""} onClick={() => openPanel("chat")}>
          <span className="ri" aria-hidden="true">💬</span><span>Chat</span>
          {unread > 0 && shown !== "chat" && <span className="rail-badge num" aria-label={`${unread} mensajes sin leer`}>{unread > 9 ? "9+" : unread}</span>}</button>
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
            : shown === "inv" ? "Inventario" : shown === "amigos" ? "Amigos" : shown === "clan" ? "Clan" : shown === "chat" ? "Chat" : shown === "perfil" ? "Perfil" : shown === "pvp" ? "Pelear" : groups.find(g => g.id === shown)?.name}</b>
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
        {shown === "chat" && <Chat msgs={chat} myName={s.name} onSent={addChat} toast={text => setToast({ text })} onName={id => ui.openProfile?.(id)} />}
        {shown === "perfil" && profileId !== null && <ProfilePanel id={profileId} toast={(text, good) => { setToast({ text, good }); setPing(p => p + 1); }} />}
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
      {away !== null ? <Away s={s} since={away} now={now} onClose={() => setAway(null)} />
        : moments[0] && <Celebration m={moments[0]} s={s} onClose={() => setMoments(m => m.slice(1))} />}
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
  "Corte de luz en media Flores: los vecinos sacaron las sillas a la vereda.",
  "La Municipalidad de Buenos Aires promete arreglar los baches «antes del Mundial».",
  "Paro sorpresa de colectivos: el Sindicato dice que no sabe nada.",
  "Se vendió un PH en Villa Crespo a precio de mansión de Recoleta.",
  "Vieron a La Señora cenando en Puerto Madero. Nadie se animó a pedirle una foto.",
  "Rita «Taxi» Quiroga baja la bajada de bandera. Los remiseros, furiosos.",
  "El Tano Lucero prometió un trapo nuevo para el clásico.",
  "Un perro ocupó la línea Mar del Plata del subte y no se quiere bajar.",
  "Ola de robos de estéreos en Palermo: los dueños ya no compran estéreos.",
  "El kiosquero de Monserrat cumple 40 años detrás del mostrador."
];
/* lo último del chat (de la última media hora) también pasa por las noticias */
const CHAT_IN_NEWS = 5, CHAT_NEWS_MS = 30 * 60_000;
function News({ chat, now }: { chat: ChatMsg[]; now: number }) {
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => api.news().then(n => { if (alive) setItems(n.map(x => x.msg)); }).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  /* si pasó poco, se completa con noticias del barrio */
  const said = chat.filter(m => now - m.t < CHAT_NEWS_MS).slice(-CHAT_IN_NEWS).reverse().map(m => `💬 ${m.name}: «${m.msg}»`);
  const city = items.length >= 6 ? items.slice(0, 15) : [...items, ...AMBIENT.slice(0, 8 - items.length)];
  /* los mensajes del chat, intercalados con las noticias para que no tapen todo */
  const list = said.length ? city.flatMap((n, i) => (said[i] ? [said[i], n] : [n])) : city;
  return <div className="news" aria-label="Noticias locales">
    <b className="news-tag">Noticias locales</b>
    <div className="news-roll"><div className="news-track" style={{ animationDuration: `${list.length * 9}s` }}>
      {[...list, ...list].map((m, i) => <span key={i}>{m}</span>)}
    </div></div>
  </div>;
}
