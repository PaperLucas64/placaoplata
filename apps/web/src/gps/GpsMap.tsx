/* El GPS: mapa real (OpenStreetMap, servido gratis y sin clave por OpenFreeMap) con un estilo oscuro propio y sin los
   nombres reales de las calles: encima van los barrios de Maires. Muestra el recorrido de tu personaje y dónde está ahora.
   Los recorridos vienen de tools/geo/build.py; se cargan aparte para no pesar en la primera pantalla. */
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
/* MapLibre 6 busca su worker al lado de su propio archivo; Vite no lo copia, así que lo armamos aparte y le pasamos la dirección */
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(mapWorkerUrl);
import {
  CHASE_NAMES, chaseModes, DUEL_COST, GANGS, GEO_HOME, GEO_PLACES, legsFor, money, planChase, positionAt, TRAVEL, travelerPos, tripPhase,
  type ChaseMode, type PlayerState, type Pt, type Rutas, type TravelMode
} from "@pop/shared";
import type { Traveler } from "../api";

let rutasCache: Promise<Rutas> | null = null;
type Barrios = { type: "FeatureCollection"; features: { type: "Feature"; properties: { name: string; game: boolean; color?: string }; geometry: { type: "MultiPolygon"; coordinates: number[][][][] } }[] };
let barriosCache: Promise<Barrios> | null = null;
const loadBarrios = () => (barriosCache ??= import("@pop/shared/barrios.json").then(m => m.default as unknown as Barrios));
/* los barrios con el color de su dueño (los del juego); el resto de la ciudad, sin color */
const paintBarrios = (b: Barrios, owners?: Record<string, string | null>) => ({ ...b,
  features: b.features.map(f => ({ ...f, properties: { ...f.properties, color: f.properties.game ? owners?.[f.properties.name] ?? "#8a8070" : "#3a3d46" } })) });
export const loadRutas = () => (rutasCache ??= import("@pop/shared/rutas.json").then(m => m.default as unknown as Rutas));

/* ---------- estilo oscuro a partir de «positron» de OpenFreeMap ---------- */
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
let styleCache: Promise<StyleSpecification> | null = null;
const loadStyle = () => (styleCache ??= fetch(STYLE_URL).then(r => r.json()).then(darken));
function darken(st: StyleSpecification): StyleSpecification {
  const layers = st.layers.filter(l => l.type !== "symbol").map(l => {
    const id = l.id;
    if (l.type === "background") return { ...l, paint: { "background-color": "#0d0e11" } };
    if (l.type === "fill") {
      const c = id.includes("water") ? "#141c26" : id.includes("park") || id.includes("wood") ? "#111813"
        : id.includes("building") ? "#16181d" : id.includes("residential") ? "#101114" : "#121316";
      return { ...l, paint: { ...(l.paint ?? {}), "fill-color": c, "fill-outline-color": c } };
    }
    if (l.type === "line") {
      const c = id.includes("water") ? "#141c26" : id.includes("boundary") ? "#2c2c35"
        : id.includes("rail") ? "#24262c" : id.includes("major") || id.includes("motorway") ? "#34373f" : "#25272d";
      return { ...l, paint: { ...(l.paint ?? {}), "line-color": c } };
    }
    return l;
  }) as StyleSpecification["layers"];
  return { ...st, layers };
}

