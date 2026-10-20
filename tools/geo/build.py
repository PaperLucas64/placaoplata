"""Arma los recorridos del GPS de Buenos Aires con datos reales de OpenStreetMap.

Se corre a mano una vez (o cuando se agregan lugares):  python tools/geo/build.py
- Calles y veredas: OSRM de routing.openstreetmap.de (perfiles car y foot).
- Subte y trenes: vías reales (railway=subway / rail) bajadas de Overpass; se busca el camino más corto por las vías
  entre las dos estaciones.
Las respuestas quedan en tools/geo/cache/ para no volver a pedirlas.

Retiro:
- packages/shared/src/geo-data.ts  lugares, distancias y tramos (lo usan el servidor y las reglas para los tiempos)
- packages/shared/data/rutas.json  el dibujo de cada recorrido (la pantalla para el GPS y el servidor para los cruces)

Datos © colaboradores de OpenStreetMap (ODbL).
"""
import hashlib, heapq, json, math, os, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(ROOT, "tools", "geo", "cache")
UA = "Buenos AiresGameBuild/1.0 (juego de navegador; build offline, una vez)"
os.makedirs(CACHE, exist_ok=True)

# ---------- lugares: barrio del juego -> lugar real (lat, lng) ----------
HOME = "San Telmo"  # la pensión de Marga, arriba del bar La Esquina
PLACES = {
    "La Boca":      (-34.6345, -58.3631, "La Boca"),
    "Puerto Madero":   (-34.6110, -58.3630, "Puerto Madero"),
    "San Telmo":     (-34.6215, -58.3725, "San Telmo"),
    "Palermo":   (-34.5885, -58.4300, "Palermo Soho"),
    "Villa Crespo":   (-34.5990, -58.4380, "Villa Crespo"),
    "Barrancas":      (-34.6450, -58.3820, "Barracas"),
    "Florida":  (-34.5290, -58.4900, "Florida, Vicente López"),
    "Balvanera":   (-34.6090, -58.4060, "Once"),
    "Mataderos":      (-34.6560, -58.5020, "Mataderos"),
    "Recoleta":  (-34.5880, -58.3930, "Recoleta"),
    "Liniers":    (-34.6430, -58.5200, "Liniers"),
    "Nueva Pompeya":  (-34.6500, -58.4150, "Nueva Pompeya"),
    # el conurbano: zona norte, sur y oeste
    "Tigre":        (-34.4255, -58.5797, "Tigre"),
    "San Isidro":         (-34.4720, -58.5130, "San Isidro"),
    "Pilar":        (-34.4586, -58.9142, "Pilar"),
    "Avellaneda":          (-34.6620, -58.3650, "Avellaneda"),
    "Lomas de Zamora":(-34.7610, -58.4060, "Lomas de Zamora"),
    "Quilmes":           (-34.7206, -58.2546, "Quilmes"),
    "Morón":             (-34.6534, -58.6198, "Morón"),
    "La Matanza":        (-34.6826, -58.5604, "San Justo, La Matanza"),
    "Moreno":    (-34.6500, -58.7900, "Moreno"),
    # el interior
    "La Plata": (-34.9210, -57.9550, "La Plata"),
    "Rosario":       (-32.9440, -60.6500, "Rosario"),
    "Mar del Plata":  (-38.0020, -57.5560, "Mar del Plata"),
    "Córdoba":      (-31.4170, -64.1830, "Córdoba"),
}
# casas que se pueden comprar: desde cada una salen los viajes (subte y tren, solo desde la pensión)
ORIGINS = ["San Telmo", "Balvanera", "Villa Crespo", "Barrancas", "San Isidro", "Recoleta"]
INTERIOR = {"La Plata", "Rosario", "Mar del Plata", "Córdoba"}
ZONE = {"Tigre": "norte", "San Isidro": "norte", "Pilar": "norte",
        "Avellaneda": "sur", "Lomas de Zamora": "sur", "Quilmes": "sur",
        "Morón": "oeste", "La Matanza": "oeste", "Moreno": "oeste"}

