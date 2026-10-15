import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  affShare, canStart, closetSlots, HOME_BARRIO, TURF_BONUS, type Gang, COOP_ENERGY, COOP_MINS, forSale, SUPPLEMENT_MAX, supplementCost, supplementsTaken, DUEL_COST, ENCARGO_AFF, ENCARGO_COST, ENCARGOS, GANG_KEYS, GANGS, gangOf, GOLPES, guardiaTime, HOME, JOBS,
  trainTime, healCost, BOARD_REROLL_COST, findMission, meetsReq, missionEnergy, missionMins, missionNeed, missionReq, STREET_DIFF, itemLocked, maxHp, MIN_HP_TO_FIGHT, MISSIONS, money, nextLevel, RANK_NAMES, rankOf, RING, safeCap,
  SCOUT_COST, SHOP, STAT_HELP, STAT_NAMES, trainCost, VALIJA, BED_ENERGY, type Job, type Mission, type StatKey, type TabKey,
  ARCS, arcChapterKey, arcMissionId, arcOpen, clientOf, hasMod, hasVehicle, missionPlace, missionStepAt, MODS, modCost, needsTrip,
  POLICE_LVL, POV_COLOR, POV_NAME, POVS, PROP_CAP_HOURS, propIncome, PROPS, TRAVEL, TRAVEL_RISK, travelModes, tripCost, tripKm, tripMins,
  tripPhase, VEHICLES, BARRIOS, TIER_NAME, tierOf, housesIn, allStory, LUGARES, KIND_COLOR, KIND_NAME, lugarOpen, lugarOf, careLugar, HOSPITALS, CLINICS, GEO_PLACES,
  EVENT_MISSIONS, activeEvents, EVENTS, propOf, type Lugar, eff, gearBonus, itemPower, GEO_HOME, SLOTS, SLOT_NAMES, ATTACK_SLOTS, attackVal, defenseVal, bagSize, SELL_RATE, type Slot, returnTrip, kmOf, kmBetween, placePt, homePt, carePlan, onTheWayHome, type FromPoint, homePlace, houseOf, type ModKey, type TravelMode, type Vehicle, AMBUSH_LVL_GAP, ZONE_NAMES, CHASE_NAMES, type ShopKind, spotIn, missionPt
} from "@pop/shared";
import type { Pin } from "./gps/GpsMap";
import SUBTE from "@pop/shared/subte.json";
const PIN_URLS = import.meta.glob("./assets/lugares/*.svg", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const pinIconUrl = (k: string) => PIN_URLS[`./assets/lugares/${k}.svg`] ?? PIN_URLS["./assets/lugares/mision.svg"];
import { api, type BarrioView, type FriendsView, type RankRow, type RingView, type Traveler } from "./api";
import type { Ui } from "./Game";
import { Boss } from "./cards";
import { playerSprite, travelerSprite, avatarImg, bossImg, GangBadge, hasPortrait, img, Portrait, portraitOf, silhouette } from "./art";
import { ItemIcon } from "./icons";

const GpsMap = lazy(() => import("./gps/GpsMap"));
const mapFallback = <div className="gps" style={{ height: 260 }} />;

/* los otros jugadores que están en una misión (se actualiza cada medio minuto) */
function useTravelers() {
  const [view, setView] = useState<{ people: Traveler[]; online: number }>({ people: [], online: 0 });
  useEffect(() => {
    let on = true;
    const load = () => api.travelers().then(r => on && setView({ people: r.people, online: r.online ?? 0 })).catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => { on = false; clearInterval(t); };
  }, []);
  return view;
}
/* El mapa de Maires, arriba de todo: los barrios con el color de su dueño, tu personaje (si está en la calle),
   los demás que andan por ahí y, al tocarlos, salir a buscarlos. */
export function CityMap(ui: Ui & { filter?: string | null }) {
  const { s, now, act, filter } = ui;
  const { people, online } = useTravelers();
  const pins = useMemo(() => mapPins(s, now, filter), [s.tutDone, s.tabs.length, s.lvl, s.home.house, s.board, s.props, filter, Math.floor(now / 60_000)]); // eslint-disable-line react-hooks/exhaustive-deps
  const [owned, setOwned] = useState<BarrioView[] | null>(null);
  useEffect(() => {
    const load = () => api.territory().then(r => setOwned(r.map)).catch(() => {});
    load();
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
  }, []);
  const key = owned?.map(b => `${b.barrio}:${b.owner}`).join("|") ?? "";
  const owners = useMemo(() => owned ? Object.fromEntries(owned.map(b => [b.barrio, b.owner ? GANGS[b.owner].color : null])) : undefined, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = s.busy;
  /* tu viaje de ahora: a una misión, a curarte o volviendo a casa */
  const ret = b?.kind === "vuelta" ? returnTrip(b) : null;
  const trip = b?.kind === "mision" || b?.kind === "guardia" || b?.kind === "salida" ? b.trip ?? null : ret ? ret.trip : null;
  const ph = trip && b && b.kind !== "gym" && b.kind !== "caza" ? tripPhase({ since: b.since, until: b.until, trip: { ...trip, ev: 0 } }, now) : null;
  const others: Traveler[] = b?.kind === "caza"
    ? [...people, { id: -1, name: "Vos", lvl: s.lvl, gang: gangOf(s), avatar: s.avatar ?? 1, since: b.since, until: b.until,
        chase: { meet: b.meet, from: b.from, at: b.at, targetName: b.targetName, path: b.path } }]
    : people;
  const km = trip ? (trip.path ? kmOf(trip.path) : tripKm(trip.from ?? GEO_HOME, trip.place, trip.mode)) : 0;
  const status = <Legend s={s} now={now} km={km} />;
  const crowd = <span className="crowd"><span className="live on" /> {online} en línea · {people.length} en la calle</span>;
  return <section className="city" aria-label="Mapa de Maires">
    <Suspense fallback={<div className="gps city-map" />}>
      <GpsMap className="city-map" home={trip?.from ?? homePlace(s)} homeAt={!trip?.from || trip.from === homePlace(s) ? homePt(s) : undefined} owners={owners} place={trip?.place} mode={trip?.mode} path={trip?.path}
        at={ph ? { back: ph.phase === "vuelta", f: ph.frac } : null} sprite={b?.kind === "caza" ? undefined : playerSprite(s.avatar)}
        others={others} now={now} spriteOf={travelerSprite} pins={pins} onPin={id => ui.setLugar(id === ui.lugar ? null : id)} selected={ui.lugar}
        onBarrio={b => ui.setLugar(`barrio:${b}`)} onMe={() => ui.openMe?.()} focus={ui.lugar?.startsWith("barrio:") ? ui.lugar.slice(7) : null}
        attack={s.tutDone ? { s, why: t => ambushWhy(s, t), go: (t, mode) => act({ type: "chase", id: t.id, mode }) } : undefined} />
    </Suspense>
    <p className="gps-status num">{status}{crowd}</p>
  </section>;
}

/* ¿la podés hacer ahora? (si no, no se muestra: ni por rango, ni por la anterior, ni por atributos) */
export const doable = (s: Ui["s"], m: Mission) => canStart(s, m) && meetsReq(s, m);

/* ---------- los lugares del mapa ---------- */
/* un punto cerca del centro de un barrio (para lo que no tiene dirección propia), siempre el mismo para la misma clave */
const near = spotIn;
/* los colores de las líneas de subte (A provincias, B animales, C ríos, D mares, E fechas, H comidas) */
const LINE_COLOR: Record<string, string> = { A: "#4fc3e8", B: "#e0524f", C: "#3b6fd1", D: "#3fa564", E: "#8e5bb5", H: "#f2c94c" };
function allLugares(s: Ui["s"]): Lugar[] {
  const care = [...HOSPITALS.map(h => ({ ...h, care: "guardia" as const })), ...CLINICS.map(h => ({ ...h, care: "clinica" as const }))]
    .map(h => { const [lat, lng] = near(h.place, h.name); return careLugar(h.name, h.place, h.care, lat, lng); });
  const home = houseOf(s);
  const casa: Lugar = { id: "casa", name: `Tu casa: ${home.name}`, kind: "casa", icon: "casa", barrio: homePlace(s), lat: home.lat, lng: home.lng,
    help: "Tu guarida: de acá salen y acá vuelven tus viajes. Mejoras, equipo y mudanzas." };
  /* lo que tiene cada barrio: inmobiliaria, kiosco y estaciones de subte (se ven de muy cerca) */
  const local: Lugar[] = BARRIOS.flatMap(b => {
    const [la1, ln1] = near(b, `inmo-${b}`), [la2, ln2] = near(b, `kiosco-${b}`);
    return [
      { id: `inmo-${b}`, name: `Inmobiliaria de ${b}`, kind: "inmobiliaria" as const, icon: "inmobiliaria", barrio: b, lat: la1, lng: ln1, deep: true, tutDone: true,
        help: `Casas en venta en ${b}. ${TIER_NAME[tierOf(b)]}.` },
      { id: `kiosco-${b}`, name: `Kiosco de ${b}`, kind: "kiosco" as const, icon: "kiosco", barrio: b, lat: la2, lng: ln2, deep: true,
        help: "Botiquines, cigarrillos y chismes del barrio." }
    ];
  });
  const subte: Lugar[] = SUBTE.map(x => ({ id: `subte-${x.name}`, name: `Estación ${x.name}`, kind: "subte" as const, icon: "subte", barrio: x.barrio,
    color: LINE_COLOR[x.line], lat: x.lat, lng: x.lng, deep: true, help: `Línea ${x.line} del subte. Pronto vas a poder viajar en subte entre barrios.` }));
  const props: Lugar[] = PROPS.map(p => { const [lat, lng] = near(p.place, p.id);
    return { id: `negocio-${p.id}`, name: p.name, kind: "negocio" as const, icon: p.id === "kiosco24" ? "kiosco" : p.id, prop: p.id, barrio: p.place, lat, lng, help: p.help, tutDone: true }; });
  return [casa, ...LUGARES, ...care.map(c => ({ ...c, deep: true })), ...props, ...local, ...subte];
}
/* los filtros de arriba del mapa: qué clases de lugar muestra cada uno */
const FILTER_KINDS: Record<string, string[]> = {
  misiones: ["contacto", "policia", "bar", "evento", "mision"], robar: ["golpe"], trabajos: ["laburo"], salud: ["salud"],
  casas: ["inmobiliaria", "casa"], subte: ["subte"], kioscos: ["kiosco", "mercado"], negocios: ["negocio", "concesionaria"],
  servicios: ["gym", "estadio", "municipio"]
};
function mapPins(s: Ui["s"], now: number, filter?: string | null): Pin[] {
  const kinds = filter ? FILTER_KINDS[filter] : null;
  const pins: Pin[] = allLugares(s).filter(l => (l.id === "casa" || lugarOpen(s, l, now)) && (!kinds || kinds.includes(l.kind)))
    .filter(l => l.kind !== "negocio" || s.lvl >= (propOf(l.prop!)?.lvl ?? 99) - 2 || s.props?.[l.prop!] !== undefined)
    .map(l => ({ id: l.id, name: l.name, icon: l.icon, color: l.gang ? GANGS[l.gang].color : l.color ?? KIND_COLOR[l.kind], lat: l.lat, lng: l.lng,
      badge: l.kind === "contacto" && l.gang ? String(MISSIONS[l.gang].filter(m => doable(s, m)).length || "") || undefined : undefined,
      near: !kinds && ["golpe", "laburo", "salud", "negocio", "municipio", "concesionaria", "estadio"].includes(l.kind), deep: !kinds && !!l.deep }));
  /* las misiones del tablón: banderitas en su barrio, del color de quien las da */
  for (const m of kinds && !kinds.includes("mision") ? [] : s.board ?? []) {
    const c = GEO_PLACES[m.place ?? ""]; if (!c || !doable(s, m)) continue;
    const [lat, lng] = missionPt(m, missionPlace(m) ?? m.place!)!;
    pins.push({ id: `mision:${m.id}`, name: m.title, icon: m.client === "raro" ? "raro" : "mision", color: clientOf(m).color, lat, lng });
  }
  return pins;
}

/* Lo que podés hacer en el lugar que tocaste en el mapa */
export function PlacePanel(ui: Ui) {
  const { s, act, busy, now, lugar, setLugar } = ui;
  const pane = { ...ui, busy: busy || (!!s.busy && s.busy.kind !== "vuelta") };
  if (!lugar) return null;
  if (lugar.startsWith("barrio:")) return <BarrioPanel {...ui} b={lugar.slice(7)} />;
  if (lugar.startsWith("mision:")) {
    const m = s.board.find(x => x.id === lugar.slice(7));
    return <section className="lugar" style={{ ["--lugar" as string]: m ? clientOf(m).color : undefined }}>
      <div className="lugar-head"><div><span className="tag">Misión del tablón</span><h2>{m?.title ?? "Ya no está"}</h2></div>
        <button className="link lugar-close" onClick={() => setLugar(null)}>Cerrar</button></div>
      {m ? <div className="list"><MissionCard m={m} {...pane} /></div> : <p>Esa misión ya no está en el tablón.</p>}
    </section>;
  }
  const l = allLugares(s).find(x => x.id === lugar);
  if (!l) return null;
  const color = l.gang ? GANGS[l.gang].color : KIND_COLOR[l.kind];
  const job = l.job ? [...JOBS, ...GOLPES].find(j => j.id === l.job) : undefined;
  const golpe = job && GOLPES.includes(job);
  return <section className="lugar" style={{ ["--lugar" as string]: color }}>
    <div className="lugar-head">
      {l.gang ? <Portrait src={bossImg(l.gang)} gang={l.gang} size={56} /> : null}
      <div><span className="tag">{KIND_NAME[l.kind]} · {l.barrio}</span><h2>{l.name}</h2></div>
      <button className="link lugar-close" onClick={() => setLugar(null)}>Cerrar</button>
    </div>
    <p>{l.help}</p>
    {l.kind === "bar" && (s.tutDone ? <>
        <p>Marga seca un vaso. «Ya no necesitás que te cuide. Pero si querés trabajo, mirá el tablón de la calle: está lleno de banderitas en el mapa.»</p>
      </> : <><Boss {...ui} />{!s.c.valija && s.tabs.includes("misiones") && <div className="list"><MissionCard m={VALIJA} {...pane} /></div>}</>)}
    {l.kind === "casa" && <><House {...ui} /><Equipment {...ui} /></>}
    {l.kind === "gym" && <><Gym {...pane} /><Ring {...pane} /></>}
    {l.kind === "estadio" && <Tournament {...ui} />}
    {l.kind === "mercado" && <Shop {...ui} only={l.shop} />}
    {l.kind === "salud" && <Hospital {...ui} />}
    {(l.kind === "negocio" || l.kind === "concesionaria") && <Business {...ui} />}
    {l.kind === "municipio" && <Ranking {...ui} />}
    {l.kind === "inmobiliaria" && <HouseList {...ui} b={l.barrio} />}
    {l.kind === "kiosco" && <div className="list"><div className="item">
      <div className="with-art"><ItemIcon id="botiquin" /><div><h3>Botiquín</h3><div className="meta num">+50% de vida, cuando lo uses · {money(20)} · tenés {s.potions}</div></div></div>
      <div className="act"><button disabled={busy || s.gold < 20} onClick={() => act({ type: "buy", id: "botiquin" })}>Comprar</button></div>
    </div></div>}
    {l.kind === "contacto" && l.gang && <GangContact g={l.gang} {...pane} />}
    {l.kind === "policia" && <>
      <h3>Trabajos sucios</h3>
      <div className="list">{s.board.filter(m => m.client === "policia" && doable(s, m)).map(m => <MissionCard key={m.id} m={m} {...pane} />)}</div>
      <h3>Lo que Funes sabe de las historias de la ciudad</h3>
      <div className="list">{ARCS.flatMap(a => a.chapters.map((_, ch) => findMission(s, arcMissionId(a.id, ch, "policia"))!))
        .filter(m => doable(s, m)).map(m => <MissionCard key={m.id} m={m} {...pane} chip={{ name: POV_NAME.policia, color: POV_COLOR.policia }} />)}</div>
    </>}
    {job && <div className="list"><div className="item">
      <div><h3>{job.name}<span className={`risk r${job.risk}`}>riesgo {riskTxt[job.risk]}</span></h3>
        <div className="meta num">{money(job.gold[0])}–{money(job.gold[1])} · {job.xp[0]}–{job.xp[1]} XP{job.resp ? ` · +${job.resp} respeto` : ""}{job.heat ? ` · +${job.heat} de búsqueda` : ""} · {job.cost} energía{s.lvl < job.lvl ? ` · desde nivel ${job.lvl}` : ""}</div>
        {golpe && <div className="meta">Salís hasta acá, lo hacés y volvés a casa.</div>}</div>
      <div className="act"><button className="primary" disabled={pane.busy || s.energy < job.cost || s.lvl < job.lvl}
        onClick={() => act(golpe ? { type: "job", id: job.id, at: l.id } : { type: "job", id: job.id })}>{golpe ? "Ir a robar" : "Trabajar"}</button></div>
    </div></div>}
    {l.kind === "evento" && <>
      <p className="tag">{EVENTS.find(e => e.id === l.event)?.name}: solo por unos días.</p>
      <div className="list">{EVENT_MISSIONS.filter(m => m.event === l.event && doable(s, m)).map(m => <MissionCard key={m.id} m={m} {...pane} />)}</div>
      {EVENT_MISSIONS.filter(m => m.event === l.event).every(m => s.done[m.id]) && <p className="tag">Ya terminaste las misiones de este evento.</p>}
    </>}
  </section>;
}

/* Buscar: barrios, lugares y gente (para agregar de amigo) */
export function SearchPanel(ui: Ui & { query: string }) {
  const { s, now, setLugar, toast, query } = ui;
  const [people, setPeople] = useState<RankRow[]>([]);
  useEffect(() => { api.ranking().then(r => setPeople(r.filter(x => !x.npc && !x.me))).catch(() => {}); }, []);
  const q = query.trim().toLowerCase();
  if (!q) return <p className="tag">Escribí el nombre de un amigo, un barrio o un lugar.</p>;
  const has = (x: string) => x.toLowerCase().includes(q);
  const barrios = BARRIOS.filter(has).slice(0, 6);
  const places = allLugares(s).filter(l => has(l.name) && (lugarOpen(s, l, now) || l.deep)).slice(0, 8);
  const who = people.filter(p => has(p.name)).slice(0, 8);
  const add = (name: string) => api.addFriend(name).then(r => toast(r.accepted ? `Ahora sos amigo de ${name}.` : `Le mandaste una solicitud a ${name}.`, true)).catch(e => toast(e.message));
  return <>
    {who.length > 0 && <><h3>Gente</h3><div className="places">{who.map(p => <div key={p.name} className="place-row">
      <span><b>{p.name}</b><span className="tag">nivel {p.lvl}</span></span>
      <button className="primary" style={{ marginLeft: "auto" }} onClick={() => add(p.name)}>Agregar</button></div>)}</div></>}
    {barrios.length > 0 && <><h3>Barrios</h3><div className="places">{barrios.map(b => <button key={b} className="place-row" onClick={() => setLugar(`barrio:${b}`)}>
      <span><b>{b}</b><span className="tag">{TIER_NAME[tierOf(b)]}</span></span></button>)}</div></>}
    {places.length > 0 && <><h3>Lugares</h3><div className="places">{places.map(l => <button key={l.id} className="place-row" onClick={() => setLugar(l.id)}>
      <span className="pin" style={{ ["--pin" as string]: l.gang ? GANGS[l.gang].color : KIND_COLOR[l.kind] }}><img alt="" src={pinIconUrl(l.icon)} /></span>
      <span><b>{l.name}</b><span className="tag">{KIND_NAME[l.kind]} · {l.barrio}</span></span></button>)}</div></>}
    {!who.length && !barrios.length && !places.length && <p className="tag">No encontré nada con «{query}».</p>}
  </>;
}

/* las casas que se venden en un barrio */
function HouseList({ s, act, busy, b }: Ui & { b: string }) {
  const mine = houseOf(s);
  return <div className="list">{housesIn(b).map(h => {
    const here = mine.id === h.id, locked = s.lvl < h.lvl;
    return <div className="item" key={h.id}>
      <div><h3>{h.name}{here && <span className="kind">vivís acá</span>}</h3>
        <div className="meta">{h.help}</div>
        <div className="meta num">mejoras hasta el nivel {h.cap} · {money(h.price)}</div>
        {!here && locked && <div className="lock">Pide nivel {h.lvl}</div>}</div>
      <div className="act">{!here && <button disabled={busy || locked || !!s.busy || !!s.home.obra || s.gold < h.price} onClick={() => act({ type: "move", id: h.id })}>Mudarme</button>}</div>
    </div>;
  })}</div>;
}

/* Al tocar un barrio: quién manda, qué hay para hacer, qué misiones pasan ahí y qué casas se venden */
function BarrioPanel(ui: Ui & { b: string }) {
  const { s, now, b, setLugar } = ui;
  const pane = { ...ui, busy: ui.busy || (!!s.busy && s.busy.kind !== "vuelta") };
  const [view, setView] = useState<BarrioView | null>(null);
  useEffect(() => { api.territory().then(r => setView(r.map.find(x => x.barrio === b) ?? null)).catch(() => {}); }, [b]);
  const owner = view?.owner ?? null, total = view ? GANG_KEYS.reduce((a, g) => a + view.points[g], 0) || 1 : 1;
  const places = allLugares(s).filter(l => l.barrio === b && l.id !== "casa" && (lugarOpen(s, l, now) || l.kind === "subte" || l.kind === "inmobiliaria" || l.kind === "kiosco"));
  const missions = [...s.board, ...allStory()].filter(m => missionPlace(m) === b && doable(s, m));
  return <section className="lugar" style={{ ["--lugar" as string]: owner ? GANGS[owner].color : "#8a8070" }}>
    <div className="lugar-head"><div><span className="tag">{TIER_NAME[tierOf(b)]}{homePlace(s) === b ? " · vivís acá" : ""}</span><h2>{b}</h2></div>
      <button className="link lugar-close" onClick={() => setLugar(null)}>Cerrar</button></div>
    <p>{owner ? <>Lo controla <b style={{ color: GANGS[owner].color }}>{GANGS[owner].name}</b>.</> : "En disputa: ninguna pandilla manda."}</p>
    {view && <div className="barrio"><div className="stack">{GANG_KEYS.map(g => <span key={g} title={`${GANGS[g].name}: ${view.points[g]}`} style={{ width: `${view.points[g] / total * 100}%`, background: GANGS[g].color }} />)}</div></div>}
    {missions.length > 0 && <><h3>Misiones acá</h3><div className="list">{missions.map(m => <MissionCard key={m.id} m={m} {...pane} />)}</div></>}
    <h3>Qué hay en {b}</h3>
    <div className="places">{places.map(l => <button key={l.id} className="place-row" onClick={() => setLugar(l.id)}>
      <span className="pin" style={{ ["--pin" as string]: l.gang ? GANGS[l.gang].color : KIND_COLOR[l.kind] }}><img alt="" src={pinIconUrl(l.icon)} /></span>
      <span><b>{l.name}</b><span className="tag">{KIND_NAME[l.kind]}</span></span></button>)}</div>
    <h3>Casas en venta</h3>
    <HouseList {...pane} b={b} />
  </section>;
}

/* el contacto de una pandilla: sus encargos, su historia, las historias de la ciudad desde su lado y sus pedidos del tablón */
function GangContact({ g, ...ui }: Ui & { g: Gang }) {
  const { s, act, busy } = ui;
  const info = GANGS[g], e = ENCARGOS[g], rk = rankOf(s);
  return <>
    <p className="tag">«{info.say}» · {info.perk} · vos: {Math.round(affShare(s, g) * 100)}% de afinidad</p>
    <h3>Encargo</h3>
    <div className="list"><div className="item">
      <div><h3>{e.name}</h3><div className="meta num">prueba de {STAT_NAMES[e.stat].toLowerCase()} · +{ENCARGO_AFF} afinidad · {ENCARGO_COST} energía · en {HOME_BARRIO[g]}</div></div>
      <div className="act"><button disabled={busy || s.energy < ENCARGO_COST || s.hp < maxHp(s) * MIN_HP_TO_FIGHT} onClick={() => act({ type: "encargo", gang: g })}>Hacerlo</button></div>
    </div></div>
    <h3>La historia de {info.name}</h3>
    {(() => { const list = MISSIONS[g].filter(m => doable(s, m));
      return list.length ? <div className="list">{list.map((m: Mission) => <MissionCard key={m.id} m={m} {...ui} />)}</div>
        : <p className="tag">{MISSIONS[g].every(m => s.done[m.id]) ? "Ya hiciste toda su historia." : `Por ahora no tiene nada para vos. Volvé con más rango (${RANK_NAMES[rk + 1] ?? "más"}) o mejores atributos.`}</p>; })()}
    {(() => {
      const arcs = ARCS.flatMap(a => a.chapters.map((_, ch) => findMission(s, arcMissionId(a.id, ch, g))!)).filter(m => doable(s, m));
      return arcs.length ? <><h3>Historias de la ciudad, desde {info.name}</h3>
        <div className="list">{arcs.map(m => <MissionCard key={m.id} m={m} {...ui} chip={{ name: POV_NAME[g], color: POV_COLOR[g] }} />)}</div></> : null;
    })()}
    {(() => {
      const board = s.board.filter(m => m.gang === g && doable(s, m));
      return board.length ? <><h3>Pedidos de {info.name} en el tablón</h3><div className="list">{board.map(m => <MissionCard key={m.id} m={m} {...ui} />)}</div></> : null;
    })()}
  </>;
}

/* por qué no podés asaltar a alguien (o null si podés); el servidor lo vuelve a chequear */
function ambushWhy(s: Ui["s"], t: Traveler): string | null {
  if (s.busy) return "Estás ocupado: para salir a buscar a alguien tenés que estar libre.";
  if (t.gang && t.gang === gangOf(s)) return "Es de tu pandilla.";
  if (t.lvl < s.lvl - AMBUSH_LVL_GAP) return "Es muy chico para vos.";
  if (s.energy < DUEL_COST) return "No te alcanza la energía.";
  if (s.hp < maxHp(s) * MIN_HP_TO_FIGHT) return "Estás muy golpeado.";
  return null;
}

const riskTxt = ["", "bajo", "medio", "alto"];

export function Pane({ tab, ...rest }: Ui & { tab: TabKey }) {
  /* mientras entrenás o estás internado, todo lo que lleva energía o pelea queda bloqueado */
  const ui = { ...rest, busy: rest.busy || (!!rest.s.busy && rest.s.busy.kind !== "vuelta") };
  switch (tab) {
    case "laburos": return <Jobs {...ui} />;
    case "gimnasio": return <Gym {...ui} />;
    case "feria": return <Shop {...rest} />;
    case "equipo": return <Equipment {...rest} />;
    case "ring": return <Ring {...ui} />;
    case "guardia": return <Hospital {...rest} />;
    case "misiones": return <Missions {...ui} />;
    case "calle": return <Street {...ui} />;
    case "casa": return <House {...rest} />;
    case "negocios": return <Business {...rest} />;
    case "amigos": return <Friends {...rest} />;
    case "ranking": return <Ranking {...ui} />;
  }
}

function Jobs({ s, act, busy }: Ui) {
  const row = (j: Job, label: string) => (
    <div className="item" key={j.id}>
      <div><h3>{j.name}<span className={`risk r${j.risk}`}>riesgo {riskTxt[j.risk]}</span></h3>
        <div className="meta num">{money(j.gold[0])}–{money(j.gold[1])} · {j.xp[0]}–{j.xp[1]} XP{j.resp ? ` · +${j.resp} respeto` : ""}{j.heat ? ` · +${j.heat} de búsqueda` : ""} · {j.cost} energía{s.lvl < j.lvl ? ` · desde nivel ${j.lvl}` : ""}</div></div>
      <div className="act"><button disabled={busy || s.energy < j.cost || s.lvl < j.lvl} onClick={() => act({ type: "job", id: j.id })}>{label}</button></div>
    </div>);
  return <>
    <h2>Trabajos</h2>
    <p>{s.tutDone ? "Encargos de las pandillas (cada uno suma afinidad con la que te lo da), golpes que pagan bien pero suben tu nivel de búsqueda, y laburos honestos." : "Trabajos de todo tipo. Más riesgo, más plata. La labia te ayuda a cobrar mejor."}</p>
    {s.tutDone && <>
      <h3>Encargos de las pandillas</h3>
      <div className="list">{GANG_KEYS.map(g => {
        const e = ENCARGOS[g], info = GANGS[g];
        return <div className="item" key={g} style={{ borderLeft: `3px solid ${info.color}` }}>
          <div className="with-art"><Portrait src={bossImg(g)} gang={g} size={48} />
            <div><h3>{e.name}</h3>
              <div className="meta num"><span style={{ color: info.color }}>{info.name}</span> · prueba de {STAT_NAMES[e.stat].toLowerCase()} · +{ENCARGO_AFF} afinidad · {ENCARGO_COST} energía · vos: {Math.round(affShare(s, g) * 100)}%</div></div></div>
          <div className="act"><button disabled={busy || s.energy < ENCARGO_COST || s.hp < maxHp(s) * MIN_HP_TO_FIGHT} onClick={() => act({ type: "encargo", gang: g })}>Hacerlo</button></div>
        </div>;
      })}</div>
      <h3>Golpes</h3>
      <div className="list">{GOLPES.filter(j => j.lvl <= s.lvl + 2).map(j => row(j, "Hacerlo"))}</div>
      <h3>Laburos</h3>
    </>}
    <div className="list">{JOBS.filter(j => j.lvl <= s.lvl + 2).map(j => row(j, "Trabajar"))}</div>
  </>;
}

function Gym({ s, act, busy }: Ui) {
  return <>
    <div className="with-art">
      <Portrait src={img("retratos/tito")} size={72} />
      <div><h2>Gimnasio de Don Tito</h2><p className="say">«Cada punto cuesta más que el anterior, pibe, y lleva más tiempo. Mientras entrenás, no hacés otra cosa.»</p></div>
    </div>
    <div className="list">{(Object.keys(STAT_NAMES) as StatKey[]).map(k => {
      const c = trainCost(s.stats[k]);
      return <div className="item" key={k}>
        <div><h3>{STAT_NAMES[k]} <span className="num">{s.stats[k]}</span>{gearBonus(s, k) > 0 && <span className="num bonus"> (+{gearBonus(s, k)} del equipo)</span>}</h3><div className="meta">{STAT_HELP[k]}</div></div>
        <div className="act"><button disabled={busy || s.gold < c} onClick={() => act({ type: "train", stat: k })}>Entrenar · <span className="num">{money(c)} · {Math.round(trainTime(s.stats[k]) / 60000)} min</span></button></div>
      </div>;
    })}</div>
  </>;
}

const SHOP_SLOTS: Record<ShopKind, string[]> = { armas: ["blanca", "fuego"], ropa: ["cabeza", "torso", "ropa"], salud: ["consumible"] };
function Shop({ s, act, busy, only }: Ui & { only?: ShopKind }) {
  const items = SHOP.filter(it => forSale(s, it) && it.lvl <= s.lvl + 3 && (!it.rank || s.tutDone) && (!only || (SHOP_SLOTS[only].includes(it.slot) && !it.rank)));
  return <>
    {!only && <h2>Mercado</h2>}
    <p>{only ? "" : s.tutDone
      ? "Armas blancas y de fuego, cascos, chalecos y ropa. Si el lugar está vacío (o lo nuevo es mejor) te lo ponés al toque; lo otro va a tu bolso, en Casa › Equipo. Cada nivel trae cosas nuevas; al fondo, el mercado negro, que se desbloquea subiendo de rango."
      : "Por ahora el puestero te vende una sola cosa: «Cuando Marga te dé el visto bueno, te muestro lo demás.»"}</p>
    <div className="list">{items.map(it => {
      const own = it.slot !== "consumible" && (s.gear[it.slot] === it.id || s.inv.includes(it.id));
      const sup = it.id === "suplemento", maxed = sup && supplementsTaken(s) >= SUPPLEMENT_MAX;
      const price = sup ? supplementCost(s) : it.price, locked = itemLocked(s, it);
      const cur = it.slot !== "consumible" ? SHOP.find(x => x.id === s.gear[it.slot as Slot]) : undefined;
      return <div className={`item ${locked ? "locked" : ""}`} key={it.id}>
        <div className="with-art"><ItemIcon id={it.id} /><div><h3>{it.name}{it.rank && <span className="badge" style={{ marginLeft: 6 }}>mercado negro</span>}</h3>
          <div className="meta num">{sup ? `Llevás ${supplementsTaken(s)} de ${SUPPLEMENT_MAX}` : it.slot === "consumible" ? "Se usa desde la clínica"
            : `${SLOT_NAMES[it.slot]} · ${bonusTxt(it)}${cur && cur.id !== it.id ? ` (tenés: ${bonusTxt(cur)})` : ""}`} · {money(price)}
            {s.lvl < it.lvl && ` · se desbloquea en nivel ${it.lvl}`}{it.rank && rankOf(s) < it.rank ? ` · se desbloquea en rango ${RANK_NAMES[it.rank]}` : ""}</div></div></div>
        <div className="act"><button disabled={busy || own || maxed || s.gold < price || locked} onClick={() => act({ type: "buy", id: it.id })}>{own ? "Lo tenés" : maxed ? "Al máximo" : "Comprar"}</button></div>
      </div>;
    })}</div>
  </>;
}

/* "Fuerza +3, Dureza +1" */
const bonusTxt = (it: { bonus?: Partial<Record<StatKey, number>> }) =>
  (Object.entries(it.bonus ?? {}) as [StatKey, number][]).map(([k, v]) => `${STAT_NAMES[k]} +${v}`).join(", ") || "—";

/* Equipo, estilo RPG: lo que tenés puesto en cada lugar y tu bolso */
function Equipment({ s, act, busy }: Ui) {
  return <>
    <h2>Equipo</h2>
    <p>Lo que tenés puesto te suma a tus atributos: las armas, a la fuerza; el casco, el chaleco y la ropa, a la dureza. En tu ficha lo ves entre paréntesis, por ejemplo «Fuerza 9 (+3)». Lo que no tenés puesto va en el bolso: entran {bagSize(s)} cosas (más con un armario mejor).</p>
    <div className="slots">{SLOTS.map(k => {
      const it = SHOP.find(x => x.id === s.gear[k]);
      return <div className={`slot ${it ? "" : "empty"}`} key={k}>
        <span className="tag">{SLOT_NAMES[k]}</span>
        {it ? <ItemIcon id={it.id} /> : <span className="icon" />}
        <b>{it ? it.name : "—"}</b>
        <span className="num meta bonus">{it ? bonusTxt(it) : "vacío"}</span>
        {it && <button className="link" disabled={busy || s.inv.length >= bagSize(s)} onClick={() => act({ type: "unequip", slot: k })}>Sacármelo</button>}
      </div>;
    })}</div>
    <h3>Bolso ({s.inv.length} de {bagSize(s)})</h3>
    {!s.inv.length ? <p>Vacío. Lo que compres y no te pongas queda acá.</p> :
      <div className="list">{s.inv.map((id, i) => {
        const it = SHOP.find(x => x.id === id)!;
        if (!it || it.slot === "consumible") return null;
        const cur = SHOP.find(x => x.id === s.gear[it.slot as Slot]);
        return <div className="item" key={`${id}-${i}`}>
          <div className="with-art"><ItemIcon id={id} /><div><h3>{it.name}</h3>
            <div className="meta num">{SLOT_NAMES[it.slot]} · {bonusTxt(it)}{cur ? ` (tenés puesto: ${bonusTxt(cur)})` : " · ese lugar está vacío"}</div></div></div>
          <div className="act">
            <button className="primary" disabled={busy} onClick={() => act({ type: "equip", id })}>Ponérmelo</button>
            <button disabled={busy} onClick={() => act({ type: "sell", id })}>Vender · {money(Math.round(it.price * SELL_RATE))}</button>
          </div>
        </div>;
      })}</div>}
    {s.potions > 0 && <p className="tag">Además tenés {s.potions} {s.potions === 1 ? "botiquín" : "botiquines"} (se usan desde la Clínica).</p>}
  </>;
}

function Ring(ui: Ui) {
  const { s, act, busy } = ui;
  return <>
    {s.tutDone && <Tournament {...ui} />}
    <h2>Peleas de práctica</h2>
    <p>Peleas de gimnasio. Cada una gasta 3 de energía. Si perdés, no perdés plata: solo orgullo.</p>
    <div className="list">{RING.map((m, i) => (
      <div className="item" key={m.name}>
        <div className="with-art"><Portrait src={silhouette(m.name)} silhouetteOf size={52} />
          <div><h3>{m.name}<span className={`risk r${m.mult < 0.9 ? 1 : m.mult < 1.3 ? 2 : 3}`}>×{m.mult.toFixed(1)}</span></h3>
          <div className="meta">{s.lvl < m.lvl ? `Pelea con gente de nivel ${m.lvl} para arriba` : m.lore}</div></div></div>
        <div className="act"><button disabled={busy || s.energy < 3 || s.hp < 2 || s.lvl < m.lvl} onClick={() => act({ type: "spar", i })}>Pelear</button></div>
      </div>))}
    </div>
  </>;
}

/* Torneo mensual: una ronda suiza por día, se pelea solo */
function Tournament({ now, ping, refresh, toast }: Ui) {
  const [t, setT] = useState<RingView | null>(null);
  const load = () => api.ring().then(setT).catch(() => {});
  useEffect(() => { load(); }, [ping]);
  if (!t) return <p className="tag">Cargando el torneo…</p>;
  const hours = (ms: number) => { const h = Math.max(0, Math.round((ms - now) / 3_600_000)); return h < 1 ? "menos de una hora" : `${h} ${h === 1 ? "hora" : "horas"}`; };
  const best = t.history.length ? Math.min(...t.history.map(h => h.place)) : null;
  return <div className="thread" style={{ borderColor: "var(--sodium)" }}>
    <h2>Torneo del Ring · {t.seasonName}</h2>
    <p>Una ronda por día, a las 21 h. Te emparejan con alguien de tu mismo puntaje, sin repetir rival, y la pelea se resuelve sola con tus atributos y tu equipo (no hace falta estar conectado). Si hay pocos anotados, se suman boxeadores del barrio. Al cerrar el mes: premio para el podio y respeto para todos.</p>
    <p className="num">Ronda {t.done} de {t.rounds}{t.nextRoundAt ? ` · la próxima en ${hours(t.nextRoundAt)}` : ""} · cierra en {hours(t.closesAt)}</p>
    {!t.joined
      ? <div><button className="primary" onClick={() => api.ringJoin().then(() => { toast("Te anotaste en el torneo.", true); load(); refresh(); }).catch(e => toast(e.message))}>Anotarme gratis</button></div>
      : !!t.matches.length && <p>{t.matches.map(m => `R${m.round}: ${m.rival ? `${m.won ? "le ganaste a" : "perdiste con"} ${m.rival}` : "pasaste sin pelear"}`).join(" · ")}</p>}
    {t.table.some(r => !r.npc) && <ol className="ranking">{t.table.slice(0, 16).map(r => (
      <li key={`${r.name}-${r.place}`} className={r.me ? "me" : ""}>
        <span className="pos">{r.place}</span><span>{r.name}{r.npc && <span className="tag"> · del barrio</span>}</span>
        <span className="tag num">{r.wins}-{r.losses}</span><span className="num">{r.points} pts</span>
      </li>))}
    </ol>}
    {best && <p className="tag">Tu historial: {t.history.length} {t.history.length === 1 ? "torneo" : "torneos"} · mejor puesto: {best}º · {t.history.map(h => `${h.name}: ${h.place}º de ${h.entrants}`).join(" · ")}</p>}
    {!!t.champions.length && <p className="tag">Campeones: {t.champions.map(c => `${c.seasonName}: ${c.name}`).join(" · ")}</p>}
  </div>;
}

function Hospital({ s, act, busy, now }: Ui) {
  const full = s.hp >= maxHp(s), occupied = !!s.busy && !onTheWayHome(s);
  const from = streetFrom(s, now);
  const g = carePlan(s, "guardia", from), c = carePlan(s, "clinica", from);
  const mins = (ms: number) => Math.max(1, Math.round(ms / 60000));
  return <>
    <h2>Clínica y guardia</h2>
    <p>La vida se recupera sola de a poco (de cero a lleno en media hora). Si no querés esperar, tenés que ir a que te curen. Mientras te curan, nadie te puede tocar; después volvés a casa.</p>
    <div className="list">
      <div className="item"><div><h3>Clínica privada · {c.name}</h3>
        <div className="meta">{c.place} · te busca una ambulancia que va a los pedos</div>
        <div className="meta num">{full ? "Estás entero" : `${money(c.cost)} · ${c.go ? `${mins(c.go)} min de ambulancia + ` : ""}${mins(c.stay)} min de atención`}</div></div>
        <div className="act"><button disabled={busy || occupied || full || s.gold < c.cost} onClick={() => act({ type: "heal" })}>Llamar la ambulancia</button></div></div>
      <div className="item"><div><h3>Guardia · {g.name}</h3>
        <div className="meta">{g.place} · gratis, pero vas {g.mode === "pie" ? "caminando" : "en colectivo"} y esperás</div>
        <div className="meta num">{full ? "Estás entero" : `${g.go ? `${mins(g.go)} min de viaje + ` : ""}${mins(g.stay)} min de espera`}</div></div>
        <div className="act"><button disabled={busy || occupied || full} onClick={() => act({ type: "guardia" })}>Ir a la guardia</button></div></div>
      <div className="item"><div><h3>Usar un botiquín</h3><div className="meta num">Tenés {s.potions} · +50% de vida, en el momento</div></div>
        <div className="act"><button disabled={busy || !s.potions} onClick={() => act({ type: "kit" })}>Usar</button></div></div>
    </div>
  </>;
}

const STAT_SHORT: Record<StatKey, string> = { fue: "Fuerza", dur: "Dureza", ref: "Reflejos", agu: "Aguante", lab: "Labia" };
const DIFF_CLASS = ["r1", "r1", "r2", "r3"];

/* La misión en curso: etapas resueltas (✓ / ✗), la que viene y cuánto falta */
/* si venís volviendo a casa: más o menos dónde estás (para mostrar tiempos; el servidor los calcula por las cuadras) */
function streetFrom(s: Ui["s"], now: number, dest?: string): FromPoint | undefined {
  const b = s.busy;
  if (b?.kind !== "vuelta") return undefined;
  const a = placePt(b.place), h = homePt(s);
  if (!a) return undefined;
  const f = Math.min(1, Math.max(0, (now - b.since) / Math.max(1, b.until - b.since)));
  const here: [number, number] = [a[0] + (h[0] - a[0]) * f, a[1] + (h[1] - a[1]) * f];
  const to = dest ? placePt(dest) : null;
  return { km: to ? Math.max(0.2, kmBetween(here, to) * 1.3) : 1 };
}
/* La leyenda del mapa: qué estás haciendo, de quién es, a dónde vas, cómo te va y cuánto falta */
function Legend({ s, now, km }: { s: Ui["s"]; now: number; km: number }) {
  const b = s.busy;
  const left = b ? minTxt(b.until - now) : "";
  const who = (name: string, color: string) => <span className="lg-who" style={{ color, borderColor: color }}>{name}</span>;
  if (!b) return <>Estás en tu {houseOf(s).name.toLowerCase()} de {homePlace(s)}. Tocá un barrio o un lugar, o probá «Cosas que hacer».</>;
  if (b.kind === "mision") {
    const m = findMission(s, b.id);
    if (!m) return <>En una misión · {left}</>;
    const c = clientOf(m), t = b.trip, ph = t ? tripPhase(b, now) : null, n = m.steps.length, res = b.res ?? [], need = missionNeed(m);
    const bad = res.filter(x => !x).length, good = b.ok;
    const doing = ph?.phase === "ida" ? <>{TRAVEL[t!.mode].name} a <b>{t!.place}</b> · faltan {kmTxt(km * (1 - ph.frac))} · llegás en {minTxt(ph.left)}</>
      : <>En <b>{m.place ?? t?.place ?? "el lugar"}</b>, etapa {Math.min(b.done + 1, n)} de {n}</>;
    const mood = bad > n - need ? "Se está cayendo" : good >= need ? "Ya salió bien: falta terminar" : b.done === 0 ? "Recién empieza" : good >= bad ? "Va bien" : "Viene complicada";
    return <>
      <span className="lg-top">{who(c.name, c.color)}<b className="lg-title">{m.title}</b></span>
      <span className="lg-line">{doing}</span>
      <span className="lg-line"><span className="lg-steps">{m.steps.map((_, i) => <span key={i} className={i < b.done ? (res[i] ? "ok" : "ko") : i === b.done ? "now" : ""} />)}</span>
        {mood} · necesitás {need} de {n} · termina en {left}</span>
    </>;
  }
  if (b.kind === "salida") {
    const g = b.what === "encargo" ? GANGS[b.ref as Gang] : null;
    const name = b.what === "golpe" ? [...JOBS, ...GOLPES].find(j => j.id === b.ref)?.name ?? "Golpe" : ENCARGOS[b.ref as Gang]?.name ?? "Encargo";
    const ph = b.trip ? tripPhase(b, now) : null;
    return <>
      <span className="lg-top">{who(g ? g.name : "Golpe", g ? g.color : "#e0524f")}<b className="lg-title">{name}</b></span>
      <span className="lg-line">{ph?.phase === "ida" ? <>{TRAVEL[b.trip!.mode].name} a <b>{b.place}</b> · llegás en {minTxt(ph.left)}</> : <>En <b>{b.place}</b>, haciéndolo · {left}</>}</span>
    </>;
  }
  if (b.kind === "vuelta") return <>
    <span className="lg-top">{who(b.safe ? "Ambulancia" : "Vuelta", b.safe ? "#ff6b6b" : "#e8e1d2")}<b className="lg-title">{b.label ? `Volviendo de ${b.label}` : "Volviendo a casa"}</b></span>
    <span className="lg-line">{b.ok === true && b.label?.startsWith("«") ? "Salió bien · " : b.ok === false ? "Se cayó · " : ""}{TRAVEL[b.mode].name} desde {b.place} · faltan {kmTxt(km * Math.max(0, (b.until - now) / Math.max(1, b.until - b.since)))} · {left}
      {!b.safe && " · podés arrancar otra cosa desde acá"}</span>
  </>;
  if (b.kind === "guardia") return <>
    <span className="lg-top">{who(b.clinic ? "Clínica" : "Guardia", "#ff6b6b")}<b className="lg-title">{b.clinic ? "Te están curando" : "En la guardia"}</b></span>
    <span className="lg-line">Vida {Math.round(s.hp)} de {maxHp(s)} · alta en {left} · nadie te puede tocar</span>
  </>;
  if (b.kind === "caza") return <>
    <span className="lg-top">{who("Caza", "#e0524f")}<b className="lg-title">Buscando a {b.targetName}</b></span>
    <span className="lg-line">{now < b.meet ? <>{CHASE_NAMES[b.mode]} · lo cruzás cerca de {b.place} en {minTxt(b.meet - now)}</> : <>Volviendo a casa · {left}</>}</span>
  </>;
  if (b.kind === "gym") return <>
    <span className="lg-top">{who("Gimnasio", "#5bc0de")}<b className="lg-title">Entrenando {STAT_NAMES[b.stat].toLowerCase()}</b></span>
    <span className="lg-line">Sube a {s.stats[b.stat] + 1} en {left}</span>
  </>;
  return <>{left}</>;
}

/* una línea con dónde va tu personaje */
function tripLine(t: { mode: TravelMode; place: string; back: number }, ph: NonNullable<ReturnType<typeof tripPhase>>, km: number) {
  return ph.phase === "ida" ? <>{TRAVEL[t.mode].name} a <b>{t.place}</b> · faltan {kmTxt(km * (1 - ph.frac))} · llegás en {minTxt(ph.left)}</>
    : ph.phase === "alla" ? <>En <b>{t.place}</b>, trabajando · después, {minTxt(t.back)} de vuelta</>
    : <>Volviendo a casa · faltan {kmTxt(km * (1 - ph.frac))} · {minTxt(ph.left)}</>;
}
const kmTxt = (km: number) => (km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1).replace(".", ",")} km`);
/* «7 h 33 min» en vez de «453 min» */
const minTxt = (ms: number) => { const m = Math.max(1, Math.ceil(ms / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`; };

