# Malos Aires — Game Design Document

**Estudio:** Mauspi Lab · **Versión del documento:** 2.0 (15/10/2026) · **Estado:** jugable online, en prueba entre amigos
**Dónde se juega:** https://cinectomia.com/juego/ · **Repo:** github.com/PaperLucas64/placaoplata
Relacionados: [BALANCE.md](BALANCE.md) (números y cómo medirlos) · [CREDITOS.md](CREDITOS.md) (arte y licencias)

> Los números salen del código (`packages/shared/src`: `config.ts`, `data.ts`, `gangs.ts`, `rules.ts`, `actions.ts`).
> Si se cambia un número allá, actualizar acá.

**Nombre:** Malos Aires, parodia de Buenos Aires (como Los Santos con Los Ángeles). Antes se llamó "Placa o Plata" y la ciudad "Bahía Gris".

**Cambio de la versión 2:** ya no se elige entre policía y delincuente. Hay **cuatro pandillas** y pertenecés a la que
más trabajaste (afinidad dinámica). La policía pasó a ser una **amenaza para todos**. Se agregó **la casa** (base del jugador).

---

## 1. Visión

Juego de navegador por energía, al estilo **BiteFight**, en **Malos Aires**, una ciudad portuaria rioplatense de noche.
Llegás solo con tu nombre, hacés trabajos para las **cuatro pandillas** que se pelean la ciudad y terminás siendo de la que
más te banque. Peleás contra pandilleros de las otras —personajes y **jugadores reales**—, esquivás a la policía y
armás tu casa.

- **Género:** juego de navegador persistente por energía, PvE + PvP asincrónico.
- **Plataforma:** web (escritorio y celular), cuenta con usuario y contraseña.
- **Público:** grupos de amigos y comunidades chicas; sesiones cortas varias veces por día.
- **Tono:** policial negro con humor de barrio, español rioplatense.

### Pilares
1. **Tu pandilla la definen tus actos:** no se elige con un clic; se gana haciendo encargos y misiones, y puede cambiar.
2. **Sesiones cortas con progreso real:** gastás la energía en 5–10 min y siempre avanzaste algo.
3. **La ciudad está viva:** otros jugadores te pueden atacar mientras no estás.
4. **Tiempo humano:** entrenar, curarse gratis y construir llevan minutos de verdad, como en BiteFight.
5. **Riesgo con sentido:** más paga = más calor policial y más golpes. Nunca se pierde el personaje.

---

## 2. Loops de juego
**Sesión:** entrar → sacar plata de la caja fuerte → gastar la energía (encargos, golpes, misiones, la calle) → poner a
entrenar o a construir → guardar la plata en la caja fuerte → salir. La energía se llena en 1 hora.

**Progreso:** subir de nivel → entrenar → juntar respeto → subir de rango → destrabar misiones y mercado negro →
avanzar en la historia de tu pandilla → mejorar la casa → escalar en el ranking.

**Social:** atacar jugadores de otras pandillas → recibir ataques (aviso en vivo) → ranking.

---

## 3. Mundo y personajes

| Pandilla | Color | Jefe | Barrio | Estilo | Ventaja si sos de ella |
|---|---|---|---|---|---|
| **La Familia** | rojo | La Señora | el puerto | contrabando, extorsión | +10% de plata en los golpes |
| **El Sindicato** | azul | El Gordo Bermejo | los galpones | aprietes, paros, robo de cargas | entrenás 25% más rápido |
| **La Barra** | verde | El Tano Lucero | la cancha | reventa, peleas, territorio | +10% de fuerza en las peleas |
| **Los Amarillos** | amarillo | Rita "Taxi" Quiroga | las remiserías | autos, desarmaderos, picadas | juntás 30% menos de calor |

Otros: **Marga** (bar La Esquina, guía del tutorial), **Don Tito** (gimnasio), **El Gallego** (mano derecha de La Señora),
**Comisaria Inés Ríos** (la policía), pandilleros con nombre de cada pandilla y rivales del ring.

---

## 4. Progresión

