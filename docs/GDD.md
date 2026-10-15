# Malandro — Game Design Document

> El juego se llama **Malandro**; la ciudad donde pasa todo es **Maires** (parodia de Buenos Aires).

**Estudio:** Mauspi Lab · **Versión del documento:** 2.0 (15/10/2026) · **Estado:** jugable online, en prueba entre amigos
**Dónde se juega:** https://cinectomia.com/juego/ · **Repo:** github.com/PaperLucas64/placaoplata
Relacionados: [BALANCE.md](BALANCE.md) (números y cómo medirlos) · [CREDITOS.md](CREDITOS.md) (arte y licencias)

> Los números salen del código (`packages/shared/src`: `config.ts`, `data.ts`, `gangs.ts`, `rules.ts`, `actions.ts`).
> Si se cambia un número allá, actualizar acá.

**Nombre:** Maires, parodia de Buenos Aires (como Los Santos con Los Ángeles). Antes se llamó "Placa o Plata", "Bahía Gris" y "Malos Aires".

**Cambio de la versión 2:** ya no se elige entre policía y delincuente. Hay **cuatro pandillas** y pertenecés a la que
más trabajaste (afinidad dinámica). La policía pasó a ser una **amenaza para todos**. Se agregó **la casa** (base del jugador).

---

## 1. Visión

Juego de navegador por energía, al estilo **BiteFight**, en **Maires**, una ciudad portuaria rioplatense de noche.
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
| **La Familia** | rojo | Elvira «La Señora» Santoro | el puerto | contrabando, extorsión | +10% de plata en los golpes |
| **El Sindicato** | azul | Don Ramón Ferrante (diarero) | los galpones | aprietes, paros, robo de cargas | entrenás 25% más rápido |
| **La Barra** | verde | El Tano Lucero | la cancha | reventa, peleas, territorio | +10% de fuerza en las peleas |
| **Los Amarillos** | amarillo | El Tucu Medina (taxista) | las remiserías | autos, desarmaderos, picadas | juntás 30% menos de calor |

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

### 5.2 Maires = Capital (por ahora)
El mapa es la Capital del sur de las autopistas 25 de Mayo y Perito Moreno hacia el norte, hasta la General Paz y el río
(con la Reserva y Aeroparque): **34 barrios oficiales pegados**, cada uno con su nombre de parodia y su contorno:
Agromanía, Almagrito, Once y Medio, Belgranito, Caballote, Chacarota, Coglán, Colegas, Floreros, Florestita, Liniers Sur,
Mosecraft, Monte Castrito, Ñuñez, Palermo Soja, Parque Chau, La Paterna, Puerto Mareo, Reloquita, Salida (Retiro),
Saavedrita, San Nicolasito, Vélez Sarsfeel, Versalles Chico, Villa Crespa, Villa del Charque, Villa Devota, Villa Mitrecito,
Villa Lurio, Villa Ortuzán, Villa Puerredón, Villa Realeza, Villa Santa Rata y Villa Urquisa. El sur, el conurbano y el
interior quedan para más adelante.
- **Naciste en un barrio al azar** (ahí está tu pieza de pensión) y después te mudás.
- **Barrio de cada pandilla:** La Familia, Puerto Mareo · El Sindicato, Chacarota · La Barra, Ñuñez · Los Amarillos, Once y Medio.
- **Los viajes van por las cuadras:** el servidor calcula el camino real (OpenStreetMap) desde donde estés, cada vez que
  salís; la vuelta a casa también. Por ahora sin subte ni tren (hay que rearmarlos para Capital).
- **Actividad rápida** (al lado de «Ficha»): te manda a una misión o a un golpe al azar de los que podés hacer ahora.
- **Las misiones que no podés hacer ahora no se muestran** (ni en los contactos, ni en el tablón, ni en el mapa).