/* La misión en curso: el GPS con tu personaje y las etapas. Lo que todavía no pasó no se cuenta. */
function MissionProgress({ s, now }: Ui) {
  const b = s.busy;
  if (b?.kind !== "mision") return null;
  const m = findMission(s, b.id);
  if (!m) return null;
  const n = m.steps.length, res = b.res ?? [];
  const t = b.trip, ph = tripPhase(b, now);
  const arrived = !t || (t.ev & 1) === 1;
  const km = t ? tripKm(t.from ?? GEO_HOME, t.place, t.mode) : 0;
  return <div className="mission thread" style={{ borderColor: clientOf(m).color }}>
    <h3>En curso: {m.title}</h3>
    {t && ph && <p className="gps-status num">{tripLine(t, ph, km)} · lo ves en el mapa de arriba</p>}
    <ol className="steps">{m.steps.map((st, i) => {
      const past = i < b.done, current = i === b.done && arrived;
      return <li key={i} className={past ? (res[i] ? "ok" : "ko") : current ? "now" : "later"}>
        <span className="n">{past ? (res[i] ? "✓" : "✗") : i + 1}</span>
        {past ? <span>{(st.fight ? (res[i] ? st.win : st.lose) : res[i] ? st.ok : st.ko) ?? st.text}</span>
          : current ? <span>{st.text}<br /><span className="tag">se resuelve en {minTxt(missionStepAt(b, n, i) - now)}</span></span>
          : <span className="dash" aria-label="todavía no pasó" />}
      </li>;
    })}
    </ol>
    <p className="tag">Tienen que salir bien {missionNeed(m)} de {n} etapas. Lo que pasa queda en la crónica.</p>
  </div>;
}