### 4.1 Niveles y atributos
- XP para pasar del nivel *n*: `40 × n^1,55`. **No hay nivel máximo** (el contenido llega hasta ~nivel 15).
- 5 atributos (Fuerza, Dureza, Reflejos, Aguante, Labia), empiezan en 5, sin tope. Entrenar cuesta `3 × valor²` y lleva
  `2 + 0,4 × valor` minutos (máx. 30; el Sindicato 25% menos).
- Vida máxima: `40 + Aguante × 12 + nivel × 6`. Labia: +1,5% de paga por punto.

### 4.2 Tiempos
| | Valor |
|---|---|
| Energía | máx. 40 (+5 a +20 con la cama), +1 cada 1,5 min |
| Vida | +2% cada 36 s (más con la cama: hasta +60%) |
| Calor | −1 cada 1,5 min |
| Emboscadas | 30% cada 6 min (si no estabas, como mucho 1) |

### 4.3 Tiempo humano ("estás ocupado")
Entrenar y la guardia gratis te dejan **ocupado**: no podés trabajar, pelear, entrenar ni hacer misiones (sí comprar,
usar la caja fuerte, el abogado o un botiquín). Se puede cancelar. Mientras estás en la guardia nadie te ataca.
Las **obras de la casa** también llevan tiempo, pero **no** te bloquean.

### 4.4 Respeto y rangos (iguales para todos)
| Rango | Respeto | Nombre | Destraba |
|---|---|---|---|
| 0 | 0 | Perejil | primera misión de cada pandilla |
| 1 | 50 | Pibe | mercado negro nivel 1 |
| 2 | 220 | Soldado | segunda misión de cada pandilla, mercado negro nivel 2 |
| 3 | 600 | Puntero | mercado negro nivel 3 |
| 4 | 1.400 | Lugarteniente | misión final de cada pandilla, mercado negro nivel 4 |
| 5 | 3.000 | Capo | (nada todavía) |

Respeto: golpes (+1 a +5), encargos (+3), la calle (+1 a +12, +2 extra contra jugadores), misiones (+30/+90/+300),
emboscadas rechazadas (+2/+3). Perder una pelea que iniciaste: −2.

---

## 5. Sistemas

### 5.1 Pandillas y afinidad
- Cada **encargo** suma **+3** de afinidad con la pandilla que lo da (+1 si sale mal). Cada **misión** suma **+10 / +20 / +40**.
- **Todo pesa igual** (no se olvida lo viejo). Tu parte con cada pandilla = su afinidad ÷ tu afinidad total.
- **Sos de una pandilla cuando tiene el 50% o más** y ya hiciste al menos 10 puntos. Si no, andás **suelto**.
- Se puede cambiar: si trabajás para otra hasta que la anterior baje del 50%, pasás a estar suelto; cuando la nueva llega al 50%, sos de ella.
- **Anillo de pandillas:** alrededor de tu avatar, un gráfico de torta con los cuatro colores según tu afinidad.
- Ser de una pandilla te da su **ventaja** (ver §3) y define quiénes son tus rivales en La calle.

### 5.2 Tutorial (Marga)
6 encargos que destraban Trabajos, Gimnasio, Feria, Ring, Clínica y Misiones, más la misión «La valija».
Al terminarlo se abren **La calle, la Casa y el Ranking**, los golpes y los encargos de las pandillas. Dura ~32 de energía.

### 5.3 Trabajos
- **Encargos de las pandillas** (4, repetibles): 4 de energía, prueba de un atributo según la pandilla
  (Familia: labia · Sindicato: fuerza · Barra: dureza · Amarillos: reflejos). Paga `nivel × 10–18`, XP, +3 respeto, +3 calor, +3 afinidad.
- **Golpes** (6, después del tutorial): pagan bien, suman respeto y calor. Con calor, te puede agarrar la policía
  (`calor/400 + riesgo × 1%`): fianza de 10% de lo que llevás encima + nivel × 5.

