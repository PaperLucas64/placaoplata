"""El mapa de Maires: Capital, del sur de la autopista 25 de Mayo y la Perito Moreno hacia el norte, hasta la General Paz
y el río (con la Reserva y Aeroparque). Los barrios oficiales de la Ciudad con su nombre de parodia.

    python tools/geo/capital.py

Salen:
- packages/shared/data/barrios.json  contornos (los del juego, y el resto de la Ciudad para dibujar tenue)
- packages/shared/src/geo-data.ts    lugares (centro de cada barrio). Los recorridos se calculan en el momento (OSRM).
Datos: Gobierno de la Ciudad de Buenos Aires (CC BY 2.5 AR).
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from build import fetch, simplify, ROOT

CABA = "https://cdn.buenosaires.gob.ar/datosabiertos/datasets/ministerio-de-educacion/barrios/barrios.geojson"
# barrio real -> nombre en Maires (los que quedan adentro de los límites)
GAME = {
    "Agronomia": "Agromanía", "Almagro": "Almagrito", "Balvanera": "Once y Medio", "Belgrano": "Belgranito",
    "Caballito": "Caballote", "Chacarita": "Chacarota", "Coghlan": "Coglán", "Colegiales": "Colegas",
    "Flores": "Floreros", "Floresta": "Florestita", "Liniers": "Liniers Sur", "Monserrat": "Mosecraft",
    "Monte Castro": "Monte Castrito", "Nuñez": "Ñuñez", "Palermo": "Palermo Soja", "Parque Chas": "Parque Chau",
    "Paternal": "La Paterna", "Puerto Madero": "Puerto Mareo", "Recoleta": "Reloquita", "Retiro": "Salida",
    "Saavedra": "Saavedrita", "San Nicolas": "San Nicolasito", "Velez Sarsfield": "Vélez Sarsfeel",
    "Versalles": "Versalles Chico", "Villa Crespo": "Villa Crespa", "Villa Del Parque": "Villa del Charque",
    "Villa Devoto": "Villa Devota", "Villa Gral. Mitre": "Villa Mitrecito", "Villa Luro": "Villa Lurio",
    "Villa Ortuzar": "Villa Ortuzán", "Villa Pueyrredon": "Villa Puerredón", "Villa Real": "Villa Realeza",
    "Villa Santa Rita": "Villa Santa Rata", "Villa Urquiza": "Villa Urquisa"
}
DEFAULT_HOME = "Almagrito"

def centroid(ring):
    """centro de un polígono (fórmula del área); ring en [lng, lat]"""
    a = cx = cy = 0.0
    for i in range(len(ring) - 1):
        x0, y0 = ring[i]; x1, y1 = ring[i + 1]
        f = x0 * y1 - x1 * y0
        a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f
    a *= 0.5
    return (cy / (6 * a), cx / (6 * a)) if a else (ring[0][1], ring[0][0])

def main():
    data = fetch(CABA)
    feats, places = [], {}
    for f in data["features"]:
        real = f["properties"]["nombre"]
        polys = f["geometry"]["coordinates"] if f["geometry"]["type"] == "MultiPolygon" else [f["geometry"]["coordinates"]]
        rings, biggest = [], None
        for poly in polys:
            ring = [(c[1], c[0]) for c in poly[0]]
            r = simplify(ring, 0.010)
            if len(r) < 4: continue
            rr = [[round(p[1], 5), round(p[0], 5)] for p in r]
            rings.append([rr])
            if biggest is None or len(poly[0]) > len(biggest): biggest = poly[0]
        name = GAME.get(real, real)
        feats.append({"type": "Feature", "properties": {"name": name, "game": real in GAME}, "geometry": {"type": "MultiPolygon", "coordinates": rings}})
        if real in GAME:
            lat, lng = centroid(biggest)
            places[name] = {"lat": round(lat, 5), "lng": round(lng, 5), "real": real}
    with open(os.path.join(ROOT, "packages", "shared", "data", "barrios.json"), "w", encoding="utf-8") as fh:
        json.dump({"type": "FeatureCollection", "features": feats}, fh, ensure_ascii=False, separators=(",", ":"))
    ts = ("/* Generado por tools/geo/capital.py con los barrios de la Ciudad (GCBA, CC BY 2.5 AR). No editar a mano.\n"
          "   Los recorridos se calculan en el momento por las cuadras (OSRM); GEO_ROUTES queda para recorridos guardados. */\n"
          "import type { GeoPlace, GeoRoute } from \"./geo.js\";\n\n"
          f"export const GEO_HOME = {json.dumps(DEFAULT_HOME, ensure_ascii=False)};\n"
          f"export const GEO_PLACES: Record<string, GeoPlace> = {json.dumps(places, ensure_ascii=False)};\n"
          "export const GEO_ROUTES: Record<string, Record<string, GeoRoute>> = {};\n")
    with open(os.path.join(ROOT, "packages", "shared", "src", "geo-data.ts"), "w", encoding="utf-8") as fh: fh.write(ts)
    with open(os.path.join(ROOT, "packages", "shared", "data", "rutas.json"), "w", encoding="utf-8") as fh: fh.write("{}")
    print("listo:", len(places), "barrios del juego,", len(feats), "contornos")

if __name__ == "__main__":
    main()