/* Tarjeta de una misión: dónde es, duración, energía, requisitos y premio. Al salir, elegís cómo ir. */
function MissionCard({ m, s, act, busy, note, chip, now }: Ui & { m: Mission; note?: string; chip?: { name: string; color: string } }) {
  const [choosing, setChoosing] = useState(false);
  const req = Object.entries(missionReq(m)) as [StatKey, number][];
  const ok = canStart(s, m), meets = meetsReq(s, m), energy = missionEnergy(m);
  const done = !!s.done[m.id];
  const can = ok && meets && (!s.busy || onTheWayHome(s)) && s.energy >= energy && s.hp >= maxHp(s) * 0.5;
  const place = missionPlace(m);
  const from = place ? streetFrom(s, now, place) : undefined;
  const trip = needsTrip(s, m, from) && place;
  const c = chip ?? (m.street ? clientOf(m) : undefined);
  const start = (mode?: TravelMode) => { setChoosing(false); act({ type: "mstart", id: m.id, mode }); };
  return <div className="item mission-card">
    <div><h3>{m.title}{m.hours ? <span className="risk r3">{m.hours} horas</span>
          : m.street && <span className={`risk ${DIFF_CLASS[m.difficulty ?? 0]}`}>{STREET_DIFF[m.difficulty ?? 0].name}</span>}
        {c && <span className="client" style={{ color: c.color, borderColor: c.color }}>{c.name}</span>}
        {m.until && !done && <span className="client until">⏳ {minTxt(m.until - now)}</span>}</h3>
      <div className="meta">{done ? "Hecha." : m.street ? m.intro || null : m.intro}</div>
      {!done && <div className="meta num">
        {place && <>{place} · </>}{m.hours ? `${m.hours} h` : `${missionMins(m)} min`}{trip ? " + viaje" : ""} · {energy} energía
        {req.length > 0 && <> · pide {req.map(([k, v], i) => <span key={k} style={{ color: eff(s, k) < v ? "#eba09e" : undefined }}>{i ? ", " : ""}{STAT_SHORT[k]} {v}</span>)}</>}
        {m.reward && <> · {money(m.reward.gold)}, {m.reward.xp} XP, +{m.reward.resp} respeto</>}
        {m.reward?.heat && m.reward.heat < 0 ? <> · <b>−{-m.reward.heat} de búsqueda</b></> : null}
        {m.street && m.gang && <> · +{m.aff} afinidad con <span style={{ color: GANGS[m.gang].color }}>{GANGS[m.gang].name}</span></>}
        {m.target && <> · <span style={{ color: GANGS[m.target].color }}>{GANGS[m.target].name}</span> pierde terreno y te quiere menos</>}
      </div>}
      {!done && note && <div className="lock">{note}</div>}
      {choosing && trip && <div className="travel">
        <div className="tag">¿Cómo vas hasta {place}? {from ? `(~${kmTxt(from.km)} desde donde estás)` : `(${kmTxt(tripKm(homePlace(s), place, "colectivo"))} desde tu casa en ${homePlace(s)})`}</div>
        {travelModes(s, place, from).map(k => {
          const cost = tripCost(s, k, place, from), mins = tripMins(s, k, place, from) + missionMins(m);
          return <button key={k} className="mode" disabled={busy || s.gold < cost} onClick={() => start(k)}>
            <b>{TRAVEL[k].name}</b><span className="num">{from ? "~" : ""}{mins} min hasta terminar (después volvés a casa) · {cost ? `${money(cost)} ida y vuelta` : "gratis"}</span><span className="tag">{TRAVEL_RISK[k]}</span>
          </button>;
        })}
        <button className="mode ghost" onClick={() => setChoosing(false)}>Mejor no</button>
      </div>}
    </div>
    <div className="act"><button className={can ? "primary" : ""} disabled={busy || !can || choosing}
      onClick={() => (trip ? setChoosing(true) : start())}>{done ? "Hecha" : "Salir"}</button></div>
  </div>;
}

