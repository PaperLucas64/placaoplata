"""Estaciones de subte de Capital (OpenStreetMap, ODbL): python tools/geo/subte.py
Sale packages/shared/data/subte.json: [{name, lines, lat, lng, barrio}] solo las que caen adentro de los barrios de Maires."""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from build import overpass, ROOT

def inside(pt, ring):  # punto en polígono (ring en [lng, lat])
    x, y = pt[1], pt[0]; ok = False
    for i in range(len(ring) - 1):
        x0, y0 = ring[i]; x1, y1 = ring[i + 1]
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0: ok = not ok
    return ok

def main():
    q = '[out:json][timeout:120];(node["railway"="station"]["station"="subway"](-34.70,-58.53,-34.53,-58.33);node["railway"="station"]["subway"="yes"](-34.70,-58.53,-34.53,-58.33););out body;'
    els = overpass(q)["elements"]
    barrios = json.load(open(os.path.join(ROOT, "packages", "shared", "data", "barrios.json"), encoding="utf-8"))["features"]
    out, seen = [], set()
    for e in els:
        name = e.get("tags", {}).get("name")
        if not name or name in seen: continue
        pt = (e["lat"], e["lon"])
        b = next((f["properties"]["name"] for f in barrios if f["properties"]["game"]
                  and any(inside(pt, poly[0]) for poly in f["geometry"]["coordinates"])), None)
        if not b: continue
        seen.add(name)
        lines = e["tags"].get("line") or e["tags"].get("ref") or ""
        out.append({"name": name, "lines": lines, "lat": round(pt[0], 5), "lng": round(pt[1], 5), "barrio": b})
    with open(os.path.join(ROOT, "packages", "shared", "data", "subte.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("listo:", len(out), "estaciones")

if __name__ == "__main__":
    main()
