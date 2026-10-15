# Auditoría de Malandro

> 15/10/2026 · Auditoría de **Tomi** (informe en PDF); arreglos rehechos sobre `main` a partir de su informe.
> Pruebas: `packages/shared/test/auditoria.test.ts`.

## Los 18 bugs

| # | Bug | Zona | Gravedad | Cómo quedó |
|---|---|---|---|---|
| 1 | Pedidos armados a mano rompían la partida: un índice raro en el Ring, una pandilla que no existe, claves como `__proto__` | Reglas y servidor | Alta | `validAction` revisa tipo, valores y claves propias de cada tabla. El servidor responde 400 sin tocar la partida · prueba |
| 2 | «Cosas que hacer» mandaba a un recién llegado a La valija | Tutorial | Alta | La valija pide la pestaña Misiones (el último encargo de Marga) · prueba |
| 3 | Salir a buscar a alguien cobraba 6 de energía (3 al salir y 3 al pelear) y podía dejarla en negativo | Peleas en el mapa | Media-alta | Se cobra una vez, al salir. `pvp` nunca baja de 0 · prueba |
| 4 | Al que vuelve a su casa nunca se lo alcanzaba («ya no estaba») | Peleas en el mapa | Media | `stillOnTrip` cuenta la vuelta a casa desde esa misión (no la ambulancia) · prueba |
| 5 | Emboscadas solo con la pantalla abierta | Peleas en el mapa | Media | Cada ventana se mira a su hora y se resuelve antes que la misión · prueba |
| 6 | En compu, el panel tapaba la barra de arriba | Pantalla | Media | El panel arranca en 96 px, debajo de la barra (medido en 1024, 1366 y 1920). La leyenda se corre a su derecha |
| 7 | En el celular, los filtros y la lupa quedaban fuera de la pantalla | Pantalla | Media | Los filtros se deslizan y la lupa se ve (medido en 390 px) |
| 8 | Tutorial «Puntos y gasas»: estando entero, visitar el hospital no contaba | Tutorial | Media | Abrir un lugar marca su pestaña como vista |
| 9 | Mansión en un barrio humilde a mitad de precio, o mudanza gratis | Trampas | Media | Solo casas que vende ese barrio · prueba |
| 10 | Un golpe en el lugar equivocado daba error pero cobraba la energía | Reglas | Baja | Se revisa el lugar antes de cobrar · prueba |
| 11 | La máscara de calabaza se vendía a $400 | Trampas | Baja | Los recuerdos de eventos no se venden (y no tienen botón) · prueba |
| 12 | El kiosco ofrecía el botiquín en el tutorial y el servidor lo rechazaba | Tutorial | Baja | En el tutorial, el kiosco no lo ofrece |
| 13 | El tiempo del gimnasio no descontaba el 25% del Sindicato | Pantalla | Baja | El botón usa el mismo cálculo que el servidor |
| 14 | Cuentas regresivas de horas en minutos | Pantalla | Baja | h:mm:ss (ya estaba arreglado en `main`) |
| 15 | Duelo: si la lista de rivales cambiaba en el medio, se peleaba con otro | Reglas y servidor | Baja | El duelo exige el mismo rival que se bloqueó |
| 16 | La entrada decía «la placa o la plata» (versión 1) | Pantalla | Baja | Texto nuevo |
| 17 | `cp.txt`: cookies de curl con un token local, subidas al repo | Repo | Baja | Borrado y en `.gitignore` |
| 18 | Crónica fuera de orden cuando algo se resuelve con hora pasada | Reglas | Baja | `log` inserta cada entrada en su lugar por hora · prueba |

## Decisiones pendientes

| Decisión | Qué pasa hoy | Recomendación de Tomi |
|---|---|---|
| ~~La calle~~ | **Resuelto:** botón ⚔️ «Pelear» al costado del mapa: tres rivales posibles (como en BiteFight), «Atacar a uno al azar» y «Buscar a otros» | — |
| ~~El tablón~~ | **Resuelto:** está en el Bar La Esquina, con la misión en curso, «Buscar otras» y los trabajos largos | — |
| Construir fuera de casa | El código lo deja, el GDD dice que no | Dejarlo y corregir el GDD |
| Caja fuerte desde cualquier lado | Se puede guardar plata justo antes de una emboscada | A criterio |
| Cancelar una misión de a dos | Devuelve energía aunque pase del tope | Topearlo |
| Nombres reservados | Se puede registrar «Marga» o un jefe | Lista de nombres reservados |

## Servidor y costos (para más adelante)

- Los vecinos (bots) no dejan dormir a Neon.
- El camino por las cuadras se pide con la partida bloqueada.
- Nada se borra: sesiones, noticias, peleas.
- `/api/action` no tiene límite de pedidos.
- Dos registros simultáneos con el mismo nombre dan un error 500.