function Missions(ui: Ui) {
  const { s, act, busy } = ui;
  if (!s.tutDone) return <>
    <h2>Misiones</h2>
    <p>Las misiones llevan tiempo de verdad: salís a hacerla y cada etapa se resuelve sola a su hora. Lo que pasa te lo cuenta la crónica.</p>
    <MissionProgress {...ui} />
    {!s.c.valija && !s.busy && <MissionCard m={VALIJA} {...ui} />}
  </>;
  const rk = rankOf(s), mine = gangOf(s);
  return <>
    <h2>Misiones</h2>
    <p>Llevan tiempo de verdad y piden atributos mínimos. Mientras estás en una, no podés hacer otra cosa. Las de calle se renuevan cada 6 horas; las de cada pandilla cuentan su historia y suman mucha afinidad.</p>
    <MissionProgress {...ui} />
    <div className="row-actions" style={{ justifyContent: "space-between" }}>
      <h3>Tablón de la calle</h3>
      <button disabled={busy || !!s.busy || s.energy < BOARD_REROLL_COST} onClick={() => act({ type: "reroll" })}>Buscar otras · {BOARD_REROLL_COST} energía</button>
    </div>
    <div className="list">{s.board.filter(m => !m.hours && doable(s, m) && !(s.busy?.kind === "mision" && s.busy.id === m.id)).map(m => <MissionCard key={m.id} m={m} {...ui} />)}</div>
    <h3>Trabajos largos en el conurbano</h3>
    <p className="tag">Turnos de horas en {Object.values(ZONE_NAMES).join(", ")}: para cuando no vas a estar. Pagan mucho por la energía que gastan; mientras tanto la energía se sigue cargando (hasta el tope).</p>
    <div className="list">{s.board.filter(m => m.hours && doable(s, m) && !(s.busy?.kind === "mision" && s.busy.id === m.id)).map(m => <MissionCard key={m.id} m={m} {...ui} />)}</div>
    {s.lvl < POLICE_LVL && <p className="tag">Desde el nivel {POLICE_LVL}, el comisario Funes también deja trabajos sucios en el tablón.</p>}
    <Stories {...ui} />
    <h3>Las pandillas</h3>
    {GANG_KEYS.map(g => {
      const info = GANGS[g];
      return <div key={g} className="thread" style={{ borderColor: info.color }}>
        <div className="with-art"><Portrait src={bossImg(g)} gang={g} size={56} />
          <div><h3 style={{ color: info.color }}>{info.name}{mine === g && <span className="kind">tu pandilla</span>}</h3>
            <div className="meta">{info.boss} · {info.hood} · vos: {Math.round(affShare(s, g) * 100)}%</div></div></div>
        <div className="list">{MISSIONS[g].filter(m => doable(s, m)).map((m: Mission) => <MissionCard key={m.id} m={m} {...ui} />)}</div>
      </div>;
    })}
  </>;
}

