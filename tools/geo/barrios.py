"""Contornos de los barrios para el mapa: python tools/geo/barrios.py

- Barrios de la Ciudad: datos abiertos del Gobierno de la Ciudad de Buenos Aires (licencia CC BY 2.5 AR).
- Florida (Vicente López): límite de OpenStreetMap (ODbL), vía Overpass.
Sale packages/shared/data/barrios.json: GeoJSON con los barrios del juego (con su nombre de Buenos Aires) y el resto, para dibujar.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from build import fetch, overpass, simplify, ROOT  # mismas utilidades y caché que los recorridos

CABA = "https://cdn.buenosaires.gob.ar/datosabiertos/datasets/ministerio-de-educacion/barrios/barrios.geojson"
# barrio real -> barrio de Buenos Aires
GAME = {"La Boca": "La Boca", "Puerto Madero": "Puerto Madero", "San Telmo": "San Telmo", "Palermo": "Palermo",
        "Villa Crespo": "Villa Crespo", "Barracas": "Barrancas", "Balvanera": "Balvanera", "Mataderos": "Mataderos",
        "Recoleta": "Recoleta", "Liniers": "Liniers", "Nueva Pompeya": "Nueva Pompeya"}

def rings_of(geom):
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    out = []
    for poly in polys:
        ring = [(c[1], c[0]) for c in poly[0]]                    # solo el borde de afuera
        r = simplify(ring, 0.012)
        if len(r) >= 4: out.append([[round(p[1], 5), round(p[0], 5)] for p in r])
    return out

def main():
    data = fetch(CABA)
    feats = []
    for f in data["features"]:
        real = f["properties"]["nombre"]
        feats.append({"type": "Feature", "properties": {"name": GAME.get(real, real), "game": real in GAME},
                      "geometry": {"type": "MultiPolygon", "coordinates": [[r] for r in rings_of(f["geometry"])]}})
    # Florida (Vicente López), desde OpenStreetMap
    try:
        q = '[out:json][timeout:90];relation["boundary"="administrative"]["name"="Florida"](-34.56,-58.53,-34.50,-58.46);out geom;'
        rel = [e for e in overpass(q)["elements"] if e["type"] == "relation"][0]
        ways = [[(g["lat"], g["lon"]) for g in m["geometry"]] for m in rel["members"] if m.get("role") == "outer" and m.get("geometry")]
        ring = ways[0]
        rest = ways[1:]
        while rest:  # unir los tramos del borde en un solo anillo
            end = ring[-1]
            k = min(range(len(rest)), key=lambda i: min(abs(rest[i][0][0] - end[0]) + abs(rest[i][0][1] - end[1]), abs(rest[i][-1][0] - end[0]) + abs(rest[i][-1][1] - end[1])))
            w = rest.pop(k)
            if abs(w[-1][0] - end[0]) + abs(w[-1][1] - end[1]) < abs(w[0][0] - end[0]) + abs(w[0][1] - end[1]): w = w[::-1]
            ring += w
        r = simplify(ring + [ring[0]], 0.012)
        feats.append({"type": "Feature", "properties": {"name": "Florida", "game": True},
                      "geometry": {"type": "MultiPolygon", "coordinates": [[[[round(p[1], 5), round(p[0], 5)] for p in r]]]}})
    except Exception as e:
        print("sin Florida:", e)
    out = os.path.join(ROOT, "packages", "shared", "data", "barrios.json")
    with open(out, "w", encoding="utf-8") as f: json.dump({"type": "FeatureCollection", "features": feats}, f, ensure_ascii=False, separators=(",", ":"))
    print("listo:", len(feats), "barrios,", os.path.getsize(out) // 1024, "KB")

if __name__ == "__main__":
    main()
