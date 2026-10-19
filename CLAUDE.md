# CLAUDE.md — contexto para Claude

Lo que hay que saber para trabajar en este repo. El detalle está en `README.md`, `docs/GDD.md`, `docs/HISTORIA.md`,
`docs/BALANCE.md` y `docs/AUDITORIA.md`; esto es el resumen y las reglas de la casa.

## Qué es

- **Malandro**: juego de navegador estilo BiteFight, de Mauspi Lab (Lucas). Pasa en **Maires**, parodia de Buenos Aires.
  - El repo se llama `placaoplata` por el nombre viejo («Placa o Plata»). No renombrar sin preguntar.
- **Equipo:** Lucas (dueño, `PaperLucas64`) y Tomi, su amigo y colaborador.
  - Tomi hizo la auditoría de `docs/AUDITORIA.md`.
  - Cuando un commit sale de algo que hizo él, se agrega `Co-Authored-By: Tomi <freue.tomas@hotmail.com>`.
- **Idioma:** todo el juego y las respuestas al usuario van en **español rioplatense**: vos, «tenés», «andá». Sin jerga de programador en los textos del juego.
- **Online:**
  - Pantalla en https://cinectomia.com/juego, publicada por FTP con GitHub Actions (`.github/workflows/publicar-pantalla.yml`) en cada push a `main` que toque `apps/web` o `packages/shared`.
  - Servidor en Render: `render.yaml`, autoDeploy, dominio `api.cinectomia.com`.
  - Base Postgres en Neon.

## Estructura y comandos

```
packages/shared   reglas puras del juego (TS), las importan servidor y pantalla. Acá van los números y las misiones.
apps/server       Fastify + Postgres (PGlite en .data/ si no hay DATABASE_URL). Migraciones en src/migrations/NNN_*.sql
apps/web          React 19 + Vite + MapLibre GL (mapa de Capital)
tools/            bot de balance (playthrough/brief), simulador de peleas, seed, devserver, tools/geo (mapas OSM)
docs/             GDD, HISTORIA (modo historia), BALANCE, AUDITORIA, CREDITOS, NOMBRES
```

- `npm run dev`: servidor en el puerto 3000 y web en 5173.
  - `tools/devserver.ts` reinicia el servidor sin romper la PGlite.
  - Nunca abrir la misma `.data/` desde dos procesos.
- `npm run seed`: crea jugadores de prueba (contraseña `prueba123`). Son solo locales.
- `npm test`: vitest con `packages/shared/test` y `tools/balance.test.ts`. El balance falla si un cambio rompe el ritmo de juego.
- `npm run typecheck` y `npm run build -w apps/web` antes de subir.
- `npm run brief` y `npm run sim`: miden el balance. Si tocás números de `packages/shared`, corré `npm test` (incluye el balance).

## Cómo trabajamos

- **Antes de subir**, que pasen tests, tipos y build. Después: commit, `git push` a `main` y se publica solo.
  - Lucas autorizó a Claude a hacer `git push`.
  - Si GitHub rechaza el push porque hay cambios nuevos: `git fetch` y `git rebase origin/main`. Nunca forzar.
- **Commits** en español, que digan qué cambia para el jugador. Terminan con `Co-Authored-By: Claude …`.
- **Cambios de base:** van en una migración nueva en `apps/server/src/migrations/`. Corre sola al arrancar el servidor.
- **Partidas viejas:** el estado del jugador es un JSON en `players.state`. Al cambiar su forma, contemplar las partidas existentes con `upgradeState` en `rules.ts`.
- **Lo que se ve en pantalla,** probarlo en el navegador: compu de 1024, 1366 y 1920 de ancho, y celular de 390.
- **Textos de tiempo:** siempre en horas y minutos con `durTxt` y `minTxt`, nunca «453 min». Las cuentas regresivas van en h:mm:ss.

## Reglas que no se rompen

- **Regla de oro (la puso Lucas): NINGÚN NOMBRE REAL, NINGUNA MARCA REAL. PERO TODAS LAS PROVINCIAS, PAÍSES Y CIUDADES CON SU NOMBRE ORIGINAL.**
  - Nada de personas reales (políticos, famosos, escritores, deportistas), ni vivas ni muertas.
  - Nada de marcas, modelos de auto, empresas, clubes, medios ni personajes con dueño (superhéroes, dibujos): siempre una versión genérica o inventada.
  - Provincias, países y ciudades van con su nombre de verdad (Córdoba, Mendoza, Rosario, Uruguay…).
  - **Chat:** los insultos discriminatorios se frenan con la lista de `apps/server/src/moderation.ts` (también en los nombres de personaje).