/* Historias de la ciudad: cada capítulo con un solo bando; el siguiente se abre al terminar el anterior */
function Stories(ui: Ui) {
  const { s } = ui;
  return <>
    <h3>Historias de la ciudad</h3>
    <p className="tag">El mismo hecho, contado desde cada bando. Cada capítulo lo hacés con uno solo: cuando sale bien, los otros bandos se cierran. El capítulo siguiente se abre cuando terminás el anterior.</p>
    {ARCS.map(arc => <div key={arc.id} className="thread arc">
      <h3>{arc.title}</h3>
      <div className="meta">{arc.blurb}</div>
      {arc.chapters.map((c, ch) => {
        const by = POVS.find(p => s.done[arcMissionId(arc.id, ch, p)]);
        const open = ch === 0 || !!s.done[arcChapterKey(arc.id, ch - 1)];
        return <div key={ch} className="chapter">
          <h4>Capítulo {ch + 1} · {open || by ? c.name : "???"} <span className="tag">{open || by ? `${c.place} · rango ${RANK_NAMES[c.rank]}` : ""}</span></h4>
          {by ? <div className="meta">Lo hiciste con <b style={{ color: POV_COLOR[by] }}>{POV_NAME[by]}</b>.</div>
            : !open ? <div className="meta">Se abre cuando termines el capítulo anterior.</div>
            : <div className="list">{POVS.map(p => findMission(s, arcMissionId(arc.id, ch, p))!).filter(m => doable(s, m)).map(m =>
                <MissionCard key={m.id} m={m} {...ui} chip={{ name: POV_NAME[m.pov!], color: POV_COLOR[m.pov!] }} />)}</div>}
        </div>;
      })}
    </div>)}
  </>;
}

