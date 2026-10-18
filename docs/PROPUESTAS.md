# Las 45 propuestas de Tomi: qué se hizo

Respuesta a «Propuestas de Malandro» (Tomi, 18/10/2026). Criterio: primero lo barato y de mucho efecto que no cambia el balance.
Lo que pide una decisión de diseño de Lucas o cambia números queda anotado abajo.

## Hechas

| N.º | Propuesta | Cómo quedó |
|---|---|---|
| 1 | «Mientras no estabas» | Al entrar, si pasaron más de 15 min desde la última vez (en ese navegador), una tarjeta con lo bueno, lo malo y lo que viene (misión u obra que termina, respeto que falta para el rango, evento que empieza). `apps/web/src/celebrate.tsx`. |
| 2 | El riesgo a la vista | Laburos y golpes muestran «Sale bien · Policía · Golpearte» con la misma cuenta del servidor (`jobOdds`). Las misiones, «cada etapa sale bien ~X %», cuántas peleas y cuántas etapas hacen falta (`stepChance`, `missionOdds`). Cuando te agarra la policía, la crónica dice por qué. |
| 3 | Subir tiene que sentirse | Tarjeta al subir de nivel (qué destraba y lo próximo), de rango (las misiones que se abren y el respeto que falta) y al entrar a una pandilla (la frase del jefe). `packages/shared/src/progreso.ts`. |
| 18 | Protección para el que llega (parte) | Hasta el nivel 5 no te atacan otros jugadores ni los atacás (salir a buscar, la lista de ⚔️ Pelear y los cruces en la calle). Con los personajes del juego sí se pelea. Falta: tope diario de ataques y la revancha. |
| 19 | Avisos fuera de la pantalla (parte) | El título de la pestaña muestra lo pendiente («(2) Malandro»): mensajes del chat sin leer y lo que pasó con la pestaña escondida. Faltan los avisos del navegador. |

Antes de esta lista ya estaban: el chat, el perfil con «Agregar de amigo», la regla de oro de los nombres y el filtro de palabras.

## Para decidir (Lucas)

Piden una definición antes de tocar código o números: **11** (el hueco entre la misión 10 y la 11: bajar Puntero, sumar contactos o mostrar el camino), **12** y **13** (balance de pandillas y de misiones), **38** (cuánto dura Malandro), **39** (el gimnasio como casi todo el gasto), **40** (elegir no pelear con jugadores), **41** (qué hace un Capo), **42** (la frase de la experiencia), **44** (nivel de realismo) y **45** (crecer o quedarse entre amigos).

## Buenas para lo próximo

- **5** recompensas variables y **23** decisiones dentro del golpe: tocan `resolveJob`; hay que medir con el bot que el promedio no cambie.
- **6** la pelea reproducida round por round y **7** sonido mínimo.
- **14** y **15**: que el bot compre casas, negocios y vehículos, y herramientas de prueba (crear un jugador en cualquier nivel, adelantar el reloj).
- **17** colores para daltónicos (La Familia y La Barra se confunden).
- **20** los contactos presentados de a poco: va junto con los 8 contactos de `HISTORIA.md` §5.
- **8**, **9**, **21**, **22**, **24** a **37**: sistemas nuevos, de a uno.
