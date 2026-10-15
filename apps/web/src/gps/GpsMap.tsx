/* El GPS: mapa real (OpenStreetMap, servido gratis y sin clave por OpenFreeMap) con un estilo oscuro propio y sin los
   nombres reales de las calles: encima van los barrios de Maires. Muestra el recorrido de tu personaje y dónde está ahora.
   Los recorridos vienen de tools/geo/build.py; se cargan aparte para no pesar en la primera pantalla. */
import { useEffect, useRef, useState } from "react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { GEO_HOME, GEO_PLACES, type TravelMode } from "@pop/shared";

type Pt = [number, number]; // [lat, lng]
type Leg = { kind: "pie" | "subte" | "tren"; line?: string; pts: Pt[] };
export type Rutas = Record<string, { calle: Pt[]; pie?: Pt[]; riel?: Leg[] }>;

let rutasCache: Promise<Rutas> | null = null;
export const loadRutas = () => (rutasCache ??= import("./rutas.json").then(m => m.default as unknown as Rutas));

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

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * Math.cos(a[0] * Math.PI / 180));
/* punto a una fracción (por distancia) de una línea */
function along(pts: Pt[], f: number): Pt {
  if (pts.length < 2) return pts[0];
  const seg = pts.slice(1).map((p, i) => dist(pts[i], p));
  let goal = seg.reduce((a, b) => a + b, 0) * Math.min(1, Math.max(0, f));
  for (let i = 0; i < seg.length; i++) {
    if (goal <= seg[i]) { const t = seg[i] ? goal / seg[i] : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]; }
    goal -= seg[i];
  }
  return pts[pts.length - 1];
}
const kmOf = (pts: Pt[]) => pts.slice(1).reduce((a, p, i) => a + dist(pts[i], p) * 111.32, 0);

/* los tramos del viaje según el medio, con su peso en tiempo (para mover al personaje a la velocidad de cada tramo) */
export function legsFor(r: Rutas[string], mode: TravelMode): { kind: string; pts: Pt[]; w: number }[] {
  if (mode === "riel" && r.riel) return r.riel.map(l => {
    const km = kmOf(l.pts);
    return { kind: l.kind, pts: l.pts, w: l.kind === "pie" ? km / 5 : km / (l.kind === "subte" ? 30 : km > 50 ? 60 : 40) + 0.07 };
  });
  const pts = mode === "pie" && r.pie ? r.pie : r.calle;
  return [{ kind: mode, pts, w: 1 }];
}
/* dónde está el personaje: f = fracción del tiempo de la ida (0 a 1) */
export function positionAt(legs: { pts: Pt[]; w: number }[], f: number): Pt {
  const total = legs.reduce((a, l) => a + l.w, 0);
  let t = total * Math.min(1, Math.max(0, f));
  for (const l of legs) { if (t <= l.w) return along(l.pts, l.w ? t / l.w : 1); t -= l.w; }
  const last = legs[legs.length - 1].pts;
  return last[last.length - 1];
}

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
  height?: number;
}
export function GpsMap({ place, mode, at, avatar, owners, height = 260 }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const me = useRef<maplibregl.Marker | null>(null);
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
    const bounds = new maplibregl.LngLatBounds([home.lng, home.lat], [home.lng, home.lat]);
    /* barrios de la ciudad (con el color de su dueño, si hay) */
    for (const [name, p] of Object.entries(GEO_PLACES)) {
      if (p.interior && name !== place) continue;
      const dot = document.createElement("div");
      const color = owners?.[name] ?? "#8a8070";
      dot.className = `gps-dot${owners ? " big" : ""}`;
      dot.style.background = color; dot.style.borderColor = color;
      new maplibregl.Marker({ element: dot }).setLngLat([p.lng, p.lat]).addTo(map);
      new maplibregl.Marker({ element: labelEl(name, name === place ? "dest" : name === GEO_HOME ? "home" : ""), anchor: "bottom", offset: [0, -6] })
        .setLngLat([p.lng, p.lat]).addTo(map);
      if (!place) bounds.extend([p.lng, p.lat]);
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
    return () => { map.remove(); me.current = null; };
  }, [data, place, mode, avatar, owners]);

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