function Street({ s, act, busy }: Ui) {
  const weak = s.hp < maxHp(s) * MIN_HP_TO_FIGHT, mine = gangOf(s);
  return <>
    <h2>La calle</h2>
    <p>Pandilleros {mine ? `de las otras pandillas (a los de ${GANGS[mine].name} no los podés tocar)` : "de todas las pandillas: andás suelto, así que todos son rivales"}. Si ganás, te quedás con parte de lo que llevan encima. Cada pelea gasta {DUEL_COST} de energía. Los que dicen <span className="kind">jugador</span> son personas de verdad, y a vos también te pueden venir a buscar; los <span className="kind">vecino</span> juegan solos, pero con las mismas reglas.</p>
    {weak && <p className="result bad">Estás muy golpeado para salir a pelear. Pasá por la guardia.</p>}
    <div className="list">{s.targets.map((t, i) => {
      const d = t.lvl - s.lvl;
      return <div className="item" key={`${t.name}-${i}`}>
        <div className="with-art">
          <Portrait src={t.kind === "player" ? avatarImg(t.avatar) : silhouette(t.name)} gang={t.gang} silhouetteOf={t.kind !== "player"} size={56} />
          <div><h3>{t.name}<span className={`risk r${d < 0 ? 1 : d < 2 ? 2 : 3}`}>nivel {t.lvl}</span>{t.kind === "player" && <span className="kind">jugador</span>}</h3>
          <div><GangBadge gang={t.gang} /></div>
          <div className="meta num">Lleva unos {money(t.gold)}</div></div></div>
        <div className="act"><button disabled={busy || s.energy < DUEL_COST || weak} onClick={() => act({ type: "duel", i })}>Atacar</button></div>
      </div>;
    })}</div>
    <div><button disabled={busy || s.energy < SCOUT_COST} onClick={() => act({ type: "scout" })}>Buscar a otros · {SCOUT_COST} energía</button></div>
  </>;
}

