# Placa o Plata

Juego de navegador online al estilo BiteFight, de policías y ladrones, en la ciudad de Bahía Gris.

Llegás solo con tu nombre. Marga, la dueña del bar La Esquina, te enseña cada mecánica con un encargo
(laburos, gimnasio, feria, ring, guardia, misiones) y al final elegís bando: **la placa** o **la plata**.

| | La placa | La plata |
|---|---|---|
| Jefa | Comisaria Inés Ríos | La Señora |
| Caza | **Patrullaje**: paga menos, sueldo cada 10 min | **Golpes**: paga más, pero suma **calor** (con mucho calor te detienen) |
| La calle | Arrestás delincuentes: jugadores reales y personajes del juego | Asaltás policías: jugadores reales y personajes del juego |
| Misiones | Ronda nocturna → Allanamiento en el puerto → Detener a La Señora | La protección → El blindado → La libreta de la 4ª |
| Armería | Tonfa, chaleco antibalas, pistola, escudo | Manopla, campera con placas, recortada, chaleco |

Además: respeto y 6 rangos por bando, emboscadas, ranking de la ciudad y avisos en vivo cuando otro jugador te ataca.

## Cómo correrlo en tu compu

Necesitás [Node.js](https://nodejs.org) 22 o más nuevo. No hace falta instalar ninguna base de datos.

```bash
npm install
npm run dev
```

Abrí http://localhost:5173 y creá un personaje. La partida queda guardada en `.data/` (base local).

Para probar La calle con rivales de verdad, creá jugadores de prueba (con el servidor apagado):

```bash
npm run seed
```

Crea `Cabo Prueba`, `Agente Test` (placa), `Rata Prueba` y `Turca Test` (plata). Contraseña: `prueba123`.

## Cómo está armado

```
packages/shared/   datos y reglas del juego: misiones, ítems, combate, energía, acciones
apps/server/       Node + Fastify + Postgres: cuentas, partidas, peleas entre jugadores, avisos en vivo
apps/web/          React + Vite: la pantalla
tools/             simulador de balance y jugadores de prueba
legacy/            la primera versión (un solo HTML) y los prototipos anteriores
```

- **El servidor hace todas las cuentas.** La pantalla solo pide acciones, así nadie puede hacer trampa editando su partida.
- **Las reglas están en un solo lugar** (`packages/shared`). Las usan el servidor, la pantalla y el simulador.
- **Base de datos:** sin configurar nada usa PGlite (Postgres dentro de Node). Para publicarlo, se pone `DATABASE_URL` apuntando a un Postgres real.

## Otras órdenes

| Orden | Qué hace |
|---|---|
| `npm test` | Corre los tests de las reglas |
| `npm run sim` | Simula miles de peleas y muestra qué tan difícil es cada una |
| `npm run typecheck` | Revisa los tipos de todo el proyecto |
| `npm run build` y `npm start` | Arma la versión de producción; el servidor entrega también la pantalla |

## Pendiente

- Documento de balance (ingresos y gastos por nivel). La simulación muestra que un rival 2 niveles arriba es casi imposible.
- Publicarlo online (hosting + Postgres).
- Ideas: chat, clanes/bandas, mensajes entre jugadores, trabajo largo por horas, más misiones.