| Golpe | Energía | Plata | XP | Respeto | Calor | Nivel |
|---|---|---|---|---|---|---|
| Arrebato de celulares | 1 | 8–18 | 4–6 | 1 | 1 | 1 |
| Robar estéreos de autos | 2 | 18–38 | 7–12 | 1 | 2 | 3 |
| Laburo en el desarmadero | 3 | 38–75 | 14–20 | 2 | 3 | 5 |
| Asalto a una estación de servicio | 4 | 70–130 | 24–34 | 3 | 5 | 8 |
| Contrabando en el puerto | 5 | 120–220 | 38–53 | 4 | 6 | 11 |
| Asalto a una financiera | 6 | 200–360 | 55–74 | 5 | 8 | 15 |

- **Laburos** honestos (5): sin calor ni respeto (bici, lavado, boliche, chofer, depósito), niveles 1 a 9.

### 5.4 Policía (amenaza para todos)
Calor de 0 a 100. Lo suben los golpes, los encargos, las peleas en la calle y las misiones. Con calor alto, te detienen en
los golpes y las emboscadas pasan a ser de la policía. El **abogado** baja 40 de calor por `20 + nivel × 8`.

### 5.5 Feria y mercado negro
1 arma + 1 protección equipadas. Lo que dejás de usar va al **armario** si hay lugar; si no, se pierde.
Neutral: llave (+3), bate (+6), bastón (+9); campera (+2), casco (+5), chaleco (+8); botiquín ($20, +50% de vida).
**En el tutorial la feria solo vende la llave inglesa**; después muestra lo de tu nivel y avisa en qué nivel se desbloquea lo siguiente.
**Suplemento de Don Tito** (desde nivel 3): +10 de vida máxima para siempre; cuesta `300 × (n+1)²` (el n-ésimo), hasta 10 (+100).
Mercado negro (por rango, igual para todos): rango 1 manopla / campera gruesa (+11/+10, $900) · rango 2 navaja / campera
con placas (+15, $2.200) · rango 3 recortada / chaleco robado (+19, $3.800) · rango 4 fusil / chaleco del mercado negro (+23, $6.000).

### 5.6 Gimnasio, Ring, Clínica
- **Gimnasio:** ver §4.1. **Ring:** 5 rivales de práctica. **Clínica:** paga al instante ($0,25 por punto de vida);
  **guardia** gratis hasta 15 min; **botiquín**.

### 5.7 Misiones (a tiempo humano)
- **Duran tiempo de verdad.** Al empezarla, el personaje sale a hacerla y queda ocupado. La energía de todas las etapas se
  paga al salir. Cada etapa se resuelve sola a su hora (prueba de atributo `50% + (atributo − dificultad) × 7%`, pelea
  contra un jefe o entrega) y la **crónica narra** lo que pasó. Las resuelve el servidor aunque no estés conectado.
- **Sale bien** si salen bien al menos el 60% de las etapas (La valija: 2 de 4). Si no, se cae: se pierde la energía y se
  puede reintentar. Se puede abandonar (la energía no vuelve).
- **Requisitos:** atributos mínimos para empezarla. Pandillas: 1ª misión 7 y 6, 2ª 10 y 9, 3ª 16 y 15 (en los dos
  atributos que más usa). Calle: el atributo principal, según la dificultad.
- Hay que tener al menos la mitad de la vida para salir.

**La valija** (tutorial): 30 min. **Historias de pandilla** (3 por pandilla, en orden, piden rango): 20 / 40 / 60 min.

| Pandilla | 1ª (rango 0) | 2ª (rango 2) | 3ª (rango 4) |
|---|---|---|---|
| La Familia | La protección | El blindado | La libreta de la 4ª (vs. Comisaria Ríos) |
| El Sindicato | El paro | La carga del depósito 7 | Fuera del puerto (vs. El Gallego) |
| La Barra | Los trapos | La reventa | El clásico (vs. El Pampa) |
| Los Amarillos | Viaje sin taxímetro | El desarmadero | La picada de la costanera (vs. El Gordo Bermejo) |

Premios: $150 / $500 / $1.800 · 60 / 180 / 600 XP · 30 / 90 / 300 respeto · +10 / +20 / +35 calor · +10 / +20 / +40 afinidad.