- **Secretos:** nunca escribir contraseñas, tokens ni la `DATABASE_URL` en el repo ni en el chat. Van en GitHub Secrets o en Render. Si alguien pega uno en el chat, no usarlo y recomendar cambiarlo.
- **El repo es privado.** Los sprites de ゆうひな (Yuhina) prohíben redistribuirlos. Al repo van solo los assets procesados, en `apps/web/src/assets`. Créditos en `docs/CREDITOS.md`.
- **Osein/BiteFight** es solo referencia de mecánicas: no se copia código ni arte.
- **El tablero de Trello** del proyecto es privado.
- **No borrar archivos del usuario** sin preguntar.

## El juego hoy

Para el detalle, ver el GDD.

- **Mapa:**
  - Es el protagonista. Capital con 34 barrios de nombre paródico (Almagrito, Once y Medio, Puerto Mareo, Reloquita, Salida (=Retiro)…).
  - Los barrios tienen el color de la pandilla que los domina.
  - Los viajes van por las cuadras reales (OSRM). Los pide el servidor.
- **Interfaz estilo Google Maps:**
  - Menú lateral: Vos, Inventario, Amigos, Crónica, Clan (próximamente) y Chat.
  - Chat: un solo canal para toda la ciudad (`apps/server/src/chat.ts`, tabla `chat`). Llega en vivo por el WebSocket; los bots no hablan.
  - Noticias de abajo: además de lo que hace cada uno, «X llegó a la ciudad» (personaje nuevo) y «X se conectó» (como mucho una vez cada 30 min; los bots no).
  - Arriba, el buscador, los filtros, y la vida, la energía y la XP siempre a la vista.
  - Botón ⚔️ «Pelear» al costado: tres rivales como en BiteFight, atacar a uno al azar o buscar a otros.
  - El tablón de misiones está en el Bar La Esquina.
- **Pandillas y jefes:**
  - La Familia: Elvira «La Señora» Santoro, en Puerto Mareo.
  - El Sindicato: Don Ramón Ferrante, el diarero, en Chacarota.
  - La Barra: El Tano Lucero, en Ñuñez.
  - Los Amarillos: Rita «Taxi» Quiroga, la taxista, en Once y Medio.
- **Modo historia** (`packages/shared/src/historia.ts`, `docs/HISTORIA.md`):
  - Temporada 1, Arco Capital Federal, Episodio 01 «Los inicios».
  - 15 misiones por jefe en 3 actos. Duran de 5 minutos a 18 horas; el viaje no cuenta.
  - El final (la 15) es solo para tu pandilla.
  - Cada misión destraba una página del diario en la Crónica, con la fecha real y noticias de otros jugadores.
  - **Villano oculto:** Marga, la del bar La Esquina y guía del tutorial. Quiere ser intendenta en 2027. Nadie la nombra: se la insinúa (Fundación La Esquina, el violeta, «2027», el café).
  - El rival de la barra es el Pelado Salvedad.
- **Otros sistemas:**
  - Tablón con una misión «Urgente» temporal.
  - Encuentros raros que aparecen un rato.
  - Golpes en locales de cada barrio y tiendas por rubro.
  - 10 pensiones de arranque.
  - Negocios: Vamo se compra después del final de Rita.
  - Noticias locales abajo del mapa.
  - 18 vecinos-bot con nicks de usuario (`apps/server/src/bots.ts`). Se apagan con `BOTS=0`.
  - Eventos del calendario (Noche de Brujas).

## Qué sigue

0. **El mundo abierto** (en diseño, sin código todavía): de Capital al país entero, en tiempo real, con misiones por cercanía.
   Ver `docs/MUNDO.md`, con sus tres etapas y lo que falta decidir.

1. Los 8 contactos de 4 misiones cada uno. Ya están aprobados en `docs/HISTORIA.md` §5 (Jorge de la Reserva, la Turca Nélida, Sor Mónica, Sasaki…).
2. Las decisiones pendientes de `docs/AUDITORIA.md`:
   - construir fuera de casa;
   - la caja fuerte;
   - cancelar la misión de a dos;
   - nombres reservados.

   También los costos de servidor: bots que no dejan dormir a Neon, límite de pedidos y limpieza de datos viejos.
3. Viajar en subte entre barrios: las estaciones ya tienen nombres por línea.
4. La terminal de Salida, para viajar al interior: «próximamente».
5. Clanes: «Clan» está como próximamente.
