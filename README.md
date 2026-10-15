# Malandro

Malandro: juego de navegador online, de policías y ladrones, en la ciudad de Maires.

Llegás solo con tu nombre. Marga, la dueña del bar La Esquina, te enseña cada mecánica con un encargo. Después, cuatro
pandillas se pelean Maires —**La Familia** (rojo), **El Sindicato** (azul), **La Barra** (verde) y **Los Amarillos**
(amarillo)— y terminás siendo de la que más trabajaste: un anillo de colores alrededor de tu avatar muestra tu afinidad.
La policía persigue a todos (calor, detenciones). Tenés tu **casa** (cama, caja fuerte y armario) y algunas cosas llevan
**tiempo de verdad**, como en BiteFight: entrenar, la guardia gratis y las obras.

Diseño completo en [docs/GDD.md](docs/GDD.md).

## Cómo correrlo en tu compu

Necesitás [Node.js](https://nodejs.org) 22 o más nuevo. No hace falta instalar ninguna base de datos.

```bash
npm install
npm run dev
```

Abrí http://localhost:5173 y creá un personaje. La partida queda guardada en `.data/` (base local).

Para probar La calle con rivales de verdad, creá jugadores de prueba (con `npm run dev` andando, en otra terminal):

```bash
npm run seed
```

Crea `Cabo Prueba` (Sindicato), `Agente Test` (Barra), `Rata Prueba` (Familia) y `Turca Test` (Amarillos). Contraseña: `prueba123`.

## Cómo está armado

```
packages/shared/   datos y reglas del juego: misiones, ítems, combate, energía, acciones
apps/server/       Node + Fastify + Postgres: cuentas, partidas, peleas entre jugadores, avisos en vivo
apps/web/          React + Vite: la pantalla
tools/             bot de balance, simulador de peleas, jugadores de prueba y el modo desarrollo
docs/GDD.md        documento de diseño: qué tiene el juego, límites y qué falta
docs/BALANCE.md    cómo está calibrado el juego y por qué
docs/AUDITORIA.md  la auditoría de Tomi: 18 bugs, cómo quedaron y qué falta decidir
docs/HISTORIA.md   el modo historia: Episodio 01, las 60 misiones y el hilo de Marga
legacy/            la primera versión (un solo HTML) y los prototipos anteriores
```

- **El servidor hace todas las cuentas.** La pantalla solo pide acciones, así nadie puede hacer trampa editando su partida.
- **Las reglas están en un solo lugar** (`packages/shared`). Las usan el servidor, la pantalla y el simulador.
- **Base de datos:** sin configurar nada usa PGlite (Postgres dentro de Node). Para publicarlo, se pone `DATABASE_URL` apuntando a un Postgres real.
- **Balance:** ver [docs/BALANCE.md](docs/BALANCE.md). Si tocás números en `packages/shared`, corré `npm run brief` y `npm test`.

## Otras órdenes

| Orden | Qué hace |
|---|---|
| `npm test` | Tests de las reglas y guardia del balance |
| `npm run brief` | Un bot juega 30 partidas por bando y resume el balance (ritmo, peleas, plata) |
| `npm run sim` | Simula miles de peleas: la calle por diferencia de nivel y el Ring |
| `npm run typecheck` | Revisa los tipos de todo el proyecto |
| `npm run build` y `npm start` | Arma la versión de producción; el servidor entrega también la pantalla |

## Pendiente

- Publicarlo online (hosting + Postgres).
- Ideas: chat, clanes/bandas, mensajes entre jugadores, trabajo largo por horas, más misiones.
