# Créditos del arte

Maires es un juego de **Mauspi Lab**. El arte de terceros se usa según la licencia de cada pack.
En este repo hay **solo versiones procesadas** (recortadas, con filtro nocturno, comprimidas), nunca los archivos originales,
porque varias licencias no permiten redistribuirlos sueltos. Se generan con `tools/assets/build.py`.
También se muestran en el juego (botón **Créditos**, al lado de la crónica).

| Qué | Autor | Licencia | Dónde se usa |
|---|---|---|---|
| Fondos (packs 1, 2 y Old) | **Noraneko Games** (@NoranekoGames) | Uso en juegos con crédito; se permite modificar; no se puede vender el pack ni redistribuirlo suelto | Escenas de cada pestaña y tarjetas de Marga y los bandos (`assets/fondos`) |
| Retratos y siluetas | **わたおきば / Wataokiba** (わたおび) | Uso libre comercial y no comercial; se permite recortar y cambiar colores; prohibido redistribuir o vender el material o decir que es propio | Marga, Ríos, los cuatro jefes de pandilla, el Gallego, Don Tito, avatares y siluetas (`assets/retratos`, `assets/siluetas`) |
| Armas de fuego en pixel art | **arlantr** (arlantr.itch.io) | "Free to use any way you want" | Pistola, escopetas y fusil (`assets/iconos/arma_*`) |
| Íconos (cuchillo, escudo, llave, auto, etc.) | **Prinbles** (prinbles.itch.io) y **Robert Brooks / gamedeveloperstudio.com** | Uso en proyectos personales y comerciales; no se pueden revender ni redistribuir | `assets/iconos` |
| Íconos de tonfa, bate, chalecos, campera, casco, botiquín, taser, manopla | Mauspi Lab | Propio | `apps/web/src/icons.tsx` |

Si se agrega arte nuevo: anotar acá el pack, el autor y la licencia, y sumarlo a los créditos del juego
(`Credits` en `apps/web/src/parts.tsx`).

## Mapa y recorridos (GPS)

- **Datos del mapa y de los recorridos:** © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright),
  bajo la licencia ODbL. Los recorridos de `packages/shared/src/geo-data.ts` y `apps/web/src/gps/rutas.json` se calcularon
  con `tools/geo/build.py` usando OSRM (routing.openstreetmap.de) y Overpass.
- **Teselas:** [OpenFreeMap](https://openfreemap.org) (gratis, sin clave) con datos de [OpenMapTiles](https://openmaptiles.org).
  El estilo oscuro sale de «positron», recoloreado y sin los nombres reales.
- **Motor del mapa:** [MapLibre GL JS](https://maplibre.org) (licencia BSD-3).

## Personajes del mapa

- **Personajes caminando (estilo RPG Maker MV):** «ゆうひな素材» (Yuhina) de 明石アカ. Se usan dentro del juego; según sus
  condiciones no se pueden redistribuir sueltos (ni modificados), por eso el repositorio tiene que ser privado.
- **Vista satélite:** Esri World Imagery (imágenes © Esri, Maxar, Earthstar Geographics). Para producción, Esri pide una
  cuenta gratis de ArcGIS Location Platform: su clave va en la variable `VITE_ESRI_KEY` del build (si no está, se usa sin clave).

## Íconos de los lugares del mapa

- **Noto Emoji** de Google (licencia Apache 2.0), en `apps/web/src/assets/lugares/`: los íconos de colores de los lugares.
  Son provisorios, hasta tener los propios.
- **Contornos de los barrios:** datos abiertos del Gobierno de la Ciudad de Buenos Aires (licencia CC BY 2.5 AR) y, para
  Florida, OpenStreetMap (ODbL). Se generan con `tools/geo/barrios.py`.