### 5.2·1 Pantalla como Google Maps
- El **mapa ocupa toda la pantalla**. A la izquierda (en el teléfono, abajo), los **menús**: Calle, Gimnasio, Mercado, Casa,
  Ciudad y Crónica; cada uno abre su panel encima del mapa.
- Arriba, **«Buscar amigo o lugar»** (gente para agregar, barrios y lugares) y los **filtros**: «Cosas que hacer» (actividad
  rápida), Misiones, Para robar, Trabajos, Salud, Casas, Subte, Kioscos y mercado, Negocios, Gimnasio y ciudad.
- Arriba a la derecha, **tu foto** (con vida y energía): abre tu panel con tu pandilla o Marga, la ficha y lo que estás haciendo.
- **Tocar un barrio** (como el mapa de Helldivers) lo acerca y muestra quién manda, las misiones que pasan ahí, todo lo que hay
  y las casas en venta. **Cada barrio tiene** su salita (o hospital), clínica si es caro, kiosco (botiquines), inmobiliaria con
  3 casas (precios según el barrio: humilde ×0,7, medio ×1, caro ×1,5) y sus estaciones de subte (71, de OpenStreetMap).
- Monsefrat pasa a llamarse **Mosecraft**.

### 5.2a El mapa es el juego (lugares, como en GTA)
El mapa muestra **lugares con íconos** (pines de colores, como los de GTA). Al tocar uno se abre lo que podés hacer ahí:
- **Contactos** (los «Lester» de Maires): Bar La Esquina (Marga: tutorial y La valija) · la casona de La Señora (Puerto Mareo) ·
  Galpón 3 (Don Ramón Ferrante, Barrancas) · La Bombonerita (El Tano, La Bocota) · Radiotaxi El Tucu (Once y Medio) · Comisaría 4ª
  (Funes, desde nivel 5). Cada uno tiene su encargo, su historia, las historias de la ciudad desde su lado y sus pedidos.
  El número rojo es cuántas misiones te tiene.
- **Servicios:** tu casa · Gimnasio de Don Tito · Estadio Luna Parquecito (torneo) · Feria de usados de Pompeya Chica ·
  Concesionaria Autos del Bajo · Municipalidad (barrios y ranking) · hospitales y clínicas.
- **Para robar** (los golpes pasan siempre ahí): Plaza Misere (celulares), estacionamiento de Palermo Soja (estéreos),
  Desarmadero El Tuerca y Autopartes Lo de Cacho, YPFita de la Costanera y Shellita Avenida, Muelle 4, Financiera Las Cuevas.
- **Trabajos honestos:** Bicis Rodado 26, lavadero de la estación, puerta del boliche Soja, Remisería Nocturna, Depósito 7.
- **Negocios** (los tuyos y los que se pueden comprar) y las **misiones del tablón** como banderitas en su barrio.
- **Eventos:** Noche de Brujas (24/10 al 2/11): el Cementerio de Reloquita con 3 misiones encadenadas y una máscara de
  calabaza de regalo (cabeza, reflejos +2, dureza +2; no se vende).
- Los lugares aparecen a medida que avanzás (tutorial, nivel, rango) o con los eventos. De lejos se ven solo los importantes;
  acercándote, todos. Íconos de colores (Noto Emoji, provisorios).
- **Pantalla:** el mapa ocupa todo. Arriba, una barra con tu personaje, vida, energía, experiencia, búsqueda, plata y lo que
  estás haciendo (con «Ficha» para ver todo). Al tocar un lugar se abre encima del mapa (al costado en compu, desde abajo en el
  teléfono). Las pestañas quedan debajo, como menú, mientras todo pasa al mapa.
- **Reloquita** (antes «Recoleta Bien»).
- **Barrios con su contorno real** (de la Ciudad y Florida), pintados del color de la pandilla que los controla; el resto de la
  ciudad con una línea tenue. El zoom es con la ruedita del mouse.