/* ---------- vista satélite (Esri World Imagery), oscurecida para que siga siendo de noche ---------- */
const ESRI_KEY = (import.meta.env.VITE_ESRI_KEY as string | undefined) ?? "";
const SAT_TILES = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}${ESRI_KEY ? `?token=${ESRI_KEY}` : ""}`;
function satellite(base: StyleSpecification): StyleSpecification {
  return {
    version: 8, glyphs: base.glyphs, sprite: base.sprite,
    sources: { sat: { type: "raster", tiles: [SAT_TILES], tileSize: 256, maxzoom: 19,
      attribution: "Imágenes © Esri, Maxar, Earthstar Geographics" } },
    layers: [{ id: "sat", type: "raster", source: "sat",
      paint: { "raster-brightness-max": 0.62, "raster-saturation": -0.3, "raster-contrast": 0.08 } }]
  };
}
const SAT_KEY = "maires.satelite";
const readSat = () => { try { return localStorage.getItem(SAT_KEY) === "1"; } catch { return false; } };
const saveSat = (v: boolean) => { try { localStorage.setItem(SAT_KEY, v ? "1" : "0"); } catch { /* sin almacenamiento: solo por esta vez */ } };

const COLORS: Record<string, string> = { ambulancia: "#ff6b6b", pie: "#e8e1d2", colectivo: "#f2c94c", taxi: "#f2c94c", micro: "#e6a14f", moto: "#e0524f", auto: "#e0524f", subte: "#5bc0de", tren: "#8bd17c" };

const ll = (p: Pt): [number, number] => [p[1], p[0]];

function labelEl(text: string, cls = "") {
  const el = document.createElement("div");
  el.className = `gps-label ${cls}`;
  el.innerHTML = `<span></span>`;
  el.firstElementChild!.textContent = text;
  return el;
}

/* ---------- personajes estilo RPG Maker: 3 cuadros por 4 direcciones (abajo, izquierda, derecha, arriba) ---------- */
function spriteEl(src: string, opts: { me?: boolean; color?: string; label?: string }) {
  const el = document.createElement("div");
  el.className = `spr${opts.me ? " me" : ""}`;
  el.innerHTML = `<div class="spr-ring"></div><div class="spr-body"></div>${opts.label ? `<div class="spr-name"></div>` : ""}`;
  (el.children[1] as HTMLElement).style.backgroundImage = `url(${src})`;
  if (opts.color) el.style.setProperty("--ring", opts.color);
  if (opts.label) (el.children[2] as HTMLElement).textContent = opts.label;
  return el;
}
/* mira para donde camina; quieto, de frente */
function face(el: HTMLElement, from: Pt | undefined, to: Pt) {
  const dx = from ? (to[1] - from[1]) * Math.cos(to[0] * Math.PI / 180) : 0, dy = from ? to[0] - from[0] : 0;
  const moving = Math.hypot(dx, dy) > 1e-6;
  if (moving) el.style.setProperty("--row", String(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 3 : 0)));
  else el.style.setProperty("--row", "0");
  el.classList.toggle("walk", moving);
}

/* textos de los controles del mapa, en castellano */
const LOCALE = {
  "NavigationControl.ZoomIn": "Acercar", "NavigationControl.ZoomOut": "Alejar",
  "CooperativeGesturesHandler.WindowsHelpText": "Ctrl + rueda para acercar o alejar el mapa",
  "CooperativeGesturesHandler.MacHelpText": "⌘ + rueda para acercar o alejar el mapa",
  "CooperativeGesturesHandler.MobileHelpText": "Usá dos dedos para mover el mapa"
};

interface Props {
  place?: string;            // destino del viaje (si hay)
  mode?: TravelMode;
  at?: { back: boolean; f: number } | null; // dónde va el personaje: ida o vuelta y fracción del tramo
  sprite?: string;           // tu personaje (si no está, no se dibuja)
  owners?: Record<string, string | null>;   // color de la pandilla dueña de cada barrio (mapa de la ciudad)
  others?: Traveler[];       // los demás en la calle (id -1: vos, cuando salís a buscar a alguien)
  now?: number;
  spriteOf?: (t: Traveler) => string;
  /* salir a buscar a alguien: quién sos, por qué no podés (o null) y qué hacer al elegir cómo ir */
  attack?: { s: PlayerState; why: (t: Traveler) => string | null; go: (t: Traveler, mode: ChaseMode) => void };
  height?: number;
  className?: string;
  home?: string;             // el barrio donde vive tu personaje (de ahí salen sus viajes)
  homeAt?: [number, number]; // la puerta de tu casa (si no, el centro del barrio)
  path?: Pt[];               // si saliste desde la calle: el camino por las cuadras
  pins?: Pin[];              // lugares del mapa (contactos, servicios, golpes, misiones…)
  onPin?: (id: string) => void;
  onBarrio?: (name: string) => void; // tocar un barrio (como el mapa de Helldivers)
  onMe?: () => void;         // tocarte a vos
  onProfile?: (id: number) => void; // ver el perfil de otro jugador (desde su tarjeta)
  focus?: string | null;     // barrio al que acercarse
  selected?: string | null;
}
/* un lugar del mapa, como los íconos de GTA */
export interface Pin { id: string; name: string; icon: string; color: string; lat: number; lng: number; badge?: string; near?: boolean; deep?: boolean } // near: de cerca; deep: de muy cerca
const PIN_ICONS = import.meta.glob("../assets/lugares/*.svg", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const pinIcon = (k: string) => PIN_ICONS[`../assets/lugares/${k}.svg`] ?? PIN_ICONS["../assets/lugares/mision.svg"];
export function GpsMap({ place, mode, at, sprite, owners, others, now = Date.now(), spriteOf, attack, height, className = "", home: homeName = GEO_HOME, path, pins, onPin, selected, onBarrio, focus, onMe, homeAt, onProfile }: Props) {
  const onProfileRef = useRef(onProfile);
  onProfileRef.current = onProfile;
  const homeKey = homeAt ? homeAt.join(",") : "";
  const homeLL = () => homeAt ? { lat: homeAt[0], lng: homeAt[1] } : GEO_PLACES[homeName] ?? GEO_PLACES[GEO_HOME];
  const onBarrioRef = useRef(onBarrio);
  onBarrioRef.current = onBarrio;
  const onMeRef = useRef(onMe);
  onMeRef.current = onMe;
  const pinMarks = useRef(new Map<string, maplibregl.Marker>());
  const onPinRef = useRef(onPin);
  onPinRef.current = onPin;
  const box = useRef<HTMLDivElement>(null);
  const me = useRef<maplibregl.Marker | null>(null);
  const mePrev = useRef<Pt | undefined>(undefined);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef(new Map<number, maplibregl.Marker>());
  const prev = useRef(new Map<number, Pt>());
  const latest = useRef({ others, now, attack });
  latest.current = { others, now, attack };
  const [data, setData] = useState<{ rutas: Rutas; style: StyleSpecification; barrios: Barrios } | null>(null);
  const [failed, setFailed] = useState(false);
  const self = others?.find(o => o.id < 0);
  const traveling = !!place || !!self;
  const [follow, setFollow] = useState(traveling);
  const [sat, setSat] = useState(readSat);
  useEffect(() => { if (traveling) setFollow(true); }, [traveling]);
  const followRef = useRef(follow);
  followRef.current = follow;
  useEffect(() => {
    Promise.all([loadRutas(), loadStyle(), loadBarrios()]).then(([rutas, style, barrios]) => setData({ rutas, style, barrios })).catch(() => setFailed(true));
  }, []);

  /* armar el mapa y el recorrido */
  useEffect(() => {
    if (!box.current || !data) return;
    const home = homeLL();
    const map = new maplibregl.Map({
      container: box.current, style: sat ? satellite(data.style) : data.style, center: [home.lng, home.lat], zoom: 12, locale: LOCALE,
      attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false // la ruedita acerca y aleja
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("dragstart", () => setFollow(false)); // si lo movés a mano, deja de seguirte
    /* de lejos se ven solo los lugares importantes; acercándote, todos */
    const zoomClass = () => { const c = box.current?.parentElement?.classList, z = map.getZoom(); c?.toggle("far", z < 13.2); c?.toggle("mid", z < 14.2); };
    map.on("zoom", zoomClass); map.once("load", zoomClass);
    mapRef.current = map;
    const bounds = new maplibregl.LngLatBounds([home.lng, home.lat], [home.lng, home.lat]);
    /* barrios de la ciudad (con el color de su dueño, si hay) y el conurbano; el interior solo si vas para allá */
    for (const [name, p] of Object.entries(GEO_PLACES)) {
      if (p.interior && name !== place) continue;
      const lbl = labelEl(name, name === place ? "dest" : name === homeName ? "home" : "");
      if (owners?.[name]) lbl.style.setProperty("--owner", owners[name]);
      new maplibregl.Marker({ element: lbl, anchor: "center" })
        .setLngLat([p.lng, p.lat]).addTo(map);
      if (!place && !p.zone) bounds.extend([p.lng, p.lat]);
    }
    const r = place ? data.rutas[homeName]?.[place] : undefined;
    const legs = path && path.length > 1 && mode ? [{ kind: mode as string, pts: path, w: 1 }] : r && mode ? legsFor(r, mode) : [];
    for (const l of legs) for (const p of l.pts) bounds.extend(ll(p));
    if (place && !legs.length && GEO_PLACES[place]) bounds.extend([GEO_PLACES[place].lng, GEO_PLACES[place].lat]);
    map.on("load", () => {
      /* contornos de los barrios, del color de la pandilla que los controla */
      map.addSource("barrios", { type: "geojson", data: paintBarrios(data.barrios, owners) as never });
      map.addLayer({ id: "barrios-fill", type: "fill", source: "barrios", filter: ["==", ["get", "game"], true],
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.13 } });
      map.on("click", "barrios-fill", e => {
        const name = e.features?.[0]?.properties?.name as string | undefined;
        if (name && !(e.originalEvent.target as HTMLElement).closest(".pin, .spr")) onBarrioRef.current?.(name);
      });
      map.on("mouseenter", "barrios-fill", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "barrios-fill", () => { map.getCanvas().style.cursor = ""; });
      map.addLayer({ id: "barrios-line", type: "line", source: "barrios",
        paint: { "line-color": ["get", "color"], "line-width": ["case", ["get", "game"], 2.2, 0.7], "line-opacity": ["case", ["get", "game"], 0.9, 0.6] } });
      legs.forEach((l, i) => {
        map.addSource(`leg${i}`, { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: l.pts.map(ll) } } });
        map.addLayer({ id: `leg${i}`, type: "line", source: `leg${i}`, layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#ffffff", "line-width": 3.5, "line-opacity": 0.95, "line-dasharray": [2, 1.6] } }); // tu camino
      });
      map.addSource("chase", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "chase", type: "line", source: "chase", layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#e0524f", "line-width": 3, "line-opacity": 0.85, "line-dasharray": [2, 1.5] } });
    });
    map.fitBounds(bounds, { padding: 30, maxZoom: 14.5, animate: false });
    if (sprite) {
      mePrev.current = undefined;
      const meEl = spriteEl(sprite, { me: true, label: "Vos" });
      meEl.addEventListener("click", e => { e.stopPropagation(); onMeRef.current?.(); });
      me.current = new maplibregl.Marker({ element: meEl, anchor: "bottom" }).setLngLat([home.lng, home.lat]).addTo(map);
    }
    return () => { map.remove(); me.current = null; mapRef.current = null; markers.current.clear(); prev.current.clear(); pinMarks.current.clear(); };
  }, [data, place, mode, sprite, owners, homeName, homeKey, path ? path.length : 0, sat]);

  /* los lugares: pines con ícono; al tocarlos se abre lo que podés hacer ahí */
  const pinKey = (pins ?? []).map(p => `${p.id}|${p.color}|${p.icon}|${p.badge ?? ""}|${p.lat}|${p.lng}`).join(";");
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const mk of pinMarks.current.values()) mk.remove();
    pinMarks.current.clear();
    for (const p of pins ?? []) {
      const el = document.createElement("button");
      el.className = `pin${p.near ? " near" : ""}${p.deep ? " deep" : ""}`;
      el.style.setProperty("--pin", p.color);
      el.title = p.name;
      el.setAttribute("aria-label", p.name);
      el.innerHTML = `<img alt="" /><span class="pin-name"></span>${p.badge ? `<span class="pin-badge"></span>` : ""}`;
      (el.firstElementChild as HTMLImageElement).src = pinIcon(p.icon);
      (el.children[1] as HTMLElement).textContent = p.name;
      if (p.badge) (el.children[2] as HTMLElement).textContent = p.badge;
      el.addEventListener("click", e => { e.stopPropagation(); onPinRef.current?.(p.id); });
      pinMarks.current.set(p.id, new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([p.lng, p.lat]).addTo(map));
    }
  }, [pinKey, data, place, mode, sprite, owners, homeName, sat]);
  useEffect(() => {
    for (const [id, mk] of pinMarks.current) mk.getElement().classList.toggle("on", id === selected);
  }, [selected, pinKey]);

  /* acercarse a un barrio (al tocarlo, o al abrirlo desde otro lado) */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data || !focus) return;
    const f = data.barrios.features.find(x => x.properties.name === focus);
    if (!f) return;
    const b = new maplibregl.LngLatBounds();
    for (const poly of f.geometry.coordinates) for (const [lng, lat] of poly[0]) b.extend([lng, lat]);
    setFollow(false);
    const wide = map.getContainer().clientWidth > 820, tall = map.getContainer().clientHeight;
    map.fitBounds(b, { padding: wide ? { top: 70, bottom: 30, left: 560, right: 40 } : { top: 120, bottom: Math.round(tall * 0.6), left: 20, right: 20 }, maxZoom: 15.5, duration: 700 });
  }, [focus, data]);

  /* el camino por las cuadras cuando salís a buscar a alguien */
  const chasePath = self?.chase?.path ? JSON.stringify(self.chase.path) : "";
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const set = () => (map.getSource("chase") as maplibregl.GeoJSONSource | undefined)?.setData(chasePath
      ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: (JSON.parse(chasePath) as Pt[]).map(ll) } }
      : { type: "FeatureCollection", features: [] });
    if (map.isStyleLoaded()) set(); else map.once("load", set);
  }, [chasePath, data]);

  /* los demás en la calle: dónde van ahora; al tocarlos, quién es y si lo podés asaltar */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;
    const seen = new Set<number>();
    for (const o of others ?? []) {
      const pos = travelerPos(data.rutas, o, now);
      if (!pos) continue;
      seen.add(o.id);
      let mk = markers.current.get(o.id);
      if (!mk) {
        const el = spriteEl(spriteOf?.(o) ?? "", { me: o.id < 0, color: o.gang ? GANGS[o.gang].color : "#8a8070", label: o.id < 0 ? "Vos" : undefined });
        if (o.chase) el.classList.add("chasing");
        el.title = o.name;
        if (o.id >= 0) el.addEventListener("click", e => { e.stopPropagation(); openCard(map, o.id); });
        mk = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(ll(pos)).addTo(map);
        markers.current.set(o.id, mk);
      } else mk.setLngLat(ll(pos));
      face(mk.getElement(), prev.current.get(o.id), pos);
      prev.current.set(o.id, pos);
      if (o.id < 0 && followRef.current) map.easeTo({ center: ll(pos), duration: 900 });
    }
    for (const [id, mk] of markers.current) if (!seen.has(id)) { mk.remove(); markers.current.delete(id); prev.current.delete(id); }
  }, [data, others, now]);

  function openCard(map: maplibregl.Map, id: number) {
    const { others: list, now: t, attack: atk } = latest.current;
    const o = list?.find(x => x.id === id);
    const mk = markers.current.get(id);
    if (!o || !mk) return;
    setFollow(false);
    const el = document.createElement("div");
    el.className = "gps-card";
    const line = (cls: string, text: string) => { const d = document.createElement("div"); d.className = cls; d.textContent = text; el.appendChild(d); return d; };
    line("name", o.name);
    line("tag", `nivel ${o.lvl} · ${o.gang ? GANGS[o.gang].name : "suelto"}`);
    if (onProfileRef.current) {
      const prof = document.createElement("button");
      prof.className = "link";
      prof.textContent = "Ver perfil y agregar de amigo";
      prof.addEventListener("click", () => { popup.remove(); onProfileRef.current?.(o.id); });
      el.appendChild(prof);
    }
    if (o.chase) line("where", `Salió a buscar a ${o.chase.targetName}`);
    else if (o.trip) {
      const ph = tripPhase({ since: o.since, until: o.until, trip: { ...o.trip, ev: 0 } }, t);
      line("where", ph?.phase === "ida" ? `Va a ${o.trip.place} ${TRAVEL[o.trip.mode].verb}` : ph?.phase === "alla" ? `Está adentro, en ${o.trip.place}` : `Vuelve de ${o.trip.place} ${TRAVEL[o.trip.mode].verb}`);
    }
    if (atk && o.trip && data) {
      const why = atk.why(o);
      if (why) line("tag why", why);
      else {
        line("tag", `Salir a buscarlo (${DUEL_COST} de energía). Solo en la calle: si lo alcanzás, pelean donde se crucen.`);
        for (const m of chaseModes(atk.s)) {
          const plan = planChase(atk.s, data.rutas, { since: o.since, until: o.until, trip: o.trip }, t, m);
          const btn = document.createElement("button");
          btn.className = plan ? "primary" : "";
          btn.disabled = !plan || atk.s.gold < plan.cost;
          btn.textContent = plan ? `${CHASE_NAMES[m]} · lo cruzás en ~${Math.max(1, Math.round((plan.meet - t) / 60000))} min${plan.cost ? ` · ${money(plan.cost)}` : ""}`
                                 : `${CHASE_NAMES[m]} · no llegás`;
          btn.addEventListener("click", () => { popup.remove(); atk.go(o, m); });
          el.appendChild(btn);
        }
      }
    }
    /* el mapa se corre para que la tarjeta entre arriba de la persona */
    map.easeTo({ center: mk.getLngLat(), offset: [0, map.getContainer().clientHeight * 0.3], duration: 300 });
    const popup = new maplibregl.Popup({ offset: 40, closeButton: true, className: "gps-popup", maxWidth: "240px", anchor: "bottom" })
      .setLngLat(mk.getLngLat()).setDOMContent(el).addTo(map);
  }

  /* mover a tu personaje (y a la cámara, si te sigue) */
  useEffect(() => {
    if (!data || !me.current) return;
    const home = homeLL(), dest = place ? GEO_PLACES[place] : undefined, r = place ? data.rutas[homeName]?.[place] : undefined;
    let pos: Pt = [home.lat, home.lng];
    if (at && path && path.length > 1) pos = positionAt([{ pts: path, w: 1 }], at.back ? 1 - at.f : at.f); // por las cuadras
    else if (at && r && mode) pos = positionAt(legsFor(r, mode), at.back ? 1 - at.f : at.f);
    else if (at && dest && !at.back && at.f >= 1) pos = [dest.lat, dest.lng];
    me.current.setLngLat(ll(pos));
    face(me.current.getElement(), mePrev.current, pos);
    mePrev.current = pos;
    if (follow && mapRef.current) mapRef.current.easeTo({ center: ll(pos), duration: 900 });
  }, [data, place, mode, at?.back, at?.f, homeName, homeKey, follow]);

  const style = height ? { height } : undefined;
  if (failed) return <div className={`gps off ${className}`} style={style}><span className="tag">El mapa no cargó. El juego sigue igual.</span></div>;
  return <div className={`gps ${className}`} style={style}>
    <div className="gps-canvas" ref={box} />
    <button className={`gps-view ${sat ? "on" : ""}`} onClick={() => setSat(v => { saveSat(!v); return !v; })} aria-pressed={sat}
      title={sat ? "Ver el mapa de calles" : "Ver las imágenes satelitales"}>{sat ? "Mapa" : "Satélite"}</button>
    {(sprite || self) && <button className={`gps-follow ${follow ? "on" : ""}`} onClick={() => setFollow(f => !f)} aria-pressed={follow}
      title={follow ? "Dejar de seguir a tu personaje" : "Seguir a tu personaje"}>{follow ? "Siguiéndote" : "Seguirme"}</button>}
  </div>;
}
export default GpsMap;
