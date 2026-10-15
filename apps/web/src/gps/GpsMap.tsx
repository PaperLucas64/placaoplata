/* El GPS: mapa real (OpenStreetMap, servido gratis y sin clave por OpenFreeMap) con un estilo oscuro propio y sin los
   nombres reales de las calles: encima van los barrios de Maires. Muestra el recorrido de tu personaje y dónde está ahora.
   Los recorridos vienen de tools/geo/build.py; se cargan aparte para no pesar en la primera pantalla. */
import { useEffect, useRef, useState } from "react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  CHASE_NAMES, chaseModes, DUEL_COST, GANGS, GEO_HOME, GEO_PLACES, legsFor, money, planChase, positionAt, TRAVEL, travelerPos, tripPhase,
  type ChaseMode, type PlayerState, type Pt, type Rutas, type TravelMode
} from "@pop/shared";
import type { Traveler } from "../api";

let rutasCache: Promise<Rutas> | null = null;
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

const COLORS: Record<string, string> = { pie: "#e8e1d2", colectivo: "#f2c94c", taxi: "#f2c94c", micro: "#e6a14f", moto: "#e0524f", auto: "#e0524f", subte: "#5bc0de", tren: "#8bd17c" };

const ll = (p: Pt): [number, number] => [p[1], p[0]];

function labelEl(text: string, cls = "") {
  const el = document.createElement("div");
  el.className = `gps-label ${cls}`;
  el.innerHTML = `<span></span>`;
  el.firstElementChild!.textContent = text;
  return el;
}