### 5.2b Pestañas
Cinco pestañas con secciones: **Calle** (Trabajos, Misiones, Pelear, Negocios) · **Gimnasio** (Entrenar, Ring) ·
**Mercado** · **Casa** (Tu casa, Equipo, Clínica) · **Ciudad** (Barrios y ranking, Amigos). Las secciones aparecen a
medida que el tutorial las destraba.

### 5.3 Trabajos
**Golpes y encargos son salidas cortas:** el golpe se hace en uno de los 4 barrios más cerca de tu casa y el encargo en el
barrio de la pandilla. Vas caminando si queda a menos de 3 km (si no, lo más barato), con la mitad del viaje de una misión;
1 min para el golpe y 2 para el encargo; el resultado se sabe al hacerlo y después volvés a casa. Volviendo podés encadenar
otro desde donde estás. Los laburos honestos y cobrar los negocios siguen siendo al instante.
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
**Nivel de búsqueda** (antes «calor») de 0 a 100. Lo suben los golpes, los encargos, las peleas en la calle y las misiones. Con calor alto, te detienen en
los golpes y las emboscadas pasan a ser de la policía. El **abogado** baja 40 de calor por `20 + nivel × 8`.

### 5.5 Mercado, equipo e inventario
**Cinco lugares de equipo (estilo RPG):** el equipo **suma a tus atributos** y en la ficha se ve como «Fuerza 13 (+4)».
Las armas (blanca y de fuego) suman fuerza; casco, chaleco y ropa suman dureza; la gorra, reflejos. Esos atributos con el
equipo cuentan en las peleas, en las pruebas de las misiones y en los requisitos. Equivale a lo de antes (arma ÷ 1,6 en
fuerza, protección × 1,4 en dureza). Lo que comprás te lo ponés si el lugar está vacío o es mejor; lo otro va al **bolso**
(Casa › Equipo): entran 4 cosas más lo que dé el armario (+2 / +4 / +8). Desde el bolso te lo ponés, te lo sacás o lo
**vendés** al 40%. Con lo mejor de todo: golpe +23 y protección +23 (igual que antes con dos lugares).

| Lugar | Feria | Mercado negro (por rango) |
|---|---|---|
| Arma blanca | llave +3 ($30), bate +5 ($150), bastón +7 ($350) | manopla +7 (r1, $550), navaja +9 (r2, $1.300) |
| Arma de fuego | revólver 38 +5 (nv 6, $450), pistola 9 mm +8 (nv 10, $1.000) | recortada +11 (r3, $2.200), fusil +14 (r4, $3.600) |
| Cabeza | gorra +1 ($40), casco de moto +3 ($180) | casco antidisturbios +5 (r2, $1.000) |
| Chaleco | chaleco acolchado +4 ($350) | robado a la policía +8 (r3, $1.800), del mercado negro +11 (r4, $2.900) |
| Ropa | campera de cuero +2 ($25) | campera gruesa +5 (r1, $500), con placas +7 (r2, $1.200) |

(Texto viejo de referencia:) 1 arma + 1 protección equipadas. Lo que dejás de usar va al **armario** si hay lugar; si no, se pierde.
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
- **Lo que aprendés:** al salir bien, las misiones de la historia (de pandilla y de la ciudad) dan **+1** al atributo que más
  usan; las del tablón, a veces (Fácil 0%, Normal 8%, Difícil 15%, Jodida 30%); los trabajos largos de 8 h o más, +1.
  El gimnasio sigue siendo la forma principal de subir. Para compensar, los rivales del juego escalan a 1,45 por nivel.

**La valija** (tutorial): 30 min, sin viaje. **Historias de pandilla** (3 por pandilla, en orden, piden rango): 15 / 30 / 45 min de trabajo **más el viaje** (ver §5.7d).