**Tablón de la calle (misiones generadas):** 4 misiones a tu nivel (de 1 a 50 y más), una por dificultad, cada una de una
pandilla al azar. Se arman combinando **12 barrios de Malos Aires** (La Bocota, Puerto Mareo, San Telmón, Palermo Soja,
Villa Crespa, Barrancas, Florida Vieja, Once y Medio, Mataderos, Recoleta Bien, Liniers Sur, Pompeya Chica), **6 objetivos
por pandilla**, etapas por atributo y un rival (pandillero o policía): cientos de combinaciones. Se renueva cada 6 horas o
pagando 2 de energía.

| Dificultad | Duración | Energía | Pide (atributo principal) | Paga | Afinidad | Sale bien (bot) |
|---|---|---|---|---|---|---|
| Fácil | 10 min | 4 | 55% de lo típico a tu nivel | ×1,0 | +2 | ~93% |
| Normal | 20 min | 6 | 70% | ×1,15 | +3 | ~79% |
| Difícil | 35 min | 8 | 85% | ×1,3 | +5 | ~63% |
| Jodida | 50 min | 10 | 100% | ×1,5 | +8 | ~34% |

Paga por energía: `(10 + 2,4 × nivel) × multiplicador` de plata y `(3 + 0,55 × nivel) × multiplicador` de XP.

### 5.7b Amigos y misiones de a dos
- **Amigos:** se agregan por nombre; el otro acepta (si los dos se piden, queda aceptado). Se ve nivel, pandilla y si está en línea.
- **Misión de a dos:** invitás a un amigo; la misión se arma para el nivel promedio de los dos y es de tu pandilla (o de
  una al azar si andás suelto). Al aceptar se cobra **8 de energía a cada uno**.
- **Si alguno está ocupado** (entrenando, en la guardia o en otra misión), la misión **espera** y arranca sola cuando los
  dos estén libres. Mientras espera, ninguno puede arrancar otra actividad larga (entrenar, guardia, misión).
- Dura 40 min, 4 etapas. En cada prueba actúa **el que mejor tiene ese atributo**; las peleas las dan **juntos** (suman
  vida, pega el más fuerte, esquiva el más rápido) contra un grupo más duro. Sale bien con el 60%.
- Premio para **cada uno**: `8 × (10 + 2,4 × nivel) × 1,6` de plata, XP en proporción, +8 respeto, +5 afinidad.
- Se puede cancelar antes de arrancar (vuelve la energía) o abandonar en curso (se cae para los dos).
- Avisos en vivo: solicitud de amistad, invitación, aceptada, arrancó, terminó, cancelada.

### 5.8 La calle
Rivales: pandilleros de **las otras pandillas** (si andás suelto, de todas). Hasta 3 jugadores reales de nivel parecido;
el resto, personajes. A los de tu pandilla no los podés atacar. 3 de energía por pelea; mismo jugador real 1 vez por hora;
nadie con menos de 25% de vida ni internado en la guardia. Ganar: 35% de lo que lleva encima (jugadores: hasta 25% de su
plata encima), XP, respeto, +4 calor. **Lo guardado en la caja fuerte no se puede robar.**

### 5.9 La casa
Se mejora con plata y **tiempo de obra** (una obra a la vez, no te bloquea).

| Parte | Niveles | Efecto | Costos |
|---|---|---|---|
| **Cama** | colchón → una plaza → dos plazas → sommier → king | +5/+10/+15/+20 energía máx. y +15% a +60% recuperación de vida | $300, $1.500, $5.000, $12.000 (10 min a 3 h) |
| **Caja fuerte** | lata → cajita → de pared → blindada → bóveda | guarda hasta $200 / $800 / $2.500 / $7.000 / $18.000, a salvo de robos y fianzas | $250, $1.000, $3.500, $9.000, $22.000 (5 min a 3 h) |
| **Armario** | perchero → ropero → vestidor | guarda 2 / 4 / 8 piezas de equipo para volver a usarlas | $200, $1.200, $4.500 (10 min a 90 min) |

### 5.10 Ranking y crónica
Ranking por respeto: jugadores reales + 12 personajes fijos, con el color de su pandilla. Crónica: últimas 40 cosas que te pasaron.