# estaciones reales (aproximadas a la boca de la estación)
ST = {
    "San Juan (C)":         (-34.6222, -58.3800),
    "Constitución":         (-34.6277, -58.3810),
    "Retiro":               (-34.5912, -58.3747),
    "Diagonal Norte (C)":   (-34.6047, -58.3795),
    "Avenida de Mayo (C)":  (-34.6090, -58.3806),
    "Carlos Pellegrini (B)":(-34.6036, -58.3809),
    "9 de Julio (D)":       (-34.6045, -58.3807),
    "Lima (A)":             (-34.6091, -58.3826),
    "Plaza Miserere (A)":   (-34.6097, -58.4067),
    "Pueyrredón (D)":       (-34.5947, -58.4053),
    "Plaza Italia (D)":     (-34.5810, -58.4211),
    "Malabia (B)":          (-34.5989, -58.4321),
    "Once":                 (-34.6087, -58.4078),
    "Liniers":              (-34.6409, -58.5282),
    "Florida (Mitre)":      (-34.5310, -58.4901),
    "La Plata":             (-34.9045, -57.9506),
    "Mar del Plata":        (-37.9966, -57.5598),
    "Rosario Norte":        (-32.9294, -60.6569),
    "Córdoba (Mitre)":      (-31.4128, -64.1747),
    "Tigre (Mitre)":        (-34.4229, -58.5797),
    "San Isidro (Mitre)":   (-34.4716, -58.5097),
    "Pilar (San Martín)":   (-34.4590, -58.9140),
    "Avellaneda (Roca)":    (-34.6626, -58.3670),
    "Lomas de Zamora (Roca)": (-34.7608, -58.4039),
    "Quilmes (Roca)":       (-34.7240, -58.2590),
    "Morón (Sarmiento)":    (-34.6510, -58.6220),
    "Moreno (Sarmiento)":   (-34.6497, -58.7896),
}
# combinaciones de subte y tren desde la pensión: (tipo, línea, desde, hasta)
RAIL = {
    "Balvanera":   [("subte", "C", "San Juan (C)", "Avenida de Mayo (C)"), ("subte", "A", "Lima (A)", "Plaza Miserere (A)")],
    "Recoleta":  [("subte", "C", "San Juan (C)", "Diagonal Norte (C)"), ("subte", "D", "9 de Julio (D)", "Pueyrredón (D)")],
    "Palermo":   [("subte", "C", "San Juan (C)", "Diagonal Norte (C)"), ("subte", "D", "9 de Julio (D)", "Plaza Italia (D)")],
    "Villa Crespo":   [("subte", "C", "San Juan (C)", "Diagonal Norte (C)"), ("subte", "B", "Carlos Pellegrini (B)", "Malabia (B)")],
    "Florida":  [("subte", "C", "San Juan (C)", "Retiro"), ("tren", "Mitre", "Retiro", "Florida (Mitre)")],
    "Liniers":    [("subte", "C", "San Juan (C)", "Avenida de Mayo (C)"), ("subte", "A", "Lima (A)", "Plaza Miserere (A)"),
                       ("tren", "Sarmiento", "Once", "Liniers")],
    "La Plata": [("tren", "Roca", "Constitución", "La Plata")],
    "Tigre":   [("subte", "C", "San Juan (C)", "Retiro"), ("tren", "Mitre", "Retiro", "Tigre (Mitre)")],
    "San Isidro":    [("subte", "C", "San Juan (C)", "Retiro"), ("tren", "Mitre", "Retiro", "San Isidro (Mitre)")],
    "Pilar":   [("subte", "C", "San Juan (C)", "Retiro"), ("tren", "San Martín", "Retiro", "Pilar (San Martín)")],
    "Avellaneda":     [("tren", "Roca", "Constitución", "Avellaneda (Roca)")],
    "Lomas de Zamora": [("tren", "Roca", "Constitución", "Lomas de Zamora (Roca)")],
    "Quilmes":      [("tren", "Roca", "Constitución", "Quilmes (Roca)")],
    "Morón":        [("subte", "C", "San Juan (C)", "Avenida de Mayo (C)"), ("subte", "A", "Lima (A)", "Plaza Miserere (A)"),
                       ("tren", "Sarmiento", "Once", "Morón (Sarmiento)")],
    "Moreno": [("subte", "C", "San Juan (C)", "Avenida de Mayo (C)"), ("subte", "A", "Lima (A)", "Plaza Miserere (A)"),
                       ("tren", "Sarmiento", "Once", "Moreno (Sarmiento)")],
    "Mar del Plata":  [("tren", "Roca", "Constitución", "Mar del Plata")],
    "Rosario":       [("subte", "C", "San Juan (C)", "Retiro"), ("tren", "Mitre", "Retiro", "Rosario Norte")],
    "Córdoba":      [("subte", "C", "San Juan (C)", "Retiro"), ("tren", "Mitre", "Retiro", "Córdoba (Mitre)")],
}