| Pandilla | 1ª (rango 0) | 2ª (rango 2) | 3ª (rango 4) |
|---|---|---|---|
| La Familia | La protección | El blindado | La libreta de la 4ª (vs. Comisaria Ríos) |
| El Sindicato | El paro | La carga del depósito 7 | Fuera del puerto (vs. El Gallego) |
| La Barra | Los trapos | La reventa | El clásico (vs. El Pampa) |
| Los Amarillos | Viaje sin taxímetro | El desarmadero | La picada de la costanera (vs. Don Ramón Ferrante) |

Premios: $150 / $500 / $1.800 · 60 / 180 / 600 XP · 30 / 90 / 300 respeto · +10 / +20 / +35 calor · +10 / +20 / +40 afinidad.

**Tablón de la calle (misiones generadas):** 4 misiones de pandilla a tu nivel (de 1 a 50 y más), una por dificultad, cada una de una
pandilla al azar, **más una de los vecinos, una de la policía (desde nivel 5) y hasta dos de tus negocios** (ver abajo). Se arman combinando **12 barrios de Maires** (La Bocota, Puerto Mareo, San Telmón, Palermo Soja,
Villa Crespa, Barrancas, Florida Vieja, Once y Medio, Mataderos, Reloquita, Liniers Sur, Pompeya Chica), **6 objetivos
por pandilla**, etapas por atributo y un rival (pandillero o policía): cientos de combinaciones. Se renueva cada 6 horas o
pagando 2 de energía.

| Dificultad | Duración | Energía | Pide (atributo principal) | Paga | Afinidad | Sale bien (bot) |
|---|---|---|---|---|---|---|
| Fácil | 8 min + viaje | 4 | 55% de lo típico a tu nivel | ×1,0 | +2 | ~93% |
| Normal | 15 min + viaje | 6 | 70% | ×1,15 | +3 | ~79% |
| Difícil | 25 min + viaje | 8 | 85% | ×1,3 | +5 | ~63% |
| Jodida | 40 min + viaje | 10 | 100% | ×1,5 | +8 | ~34% |

Paga por energía: `(10 + 2,4 × nivel) × multiplicador` de plata y `(3 + 0,55 × nivel) × multiplicador` de XP.

**Otros clientes del tablón:**
- **Vecinos** (gente que no es de nadie: Doña Elsa del almacén, el Turco del cambio, un diputado que perdió el perro, el
  cura de la parroquia…; 10 pedidos): pagan igual, **+15% de XP, la mitad de respeto y de calor**. No suman afinidad ni territorio.
- **La policía: trabajo sucio** para el **comisario Funes** (desde nivel 5; 7 pedidos, como plantar evidencia en un
  aguantadero o marcar un escondite para un allanamiento): paga ×0,9, **te baja el calor** (el doble del calor que daría
  esa dificultad) y **perjudica a una pandilla** (nunca la tuya): pierde 2 / 4 / 6 / 10 de influencia en ese barrio y esa
  misma afinidad con vos. Si le tenías afinidad, corre el rumor de que alguien pasa datos.
- **Tus negocios** (§5.9b): 4 pedidos por negocio, algunos con **viaje al interior**. Pagan ×1,1 (×1,6 de plata y ×1,3 de XP
  si son en el interior). No suman afinidad.

**Trabajos largos en el conurbano:** 4 en el tablón, de **2, 4, 8 y 12 horas** (más el viaje), para cuando no vas a estar.
6 etapas repartidas en el turno (pruebas fáciles, una pelea de madrugada), salen bien con 4 de 6. Energía 6 / 8 / 10 / 12.
Pagan `(10 + 2,4 × nivel) × (6 + 3 × horas)` de plata (12 h: 42 energías de misión por 12 de energía), +2 de respeto y
+1 de afinidad por hora. La energía se sigue cargando mientras tanto, hasta el tope.

### 5.7c Historias de la ciudad (el mismo hecho, desde cada bando)
- Cada historia tiene **3 capítulos en orden**. Cada capítulo tiene **5 versiones**: una por pandilla y una para la policía
  corrupta (Funes). Es el mismo hecho contado desde cada lado.