---

## 6. Combate
Hasta 12 rounds; ataca primero quien inicia. Acierto `62% + (Reflejos − Reflejos) × 1,5%` (25–92%).
Daño `3 × ((Fuerza × 1,6 + arma) × azar[0,5–1,5] − Dureza × 0,5 − protección × 0,7)`, 15% de crítico (×1,6).
Rivales del juego: atributo ≈ `máx(5; 0,5 + 1,4 × nivel)`, equipo hasta +24. Ver [BALANCE.md](BALANCE.md).

## 7. Economía
**Entra** (bot, mediana): golpes y laburos ~42–50%, encargos ~32–39%, la calle ~16–18%.
**Sale:** gimnasio ~80%, clínica ~10%, equipo ~4%, fianzas ~3%, casa ~1%.
La caja fuerte resuelve "no hay banco" con tope ampliable: la plata grande sigue expuesta, lo que obliga a mejorar la casa.

### Límites actuales
| Qué | Límite |
|---|---|
| Nivel / atributos | sin tope (contenido hasta ~nivel 15; atributos limitados por el costo) |
| Rango | máx. 5 (Capo), sin contenido propio |
| Energía | 40 a 60 según la cama; no hay forma de recargarla |
| Equipo | 1 arma + 1 protección; armario de 0 a 8 piezas; no se vende |
| Caja fuerte | $0 a $18.000 según el nivel |
| Encargos | repetibles sin tope (los limita la energía) |
| Misiones | las de pandilla, 1 vez cada una (3 por pandilla); las de calle, sin tope (tablón de 4, cada 6 h) |
| Ataques a jugadores | 1 por hora al mismo; sin tope diario |
| Pandilla | se puede cambiar trabajando para otra |
| Avatar | se elige al crear el personaje |
| Misiones de a dos | una por vez; una invitación pendiente por vez |

---

## 8. Online, arte y tecnología
- Cuentas con contraseña (scrypt), sesión de 30 días, límite de intentos, el servidor hace todas las cuentas, avisos en vivo.
- Arte 2D: retratos de novela visual (incluidos los 4 jefes), fondos con filtro nocturno teñidos por pandilla, armas en pixel art. Ver [CREDITOS.md](CREDITOS.md).
- TypeScript: `packages/shared` (reglas), `apps/server` (Fastify + Postgres), `apps/web` (React). Render + Neon + Donweb.

---

## 9. Qué falta (roadmap)

### Prioridad alta
- **Recuperar contraseña** (no se pide mail).
- **Protección para nuevos** y **tope diario de ataques** entre jugadores.
- **Moderación:** nombres, bloquear cuentas, panel de administración.
- **Probar el balance de las peleas entre jugadores reales.**

### Pandillas
- **Territorio:** barrios que cambian de dueño según la actividad de los jugadores de cada pandilla.
- **Más misiones escritas** por pandilla (rangos 1, 3 y 5); más objetivos y barrios para el generador; misiones diarias.
- **Guerras entre pandillas** y eventos (el clásico, un paro general, una redada policial).
- Rango propio dentro de la pandilla, títulos por pandilla, chat de pandilla.
- Consecuencias al cambiar de pandilla (por ejemplo, la anterior te marca como traidor por un tiempo).

### Casa
- Más partes: **bolsa de boxeo** (entrenar más rápido), **cocina** (botiquines caseros), **garaje** (trabajos con auto),
  **guardaespaldas** (defensa al ser atacado), decoración que suma respeto.
- Mudanzas: de la pieza de pensión a un departamento, una casa, un chalet.

### Contenido y sistemas
- Fin de juego (equipo nivel 5+, trabajos y ring para niveles 15–30), nivel máximo o reinicio.
- Turno largo (como el cementerio de BiteFight); el sistema de "ocupado" ya está listo.
- Informes de pelea y revancha; mensajes entre jugadores; logros.
- Música y sonido (hay música CC0 en los assets); más retratos; cambiar el avatar.

### Infraestructura
- Plan pago de Render si hay muchos jugadores; vigilar horas gratis de Neon; copias de seguridad; repo privado.