function Ranking({ s }: Ui) {
  const [rows, setRows] = useState<RankRow[] | null>(null);
  const [map, setMap] = useState<{ map: BarrioView[]; owned: Record<Gang, number> } | null>(null);
  useEffect(() => {
    api.ranking().then(setRows).catch(() => setRows([]));
    api.territory().then(setMap).catch(() => {});
  }, [s.respect]);
  const mine = gangOf(s);
  return <>
    <h2>Maires</h2>
    <p>Cada barrio es de la pandilla con más influencia. La influencia la ganás trabajando para una pandilla (misiones, encargos, golpes y peleas) y se va gastando: pierde la mitad por semana. Cada barrio de tu pandilla te da +{Math.round(TURF_BONUS * 100)}% de plata.</p>
    {mine && map && <p className="result good">{GANGS[mine].name} controla {map.owned[mine]} {map.owned[mine] === 1 ? "barrio" : "barrios"}: +{map.owned[mine] * Math.round(TURF_BONUS * 100)}% de plata para vos.</p>}
    <p className="tag">En el mapa de arriba los barrios tienen el color de su dueño.</p>
    {!map ? <p className="tag">Cargando los barrios…</p> :
      <div className="barrios">{map.map.map(b => {
        const total = GANG_KEYS.reduce((a, g) => a + b.points[g], 0) || 1;
        const c = b.owner ? GANGS[b.owner].color : "var(--line)";
        return <div key={b.barrio} className="barrio" style={{ borderColor: c, background: b.owner ? `linear-gradient(160deg, ${c}33, transparent 70%)` : undefined }}>
          <b>{b.barrio}</b>
          <span className="tag" style={{ color: b.owner ? c : undefined }}>{b.owner ? GANGS[b.owner].name : "En disputa"}</span>
          <div className="stack">{GANG_KEYS.map(g => <span key={g} title={`${GANGS[g].name}: ${b.points[g]}`} style={{ width: `${b.points[g] / total * 100}%`, background: GANGS[g].color }} />)}</div>
          {b.barrio === HOME_BARRIO[mine ?? "familia"] && mine && <span className="tag">el barrio de tu pandilla</span>}
        </div>;
      })}</div>}
    <h2>Ranking</h2>
    <p>Quién manda en Maires, de las cuatro pandillas. Se ordena por respeto.</p>
    {!rows ? <p className="tag">Cargando…</p> :
      <ol className="ranking">{rows.map((r, i) => (
        <li key={`${r.name}-${i}`} className={r.me ? "me" : ""}>
          <span className="pos">{i + 1}</span>
          <span>{r.name} <GangBadge gang={r.gang} />{!r.npc && !r.me && <span className="kind">jugador</span>}</span>
          <span className="tag num">nivel {r.lvl}</span><span className="num">{r.resp}</span>
        </li>))}
      </ol>}
  </>;
}

/* Tu casa: cama (energía y descanso), caja fuerte (plata a salvo) y armario (equipo guardado) */
function House({ s, act, busy, now }: Ui) {
  const [amount, setAmount] = useState("");
  const o = s.home.obra;
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  return <>
    <h2>Tu casa: {houseOf(s).name} en {homePlace(s)}</h2>
    <p>Tu guarida: de acá salen y acá vuelven todos tus viajes. Cada mejora cuesta plata y lleva un tiempo de obra; mientras tanto podés seguir haciendo tu vida. Una obra por vez. En una casa chica no entra todo: para mejorar más, mudate.</p>
    {o && <p className="result good">Obra en curso: {HOME[o.part].levels[s.home[o.part] + 1].name} · faltan {Math.max(1, Math.ceil((o.until - now) / 60000))} min.</p>}
    <div className="list">{(Object.keys(HOME) as (keyof typeof HOME)[]).map(part => {
      const h = HOME[part], lv = s.home[part], next = nextLevel(s, part), roof = lv + 1 > houseOf(s).cap;
      return <div className="item" key={part}>
        <div><h3>{h.title}: {h.levels[lv].name}</h3><div className="meta">{h.help}
          {part === "cama" && ` Ahora: +${BED_ENERGY[lv]} de energía máxima.`}
          {part === "caja" && ` Capacidad: ${money(safeCap(s))}.`}
          {part === "armario" && ` Tu bolso: ${bagSize(s)} cosas.`}
          {next && <><br /><span className="num">Siguiente: {next.name} · {money(next.cost)} · {next.mins} min de obra</span></>}</div></div>
        <div className="act">{!next ? <span className="tag">al máximo</span>
          : roof ? <span className="tag">no entra en tu casa</span>
          : <button disabled={busy || !!o || s.gold < next.cost} onClick={() => act({ type: "build", part })}>Mejorar</button>}</div>
      </div>;
    })}</div>

    <h3>Mudarte</h3>
    <p>Más cerca de donde trabajás, viajes más cortos. Las casas más grandes dejan mejorar más.</p>
    <HouseList {...{ s, act, busy } as Ui} b={homePlace(s)} />
    <p className="tag">Para ver las casas de otro barrio, tocalo en el mapa.</p>

    {safeCap(s) > 0 && <>
      <h3>Caja fuerte</h3>
      <p>Tenés {money(s.home.safe)} guardados de {money(safeCap(s))}. Lo que está acá no te lo roban en la calle ni te lo sacan en una fianza.</p>
      <div className="row-actions">
        <input type="number" min={1} inputMode="numeric" placeholder="Monto" value={amount} onChange={e => setAmount(e.target.value)} aria-label="Monto" />
        <button disabled={busy || !n || !s.gold} onClick={() => { act({ type: "deposit", amount: n }); setAmount(""); }}>Guardar</button>
        <button disabled={busy || !s.gold} onClick={() => act({ type: "deposit", amount: s.gold })}>Guardar todo</button>
        <button disabled={busy || !n || !s.home.safe} onClick={() => { act({ type: "withdraw", amount: n }); setAmount(""); }}>Sacar</button>
      </div>
    </>}


  </>;
}