- **Se elige bando por capítulo:** cuando una versión sale bien, las otras de ese capítulo se cierran. El capítulo siguiente
  se abre cuando terminás el anterior, desde el bando que sea (podés cambiar de bando entre capítulos).
- Los capítulos todavía cerrados no muestran su nombre ni sus misiones.
- Premio: el del capítulo; afinidad con ese bando **+10 / +20 / +30** e influencia **+4 / +6 / +10** en el barrio. Desde la
  policía: 80% de la plata, sin afinidad, y **−20 / −30 / −40 de calor**.

| Historia | Capítulo 1 | Capítulo 2 | Capítulo 3 |
|---|---|---|---|
| **La semana del clásico** (Bocota Juniors vs. Ríver Plateado) | Trapos y apuestas · La Bocota · rango 0 · 15 min | El árbitro · Villa Crespa · rango 1 · 30 min | La revancha en Rosarito · **interior** · rango 2 · 45 min |
| **El Río Bravo** (un contenedor sin declarar con los libros del intendente) | Llega el barco · Puerto Mareo · rango 1 · 15 min | Lo que había adentro · Barrancas · rango 2 · 30 min | El intendente · Reloquita · rango 3 · 45 min |

Pruebas: dificultad 6 / 10 / 15 (clásico) y 8 / 13 / 19 (Río Bravo); piden esa dificultad +1 y esa misma en los dos atributos.
Premios: clásico $200 / $600 / $1.500; Río Bravo $400 / $1.100 / $2.600 (con XP, respeto y calor en proporción).

### 5.7d Viajes y GPS

**Tu casa es tu guarida:** todos los viajes salen de tu casa. Al terminar algo (misión, curarte, salir a buscar a alguien)
**volvés a casa**, y la vuelta se ve en el mapa. **Mientras volvés podés arrancar otra misión o ir a curarte desde donde
estás:** el camino se calcula en el momento por las cuadras (OpenStreetMap), así que distancias y tiempos son dinámicos.
Desde la calle no hay subte ni tren. Volviendo no se puede entrenar, construir ni mudarse (eso, en casa).

**Solo te pueden tocar en la calle:** las emboscadas de los pandilleros del juego, los cruces y salir a buscar a alguien
pasan solo mientras viajás o volvés. En tu casa, adentro de un lugar o curándote, nadie te toca.

**Curarte (pestaña Clínica):**
- **Guardia** de un hospital público (Argerico, Ramos Mejido, Fernandito, Penita, Santojanito, Rivadavio, de Barrancas,
  Central de San Isidrón, Fiorito Chico, Posadito): gratis, vas **caminando** (o en colectivo si es lejos) a la más cercana
  y esperás (hasta 15 min según lo que te falte). Volvés caminando.
- **Clínica privada** (Sanatorio Reloquita, Clínica Palermo Soja, Clínica del Puerto, Sanatorio de la Costa): pagás
  `$0,25 × vida que falta + $15`, te busca una **ambulancia** (45 km/h), 2 min de atención, y la ambulancia te deja en casa.
- Desde que salís hasta que te dan el alta **nadie te puede tocar**; en ambulancia, tampoco a la vuelta.
- El **botiquín** sigue siendo al instante.
- Cada misión pasa en un lugar. Tu personaje **sale de la pensión** (San Telmón), **viaja**, hace el trabajo y **vuelve**.
  La misión dura `ida + trabajo + vuelta`. Las etapas se resuelven mientras estás en el lugar.
- **GPS:** mapa real (OpenStreetMap, estilo oscuro de CARTO) con el recorrido y tu personaje moviéndose. Dice cuántos km
  faltan y en cuántos minutos llegás. Los recorridos son reales: calles para autos y colectivos, veredas a pie, y las vías
  de verdad del subte (líneas A, B, C, D) y los trenes (Mitre, Sarmiento, Roca), calculados una vez con `tools/geo/build.py`.