# ---------- utilidades ----------
def hav(a, b):
    R = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))

def length(pts):
    return sum(hav(pts[i], pts[i + 1]) for i in range(len(pts) - 1))

def simplify(pts, tol_km):
    """Ramer-Douglas-Peucker en coordenadas planas aproximadas."""
    if len(pts) < 3: return pts
    k = math.cos(math.radians(pts[0][0]))
    P = [(p[0] * 111.32, p[1] * 111.32 * k) for p in pts]
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        ax, ay = P[i]; bx, by = P[j]; dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy
        best, bi = -1, -1
        for m in range(i + 1, j):
            px, py = P[m]
            t = 0 if L == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L))
            d = math.hypot(px - ax - t * dx, py - ay - t * dy)
            if d > best: best, bi = d, m
        if best > tol_km:
            keep[bi] = True; stack += [(i, bi), (bi, j)]
    return [p for p, k2 in zip(pts, keep) if k2]

def fetch(url, data=None, tries=7):
    key = hashlib.sha1((url + (data or "")).encode()).hexdigest()[:16]
    path = os.path.join(CACHE, key + ".json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f: return json.load(f)
    wait = 10
    for n in range(tries):
        try:
            req = urllib.request.Request(url, data=data.encode() if data else None, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=180) as r: body = json.loads(r.read().decode())
            with open(path, "w", encoding="utf-8") as f: json.dump(body, f)
            time.sleep(1.5)  # ser amables con los servidores públicos
            return body
        except Exception as e:
            print(f"  ({n + 1}/{tries}) falló {url[:70]}…: {e}; reintento en {wait}s", flush=True)
            time.sleep(wait); wait = min(wait * 2, 300)
    raise RuntimeError("no hubo caso: " + url)

def osrm(profile, a, b):
    url = (f"https://routing.openstreetmap.de/routed-{profile}/route/v1/driving/"
           f"{a[1]},{a[0]};{b[1]},{b[0]}?overview=full&geometries=geojson")
    r = fetch(url)
    return [(c[1], c[0]) for c in r["routes"][0]["geometry"]["coordinates"]]

OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter",
            "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
def overpass(q):
    last = None
    for url in OVERPASS:
        try: return fetch(url, "data=" + urllib.parse.quote(q), tries=4)
        except RuntimeError as e: last = e
    raise last

def rail_path(kind, a, b):
    """Camino más corto por las vías entre dos estaciones (Dijkstra sobre las vías de OSM del área)."""
    pad = 0.05 if kind == "subte" else 0.25
    s, w, n, e = min(a[0], b[0]) - pad, min(a[1], b[1]) - pad, max(a[0], b[0]) + pad, max(a[1], b[1]) + pad
    tag = 'railway"="subway' if kind == "subte" else 'railway"="rail'
    q = f'[out:json][timeout:170];way["{tag}"]["service"!~"."]({s:.3f},{w:.3f},{n:.3f},{e:.3f});out geom qt;'
    data = overpass(q)
    coord, adj = {}, {}
    for el in data["elements"]:
        ns, gs = el.get("nodes"), el.get("geometry")
        if not ns or not gs: continue
        for i, (nid, g) in enumerate(zip(ns, gs)):
            coord[nid] = (g["lat"], g["lon"])
            if i:
                p = ns[i - 1]; d = hav(coord[p], coord[nid])
                adj.setdefault(p, []).append((nid, d)); adj.setdefault(nid, []).append((p, d))
    if not coord: raise RuntimeError("sin vías")
    # unir puntas de vías que casi se tocan (los cambios de vía no siempre comparten nodo)
    grid = {}
    for k, (la, lo) in coord.items(): grid.setdefault((int(la / 0.0004), int(lo / 0.0004)), []).append(k)
    for (gx, gy), ks in grid.items():
        near_ks = [k2 for dx in (-1, 0, 1) for dy in (-1, 0, 1) for k2 in grid.get((gx + dx, gy + dy), [])]
        for k in ks:
            for k2 in near_ks:
                if k < k2:
                    d = hav(coord[k], coord[k2])
                    if d < 0.025: adj.setdefault(k, []).append((k2, d)); adj.setdefault(k2, []).append((k, d))
    # varias puntas posibles cerca de cada estación (puede haber otra línea más cerca)
    def cands(pt):
        c = [k for k in coord if hav(coord[k], pt) < 0.35]
        return c or [min(coord, key=lambda k: hav(coord[k], pt))]
    dist, prev, pq = {}, {}, []
    for k in cands(a):
        dist[k] = 2 * hav(coord[k], a); heapq.heappush(pq, (dist[k], k))
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist.get(u, 1e18): continue
        for v, wd in adj.get(u, []):
            nd = d + wd
            if nd < dist.get(v, 1e18): dist[v] = nd; prev[v] = u; heapq.heappush(pq, (nd, v))
    ends = [k for k in cands(b) if k in dist]
    if not ends: raise RuntimeError("las estaciones no están unidas por vías")
    dst = min(ends, key=lambda k: dist[k] + 2 * hav(coord[k], b))
    path, u = [], dst
    while u in prev: path.append(coord[u]); u = prev[u]
    path.append(coord[u]); path.reverse()
    return [a] + path + [b]

def rnd(pts): return [[round(p[0], 5), round(p[1], 5)] for p in pts]

# ---------- armado ----------
def routes_from(origin):
    home = PLACES[origin][:2]
    shared, web = {}, {}
    for name, (lat, lng, real) in PLACES.items():
        if name == origin: continue
        print("·", origin, "→", name, flush=True)
        far = name in INTERIOR
        tol = 0.25 if far else 0.012
        car = osrm("car", home, (lat, lng))
        entry = {"calle": round(length(car), 2)}
        geo = {"calle": rnd(simplify(car, tol))}
        if not far and hav(home, (lat, lng)) < 20:
            foot = osrm("foot", home, (lat, lng))
            entry["pie"] = round(length(foot), 2); geo["pie"] = rnd(simplify(foot, tol))
        if origin == HOME and name in RAIL:
            legs, glegs, here = [], [], home
            for kind, line, fr, to in RAIL[name]:
                a, b = ST[fr], ST[to]
                if hav(here, a) > 0.05:
                    w = osrm("foot", here, a)
                    legs.append({"kind": "pie", "km": round(length(w), 2)}); glegs.append({"kind": "pie", "pts": rnd(simplify(w, 0.012))})
                try: r = rail_path(kind, a, b)
                except Exception as e:
                    print(f"  sin vías para {line} {fr}→{to} ({e}); va en línea recta", flush=True); r = [a, b]
                legs.append({"kind": kind, "line": line, "from": fr, "to": to, "km": round(length(r), 2)})
                glegs.append({"kind": kind, "line": line, "pts": rnd(simplify(r, 0.25 if kind == "tren" and far else 0.015))})
                here = b
            w = osrm("foot", here, (lat, lng))
            legs.append({"kind": "pie", "km": round(length(w), 2)}); glegs.append({"kind": "pie", "pts": rnd(simplify(w, 0.012))})
            entry["riel"] = legs; geo["riel"] = glegs
        shared[name] = entry; web[name] = geo
    return shared, web

def main():
    shared, web = {}, {}
    for o in ORIGINS:
        shared[o], web[o] = routes_from(o)

    places = {k: {"lat": v[0], "lng": v[1], "real": v[2], **({"interior": True} if k in INTERIOR else {}), **({"zone": ZONE[k]} if k in ZONE else {})}
              for k, v in PLACES.items()}
    ts = ("/* Generado por tools/geo/build.py con datos de OpenStreetMap (© colaboradores de OSM, ODbL). No editar a mano. */\n"
          "import type { GeoPlace, GeoRoute } from \"./geo.js\";\n\n"
          f"export const GEO_HOME = {json.dumps(HOME, ensure_ascii=False)};\n"
          f"export const GEO_PLACES: Record<string, GeoPlace> = {json.dumps(places, ensure_ascii=False)};\n"
          f"export const GEO_ROUTES: Record<string, Record<string, GeoRoute>> = {json.dumps(shared, ensure_ascii=False)};\n")
    with open(os.path.join(ROOT, "packages", "shared", "src", "geo-data.ts"), "w", encoding="utf-8") as f: f.write(ts)
    out = os.path.join(ROOT, "packages", "shared", "data"); os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "rutas.json"), "w", encoding="utf-8") as f: json.dump(web, f, ensure_ascii=False, separators=(",", ":"))
    print("listo:", sum(len(json.dumps(v)) for v in web.values()) // 1024, "KB de recorridos", flush=True)

if __name__ == "__main__":
    main()