/* Amigos y misiones de a dos */
/* Negocios y garaje */
function Business({ s, act, busy, now }: Ui) {
  const owned = (id: string) => s.props?.[id] !== undefined;
  const pending = PROPS.reduce((a, p) => a + (owned(p.id) ? propIncome(p, s.props![p.id], now) : 0), 0);
  return <>
    <h2>Negocios</h2>
    <p>Comprás un negocio y deja plata por hora, aunque no estés. Hay que pasar a cobrarla: junta como mucho {PROP_CAP_HOURS} horas. Cada negocio trae sus propias misiones al tablón.</p>
    <div className="row-actions"><button className={pending ? "primary" : ""} disabled={busy || !pending} onClick={() => act({ type: "collect" })}>Cobrar {money(pending)}</button></div>
    <div className="list">{PROPS.map(p => {
      const mine = owned(p.id), locked = s.lvl < p.lvl;
      return <div className="item" key={p.id}>
        <div><h3>{p.name}{mine && <span className="kind">tuyo</span>}</h3>
          <div className="meta">{p.help} {p.place}.</div>
          <div className="meta num">{money(p.perHour)} por hora{p.heat ? ` · +${p.heat} de búsqueda por cobro` : ""}
            {mine ? <> · juntó {money(propIncome(p, s.props![p.id], now))}</> : <> · {money(p.price)}</>}</div>
          {!mine && locked && <div className="lock">Pide nivel {p.lvl}</div>}</div>
        <div className="act">{!mine && <button disabled={busy || locked || s.gold < p.price} onClick={() => act({ type: "prop", id: p.id })}>Comprar</button>}</div>
      </div>;
    })}</div>
    <h3>Garaje</h3>
    <p>Con vehículo propio vas más rápido a las misiones, pero te ven llegar y te pueden parar en un control.{owned("taller") ? " Con tu taller, los arreglos salen 30% menos." : ""}</p>
    <div className="list">{(Object.keys(VEHICLES) as Vehicle[]).map(v => {
      const info = VEHICLES[v], has = hasVehicle(s, v), locked = s.lvl < info.lvl;
      return <div className="item" key={v}>
        <div><h3>{info.name}{has && <span className="kind">tuya</span>}</h3>
          <div className="meta">{info.help}</div>
          {!has && <div className="meta num">{money(info.price)}</div>}
          {!has && locked && <div className="lock">Pide nivel {info.lvl}</div>}
          {has && <div className="mods">{(Object.keys(MODS) as ModKey[]).filter(k => MODS[k].price[v]).map(k => {
            const done = hasMod(s, v, k), cost = modCost(s, MODS[k].price[v]!);
            return <button key={k} disabled={busy || done || s.gold < cost} onClick={() => act({ type: "mod", v, mod: k })}>
              {MODS[k].name}{done ? " ✓" : ` · ${money(cost)}`}<span className="tag">{MODS[k].help}</span></button>;
          })}</div>}</div>
        <div className="act">{!has && <button disabled={busy || locked || s.gold < info.price} onClick={() => act({ type: "vehicle", v })}>Comprar</button>}</div>
      </div>;
    })}</div>
  </>;
}

function Friends({ s, busy, ping, refresh, toast }: Ui) {
  const [data, setData] = useState<FriendsView | null>(null);
  const [name, setName] = useState("");
  const [working, setWorking] = useState(false);
  const load = () => api.friends().then(setData).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [ping]);
  /* toda acción: llamar, avisar el error si lo hay, y recargar amigos y personaje */
  const run = async (f: () => Promise<unknown>, ok?: string) => {
    setWorking(true);
    try { await f(); if (ok) toast(ok, true); }
    catch (e: any) { toast(e.message); }
    finally { setWorking(false); load(); refresh(); }
  };
  const off = busy || working;
  const c = s.coop;
  const coopMeta = (m: { mins?: number; reward?: { gold: number; xp: number } }) =>
    `${m.mins ?? COOP_MINS} min · ${COOP_ENERGY} de energía cada uno · ${money(m.reward?.gold ?? 0)} y ${m.reward?.xp ?? 0} XP para cada uno`;

  return <>
    <h2>Amigos</h2>
    <p>Agregá a tus amigos por su nombre en el juego. Con un amigo podés hacer misiones de a dos: pagan más, y arrancan cuando los dos estén libres.</p>
    <form className="row-actions" onSubmit={e => { e.preventDefault(); if (name.trim()) run(() => api.addFriend(name.trim()), "Solicitud enviada.").then(() => setName("")); }}>
      <input placeholder="Nombre de tu amigo" value={name} onChange={e => setName(e.target.value)} maxLength={20} aria-label="Nombre de tu amigo" />
      <button disabled={off || !name.trim()}>Agregar</button>
    </form>

    {c && <div className="thread" style={{ borderColor: "var(--sodium)" }}>
      <h3>Tu misión de a dos: {c.mission.title}</h3>
      <p className="meta">Con {c.partner} · {c.status === "waiting" ? "esperando a que los dos estén libres" : "en curso (mirá el avance arriba de tu vida)"} · {coopMeta(c.mission)}</p>
      <div><button className="link" disabled={off} onClick={() => run(() => api.coopCancel(c.id))}>{c.status === "waiting" ? "Cancelar (se devuelve la energía)" : "Abandonar"}</button></div>
    </div>}

    {!!data?.invites.length && <>
      <h3>Te invitaron</h3>
      <div className="list">{data.invites.map(i => (
        <div className="item" key={i.id}>
          <div><h3>{i.mission.title}</h3><div className="meta">{i.from} te invita · {coopMeta(i.mission)}</div></div>
          <div className="act">
            <button className="primary" disabled={off || !!c} onClick={() => run(() => api.coopRespond(i.id, true), "¡Aceptada! Arranca cuando los dos estén libres.")}>Aceptar</button>
            <button disabled={off} onClick={() => run(() => api.coopRespond(i.id, false))}>No puedo</button>
          </div>
        </div>))}</div>
    </>}

    {!!data?.incoming.length && <>
      <h3>Solicitudes de amistad</h3>
      <div className="list">{data.incoming.map(p => (
        <div className="item" key={p.id}>
          <div className="with-art"><Portrait src={avatarImg(p.avatar)} gang={p.gang} size={44} /><div><h3>{p.name}</h3><div className="meta">nivel {p.lvl}</div></div></div>
          <div className="act">
            <button className="primary" disabled={off} onClick={() => run(() => api.acceptFriend(p.id), `Ahora sos amigo de ${p.name}.`)}>Aceptar</button>
            <button disabled={off} onClick={() => run(() => api.removeFriend(p.id))}>Rechazar</button>
          </div>
        </div>))}</div>
    </>}

    <h3>Tus amigos</h3>
    {!data ? <p className="tag">Cargando…</p> : !data.friends.length ? <p>Todavía no agregaste a nadie.</p> :
      <div className="list">{data.friends.map(p => {
        const sent = data.sent.find(x => x.to === p.name);
        return <div className="item" key={p.id}>
          <div className="with-art"><Portrait src={avatarImg(p.avatar)} gang={p.gang} size={48} />
            <div><h3>{p.name} <span className={`live ${p.online ? "on" : ""}`} /></h3>
              <div className="meta">nivel {p.lvl} · <GangBadge gang={p.gang} /> · {p.online ? "en línea" : "desconectado"}</div>
              {sent && <div className="lock">Invitación enviada: {sent.mission.title}</div>}</div></div>
          <div className="act">{sent
            ? <button className="link" disabled={off} onClick={() => run(() => api.coopCancel(sent.id))}>Cancelar invitación</button>
            : <button disabled={off || !!c || !!data.sent.length} onClick={() => run(() => api.coopInvite(p.id), `Invitaste a ${p.name}.`)}>Misión de a dos</button>}
            <button className="link" disabled={off} onClick={() => run(() => api.removeFriend(p.id))}>Quitar</button>
          </div>
        </div>;
      })}</div>}

    {!!data?.outgoing.length && <p className="tag">Esperando respuesta: {data.outgoing.map(p => p.name).join(", ")}.</p>}
  </>;
}