- **Conurbano:** Zona Norte (Tigre Mojado, San Isidrón, Pilar de Oro), Zona Sur (Avellanada, Lomas de Zafarrancho,
  Quilmates) y Zona Oeste (Moronga, La Matancera, Moreno del Fondo), con trenes reales (Mitre, San Martín, Roca, Sarmiento).
  Ahí pasan los trabajos largos. A pie solo se puede ir a lo que está a menos de 20 km.
- **Los barrios son lugares reales con nombre de parodia** (La Bocota = La Boca, Puerto Mareo = Puerto Madero,
  San Telmón = San Telmo, etc.). **Interior:** La Plata Dulce, Rosarito, Mar del Plato y Cordobita.
- El viaje se comprime: en la ciudad, 1 minuto de verdad son 4 de viaje; en la ruta (más de 50 km), 8.

| Medio | Velocidad | Costo (ida y vuelta) | Dónde | Riesgo en cada tramo |
|---|---|---|---|---|
| A pie | 5 km/h | gratis | ciudad | 3%: te afanan 3% de lo que llevás |
| Colectivo | 14 km/h + espera | $2 | ciudad | 6%: punga, 5% de lo que llevás |
| Subte y tren | 30 (subte) · 40 / 60 (tren) km/h + caminar | $1 por tramo (larga distancia: $0,05/km) | donde hay línea | 4%: punga, 4% |
| Taxi / remís | 25 km/h (85 en ruta) | $2,5/km (**gratis para Los Amarillos**) | todos | 8%: el taxista es buchón, +4 de calor (Amarillos: nunca) |
| Micro de larga distancia | 70 km/h + 20 min | $0,1/km | interior | con 30+ de calor, 10%: Gendarmería, +5 de calor |
| Tu moto (nivel 15) | 32 km/h (100 en ruta) | nafta $0,15/km | todos | te ven llegar (+1 de calor); 12% control: multa `15 + nivel × 5` (con 40+ de calor te reconocen: doble y +6 de calor) |
| Tu auto (nivel 25) | 28 km/h (110 en ruta) | nafta $0,3/km | todos | igual, 10% de control |

Arreglos: **motor preparado** (+25% de velocidad; moto $2.500, auto $6.000), **papeles en regla** (la mitad de controles;
$1.500 / $3.000), **vidrios polarizados** (solo auto, $4.000: no te ven llegar y en los controles no te reconocen).

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

**El mapa (siempre arriba):** personajes estilo RPG Maker que caminan mirando para donde van (el tuyo, más grande, con
«Vos»), botones de zoom, Ctrl + rueda (o dos dedos) para moverlo sin que se coma la página, «Seguirme» para que la cámara te
siga, y cuántos hay en línea y en la calle.

**Peleas en el mapa, como las del mapamundi del Monkey Island:**
- El mapa muestra en vivo a todos los que andan en la calle: en una misión (a dónde van y en qué, no qué misión es) o
  buscando a alguien.
- **Salir a buscar a alguien:** al tocar a un rival que está en una misión, el juego calcula si lo alcanzás saliendo
  ahora desde tu casa, **por las cuadras** (el camino real de OpenStreetMap; se dibuja en el mapa): corriendo (9 km/h), en taxi (25 km/h, $2,5/km ida y vuelta, gratis para Los Amarillos) o en tu
  moto o tu auto. Si lo cruzás en menos de 30 minutos, salís (3 de energía) y quedás ocupado hasta volver; la pelea pasa
  sola a la hora del cruce. Si no llegás, no salís y no pasa nada. Si mientras tanto abandona la misión, «ya no estaba».
  Mismos límites: no a tu pandilla, no a alguien con más de 3 niveles menos, a la misma persona una vez por hora.
- **Cruces casuales:** al salir a una misión, si tu recorrido pasa a menos de 150 m de un rival (de otra pandilla o
  suelto, con no más de 5 niveles de diferencia) al mismo tiempo, se arma la pelea ahí. Sin gastar energía.
