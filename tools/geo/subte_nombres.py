"""Nombres de Maires para las estaciones de subte: python tools/geo/subte_nombres.py (después de subte.py)
Cada línea tiene su tema: A provincias, B animales autóctonos, C ríos famosos, D mares de Argentina,
E fechas patrias y H comidas. Guarda el nombre real en "real" y la línea en "line"."""
import json, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# en orden de punta a punta: estación real -> nombre de Maires
LINEAS = {
  "A": [("Plaza de Mayo", "Jujuy"), ("Perú", "Salta"), ("Piedras", "Formosa"), ("Lima", "Chaco"), ("Sáenz Peña", "Tucumán"),
        ("Congreso - Raúl Alfonsín", "Misiones"), ("Pasco", "Corrientes"), ("Alberti", "Catamarca"), ("Plaza Miserere", "Santiago del Estero"),
        ("Loria", "Santa Fe"), ("Castro Barros", "Entre Ríos"), ("Río de Janeiro", "La Rioja"), ("Acoyte", "Córdoba"),
        ("Primera Junta", "San Juan"), ("Puan", "Mendoza"), ("Carabobo", "San Luis"), ("San José de Flores", "Neuquén"),
        ("San Pedrito", "Tierra del Fuego")],
  "B": [("Leandro N. Alem", "Yaguareté"), ("Florida", "Carpincho"), ("Carlos Pellegrini", "Hornero"), ("Uruguay", "Ñandú"),
        ("Callao (B)", "Guanaco"), ("Pasteur - AMIA", "Vicuña"), ("Pueyrredón (B)", "Tatú Carreta"), ("Carlos Gardel", "Puma"),
        ("Medrano - Almagro", "Cóndor"), ("Ángel Gallardo", "Zorro Gris"), ("Malabia - Osvaldo Pugliese", "Oso Hormiguero"),
        ("Dorrego", "Pingüino"), ("Federico Lacroze", "Huemul"), ("Tronador - Villa Ortúzar", "Tero"), ("Los Incas - Parque Chas", "Mara"),
        ("Echeverría", "Yacaré"), ("Juan Manuel de Rosas", "Aguará Guazú")],
  "C": [("Retiro (C)", "Paraná"), ("General San Martín", "Amazonas"), ("Lavalle", "Nilo"), ("Diagonal Norte", "Danubio"),
        ("Avenida de Mayo", "Riachuelo")],
  "D": [("Catedral", "Mar Argentino"), ("9 de Julio", "Mar Dulce"), ("Tribunales - Teatro Colón", "Mar del Plata"),
        ("Callao (D)", "Mar Chiquita"), ("Facultad de Medicina", "Mar de Ajó"), ("Pueyrredón (D)", "Mar del Tuyú"),
        ("Agüero", "Mar de las Pampas"), ("Bulnes", "Mar Azul"), ("Scalabrini Ortiz", "Mar de Cobo"), ("Plaza Italia", "Mar del Sur"),
        ("Palermo", "Mar de Ansenuza"), ("Ministro Carranza", "Mar de Hoces"), ("Olleros", "Mar Austral"),
        ("José Hernández", "Santa Clara del Mar"), ("Juramento", "Mar Antártico"), ("Congreso de Tucumán", "Mar Patagónico")],
  "E": [("Retiro (E)", "25 de Mayo"), ("Catalinas", "9 de Julio"), ("Correo Central", "20 de Junio"), ("Bolívar", "17 de Agosto"),
        ("Belgrano", "2 de Abril"), ("José María Moreno", "24 de Marzo"), ("Varela", "20 de Noviembre"),
        ("Plaza de los Virreyes - Eva Perón", "1° de Mayo")],
  "H": [("Facultad de Derecho - Julieta Lanteri", "Milanesa"), ("Las Heras", "Empanada"), ("Santa Fe - Carlos Jáuregui", "Choripán"),
        ("Córdoba", "Locro"), ("Corrientes", "Dulce de Leche"), ("Once - 30 de Diciembre", "Alfajor"), ("Venezuela", "Mate Cocido")],
}

def main():
    path = os.path.join(ROOT, "packages", "shared", "data", "subte.json")
    est = json.load(open(path, encoding="utf-8"))
    by = {e.get("real", e["name"]): e for e in est}
    out = []
    for line, stops in LINEAS.items():
        for real, name in stops:
            e = by.pop(real, None)
            if not e: print("no está:", real); continue
            out.append({"name": name, "real": real, "line": line, "lat": e["lat"], "lng": e["lng"], "barrio": e["barrio"]})
    for real in by: print("sin nombre:", real)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("listo:", len(out), "estaciones")

if __name__ == "__main__":
    main()