interface Props {
  place?: string;            // destino del viaje (si hay)
  mode?: TravelMode;
  at?: { back: boolean; f: number } | null; // dónde va el personaje: ida o vuelta y fracción del tramo
  avatar?: string;           // retrato del personaje
  owners?: Record<string, string | null>;   // color de la pandilla dueña de cada barrio (mapa de la ciudad)
  others?: Traveler[];       // otros jugadores en una misión
  now?: number;
  avatarOf?: (n: number) => string;
  /* salir a buscar a alguien: quién sos, por qué no podés (o null) y qué hacer al elegir cómo ir */
  attack?: { s: PlayerState; why: (t: Traveler) => string | null; go: (t: Traveler, mode: ChaseMode) => void };
  height?: number;
}
export function GpsMap({ place, mode, at, avatar, owners, others, now = Date.now(), avatarOf, attack, height = 260 }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const me = useRef<maplibregl.Marker | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef(new Map<number, maplibregl.Marker>());
  const latest = useRef({ others, now, attack });
  latest.current = { others, now, attack };
  const [data, setData] = useState<{ rutas: Rutas; style: StyleSpecification } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    Promise.all([loadRutas(), loadStyle()]).then(([rutas, style]) => setData({ rutas, style })).catch(() => setFailed(true));
  }, []);

  /* armar el mapa y el recorrido */
  useEffect(() => {
    if (!box.current || !data) return;
    const home = GEO_PLACES[GEO_HOME];
    const map = new maplibregl.Map({
      container: box.current, style: data.style, center: [home.lng, home.lat], zoom: 12,
      attributionControl: { compact: true }, scrollZoom: false, dragRotate: false, pitchWithRotate: false
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;
    const bounds = new maplibregl.LngLatBounds([home.lng, home.lat], [home.lng, home.lat]);
    /* barrios de la ciudad (con el color de su dueño, si hay) y el conurbano; el interior solo si vas para allá */
    for (const [name, p] of Object.entries(GEO_PLACES)) {
      if (p.interior && name !== place) continue;
      const dot = document.createElement("div");
      const color = owners?.[name] ?? "#8a8070";
      dot.className = `gps-dot${owners ? " big" : ""}`;
      dot.style.background = color; dot.style.borderColor = color;
      new maplibregl.Marker({ element: dot }).setLngLat([p.lng, p.lat]).addTo(map);
      new maplibregl.Marker({ element: labelEl(name, name === place ? "dest" : name === GEO_HOME ? "home" : ""), anchor: "bottom", offset: [0, -6] })
        .setLngLat([p.lng, p.lat]).addTo(map);
      if (!place && !p.zone) bounds.extend([p.lng, p.lat]);
    }
    const r = place ? data.rutas[place] : undefined;
    const legs = r && mode ? legsFor(r, mode) : [];
    for (const l of legs) for (const p of l.pts) bounds.extend(ll(p));
    if (place && !legs.length && GEO_PLACES[place]) bounds.extend([GEO_PLACES[place].lng, GEO_PLACES[place].lat]);
    map.on("load", () => {
      legs.forEach((l, i) => {
        map.addSource(`leg${i}`, { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: l.pts.map(ll) } } });
        map.addLayer({ id: `leg${i}`, type: "line", source: `leg${i}`, layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": COLORS[l.kind] ?? "#f2c94c", "line-width": l.kind === "pie" ? 3 : 4, "line-opacity": 0.9,
            ...(l.kind === "pie" ? { "line-dasharray": [1, 2] } : {}) } });
      });
    });
    map.fitBounds(bounds, { padding: 30, maxZoom: 14.5, animate: false });
    if (avatar) {
      const el = document.createElement("div");
      el.className = "gps-me";
      el.innerHTML = `<img alt="" />`;
      (el.firstElementChild as HTMLImageElement).src = avatar;
      me.current = new maplibregl.Marker({ element: el }).setLngLat([home.lng, home.lat]).addTo(map);
    }
    return () => { map.remove(); me.current = null; mapRef.current = null; markers.current.clear(); };
  }, [data, place, mode, avatar, owners]);

  /* los otros jugadores en misión: dónde van ahora; al tocarlos, quién es y si lo podés asaltar */
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
        const el = document.createElement("div");
        el.className = o.id < 0 ? "gps-other me" : o.chase ? "gps-other chasing" : "gps-other";
        el.style.borderColor = o.gang ? GANGS[o.gang].color : "#8a8070";
        el.innerHTML = `<img alt="" />`;
        (el.firstElementChild as HTMLImageElement).src = avatarOf?.(o.avatar) ?? "";
        el.title = o.name;
        if (o.id >= 0) el.addEventListener("click", e => { e.stopPropagation(); openCard(map, o.id); });
        mk = new maplibregl.Marker({ element: el }).setLngLat(ll(pos)).addTo(map);
        markers.current.set(o.id, mk);
      } else mk.setLngLat(ll(pos));
    }
    for (const [id, mk] of markers.current) if (!seen.has(id)) { mk.remove(); markers.current.delete(id); }
  }, [data, others, now]);

  function openCard(map: maplibregl.Map, id: number) {
    const { others: list, now: t, attack: atk } = latest.current;
    const o = list?.find(x => x.id === id);
    const mk = markers.current.get(id);
    if (!o || !mk) return;
    const el = document.createElement("div");
    el.className = "gps-card";
    const line = (cls: string, text: string) => { const d = document.createElement("div"); d.className = cls; d.textContent = text; el.appendChild(d); return d; };
    line("name", o.name + (o.bot ? " · vecino" : ""));
    line("tag", `nivel ${o.lvl} · ${o.gang ? GANGS[o.gang].name : "suelto"}`);
    if (o.chase) line("where", `Salió a buscar a ${o.chase.targetName}`);
    else if (o.trip) {
      const ph = tripPhase({ since: o.since, until: o.until, trip: { ...o.trip, ev: 0 } }, t);
      line("where", ph?.phase === "ida" ? `Va a ${o.trip.place} ${TRAVEL[o.trip.mode].verb}` : ph?.phase === "alla" ? `Está en ${o.trip.place}` : `Vuelve de ${o.trip.place} ${TRAVEL[o.trip.mode].verb}`);
    }
    if (atk && o.trip && data) {
      const why = atk.why(o);
      if (why) line("tag why", why);
      else {
        line("tag", `Salir a buscarlo (${DUEL_COST} de energía). Si lo alcanzás, pelean donde se crucen:`);
        for (const m of chaseModes(atk.s)) {
          const plan = planChase(atk.s, data.rutas, { since: o.since, until: o.until, trip: o.trip }, t, m);
          const btn = document.createElement("button");
          btn.className = plan ? "primary" : "";
          btn.disabled = !plan || atk.s.gold < plan.cost;
          btn.textContent = plan ? `${CHASE_NAMES[m]} · lo cruzás en ${Math.max(1, Math.round((plan.meet - t) / 60000))} min${plan.cost ? ` · ${money(plan.cost)}` : ""}`
                                 : `${CHASE_NAMES[m]} · no llegás`;
          btn.addEventListener("click", () => { popup.remove(); atk.go(o, m); });
          el.appendChild(btn);
        }
      }
    }
    /* el mapa se corre para que la tarjeta entre arriba de la persona */
    map.easeTo({ center: mk.getLngLat(), offset: [0, map.getContainer().clientHeight * 0.3], duration: 300 });
    const popup = new maplibregl.Popup({ offset: 18, closeButton: true, className: "gps-popup", maxWidth: "240px", anchor: "bottom" })
      .setLngLat(mk.getLngLat()).setDOMContent(el).addTo(map);
  }

  /* mover al personaje */
  useEffect(() => {
    if (!data || !me.current) return;
    const home = GEO_PLACES[GEO_HOME], dest = place ? GEO_PLACES[place] : undefined, r = place ? data.rutas[place] : undefined;
    let pos: Pt = [home.lat, home.lng];
    if (at && r && mode) pos = positionAt(legsFor(r, mode), at.back ? 1 - at.f : at.f);
    else if (at && dest && !at.back && at.f >= 1) pos = [dest.lat, dest.lng];
    me.current.setLngLat(ll(pos));
  }, [data, place, mode, at?.back, at?.f]);

  if (failed) return <div className="gps off" style={{ height }}><span className="tag">El mapa no cargó. El viaje sigue igual.</span></div>;
  return <div className="gps" ref={box} style={{ height }} />;
}
export default GpsMap;