- Las peleas se avisan en vivo (con la pelea entera) y quedan en la crónica.

### 5.8a Vecinos que juegan solos (bots)
- 8 vecinos (Tincho Ferreyra, La Colorada Paz, Pocho Benítez, Yésica Ramos, Nacho del Once, Juanca Godoy, Lali Torres,
  El Chino Acuña), dos por pandilla, de nivel 3 a 9. Son jugadores con las mismas reglas: suben de nivel, entrenan,
  compran, hacen misiones (con viaje), compran negocios, salen a buscar gente y se anotan en el torneo del Ring.
- Cada uno tiene su horario (en hora de Argentina) y su carácter (unos salen a buscar pelea más que otros). Despiertos,
  entran cada 2 a 7 minutos y hacen un par de cosas; antes de dormir salen a un trabajo largo.
- Aceptan solicitudes de amistad y misiones de a dos (si están despiertos y tienen energía). Aparecen «en línea» cuando
  están despiertos. Llevan la marca **vecino** en el ranking, en La calle, en Amigos y en el mapa.
- No se puede entrar con sus cuentas. Se apagan con la variable `BOTS=0` en el servidor.

### 5.8b Territorio (pestaña Ciudad)
- **12 barrios:** La Bocota, Puerto Mareo, San Telmón, Palermo Soja, Villa Crespa, Barrancas, Florida Vieja, Once y Medio,
  Mataderos, Reloquita, Liniers Sur y Pompeya Chica. Barrio de cada pandilla: Familia → Puerto Mareo, Sindicato →
  Barrancas, Barra → La Bocota, Amarillos → Once y Medio.
- **Influencia:** cada barrio tiene la de las cuatro pandillas. Se gana trabajando para una:

| Qué | Influencia | Para quién | Dónde |
|---|---|---|---|
| Misión de calle | +1 / +2 / +3 / +5 (según dificultad) | la pandilla que la da | su barrio |
| Misión de la historia | +5 / +8 / +12 | esa pandilla | su barrio |
| Misión de a dos | +4 | la pandilla de la misión | su barrio |
| Encargo (sale bien) | +1 | esa pandilla | su barrio |
| Golpe (sale bien) | +1 | tu pandilla | un barrio al azar |
| Pelea ganada en la calle | +2 | tu pandilla | el barrio de la pandilla del rival |

- Se gasta: **pierde la mitad por semana**. Cada pandilla tiene además una presencia fija de personajes del juego (30 en su barrio, 8–12 en algunos otros).
- **Dueño:** la pandilla con más influencia, si tiene al menos 10 y no está empatada; si no, **en disputa**.
- **Premio:** cada barrio de tu pandilla te da **+2% de plata** en golpes, encargos y misiones.

### 5.8c Torneo del Ring (temporada mensual)
- **Temporada = un mes.** Te anotás gratis desde la pestaña Ring cuando quieras (después del tutorial); sumás desde la ronda siguiente.
- **Una ronda por día**, a las 21 h de Argentina (00:00 UTC): 28 a 30 rondas por mes. **Tiempo humano:** nadie tiene que estar
  conectado; la pelea se resuelve sola con tus atributos y tu equipo, con la vida llena y quién pega primero al azar. El resultado queda en la crónica.
- **Formato suizo:** se empareja por puntos, al azar entre los que van igual y sin repetir rival. Si sobra uno, pasa de ronda (+1 punto).
  Desempate: suma de puntos de tus rivales (Buchholz), después nivel.
- **Mínimo 8 boxeadores:** si hay menos inscriptos se completa con boxeadores del barrio de nivel parecido.
- **Premios al cerrar el mes:** 1º nivel×$300 y +100 de respeto; 2º nivel×$200 y +60; 3º nivel×$120 y +40; el resto +10 por participar.
- **Historial:** tu puesto de cada mes queda guardado para siempre, y la pestaña muestra los últimos campeones.

### 5.9b Negocios y garaje (pestaña Negocios)
Negocios: dejan plata por hora aunque no estés; hay que pasar a **cobrar** (junta hasta 24 horas). Cada negocio suma misiones al tablón.

| Negocio | Nivel | Precio | Por hora | Se paga solo en | Extra |
|---|---|---|---|---|---|
| Maxikiosco 24 horas (Once y Medio) | 4 | $2.500 | $25 | 100 h | |
| Licencia de taxi (San Telmón) | 8 | $6.000 | $50 | 120 h | misión a Mar del Plato |
| Plantación en una terraza (Palermo Soja) | 12 | $12.000 | $110 | 109 h | +2 de calor por cobro; misión a Rosarito |
| Lavadero de autos (Barrancas) | 16 | $22.000 | $180 | 122 h | misión a La Plata Dulce |
| Taller mecánico (Mataderos) | 20 | $35.000 | $260 | 135 h | arreglos del garaje 30% más baratos; misión a Cordobita |
| Boliche en Palermo Soja | 25 | $60.000 | $420 | 143 h | misión a Mar del Plato |

Garaje: **moto** desde nivel 15 ($6.000) y **auto** desde nivel 25 ($25.000), con los arreglos de §5.7d.

### 5.9 La casa
**Mudarte:** arrancás en una pieza de pensión (San Telmón). Cada casa queda en un barrio (de ahí salen tus viajes) y deja
mejorar la cama, la caja fuerte y el armario hasta cierto nivel:

| Casa | Barrio | Nivel | Precio | Mejoras hasta |
|---|---|---|---|---|
| Pieza de pensión | San Telmón | 1 | gratis | nivel 1 |
| Departamento de un ambiente | Once y Medio | 6 | $4.000 | 2 |
| PH con terraza | Villa Crespa | 10 | $10.000 | 3 |
| Casa con patio | Barrancas | 15 | $25.000 | 4 |
| Chalet con pileta | San Isidrón (Zona Norte) | 22 | $60.000 | 5 |
| Mansión | Reloquita | 28 | $120.000 | 5 |

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
- **Más misiones escritas** por pandilla (rangos 1, 3 y 5); más objetivos y barrios para el generador; misiones diarias.
- **Guerras entre pandillas** y eventos (el clásico, un paro general, una redada policial).
- Rango propio dentro de la pandilla, títulos por pandilla, chat de pandilla.
- Consecuencias al cambiar de pandilla (por ejemplo, la anterior te marca como traidor por un tiempo).

### Casa
- Más partes: **bolsa de boxeo** (entrenar más rápido), **cocina** (botiquines caseros), **garaje** (trabajos con auto),
  **guardaespaldas** (defensa al ser atacado), decoración que suma respeto.
- Mudanzas: de la pieza de pensión a un departamento, una casa, un chalet.

### Contenido y sistemas
- **Más historias de la ciudad** (hay 2, de 3 capítulos y 5 bandos cada una) y más pedidos de vecinos, de Funes y de cada negocio.
- GPS: que el personaje quede donde terminó (hoy siempre vuelve a la pensión), más líneas de colectivo con recorrido propio,
  ver en el mapa a los amigos que están en una misión, mudarse de barrio.
- Garaje: más vehículos (camioneta, lancha por el río), robos de autos, persecuciones.
- Fin de juego (equipo nivel 5+, trabajos y ring para niveles 15–30), nivel máximo o reinicio.
- Turno largo (como el cementerio de BiteFight); el sistema de "ocupado" ya está listo.
- Informes de pelea y revancha; mensajes entre jugadores; logros.
- Música y sonido (hay música CC0 en los assets); más retratos; cambiar el avatar.

### Infraestructura
- Plan pago de Render si hay muchos jugadores; vigilar horas gratis de Neon; copias de seguridad; repo privado.
