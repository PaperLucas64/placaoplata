# El mundo de Malandro: de Capital al país entero

Documento de diseño para revisar entre Lucas y Tomi **antes** de escribir código. Nada de esto está hecho todavía.
Las decisiones de Lucas del 19/10/2026 ya están incorporadas; lo que sigue abierto está marcado como **A decidir**.

## La idea en una frase

Malandro pasa de ser «Capital con un mapa» a ser **la Argentina como un mundo abierto en tiempo real**:
tu personaje está en un lugar, viaja de verdad (tarda lo que tarda en la vida real) y en el camino le aparecen
cosas para hacer cerca de donde está. Las ciudades son de la pandilla que más trabaja en ellas.

## Reglas que no se discuten

1. **El tiempo es real, 1 a 1.** Si caminar de Martínez a Capital lleva 4 horas, en el juego lleva 4 horas.
   Hoy el viaje está comprimido (en la ciudad, 1 minuto real son 4 de viaje; en la ruta, 8): eso se va.
2. **Se respeta la realidad del transporte.**
   - **Dentro de una ciudad** (y su conurbano): a pie, colectivo, subte o tren urbano donde exista, taxi, moto o auto.
   - **Entre ciudades no se camina.** Hace falta auto o moto propios, o un viaje de larga distancia:
     **micro, tren o avión, solo donde existan de verdad** (las líneas de tren y los vuelos que hay en el país).
3. **Nombres reales para todos los lugares** (decidido): Maires pasa a ser **Buenos Aires** y los 34 barrios van con su nombre de verdad
   (ver la tabla del final). Lo mismo para provincias, ciudades y pueblos.
   **Ninguna persona real ni marca real:** las empresas de micros, trenes y aviones, los clubes y los comercios van con nombres inventados o genéricos.

## Lo que hay hoy

- **Mapa:** Capital Federal con 34 barrios de nombre paródico (`packages/shared/src/geo-data.ts`, generado por `tools/geo/capital.py`).
  Cada barrio ya guarda su nombre real (`real`), así que el cambio de nombres es directo.
- **Recorridos reales:** por las cuadras de OpenStreetMap; el servidor se los pide a OSRM. El subte tiene sus líneas reales (`subte.json`).
- **Medios:** a pie, colectivo, subte y tren, taxi, micro de larga distancia, moto, auto (y la ambulancia para curarte).
- **Un solo casillero de «lo que estás haciendo»** (`busy` en `types.ts`): una misión, un golpe, entrenar, la guardia o volver a casa.
- **Energía:** 40 de máximo, +1 cada 1,5 min (la barra se llena en 1 hora). Caminar gasta 1 por km.
- **Vivienda:** arrancás gratis en una pieza de pensión y te podés comprar una casa (depto, PH, casa, chalet, mansión) con cama, caja fuerte y armario.
- **Territorio:** cada misión y golpe suma puntos a tu pandilla en ese barrio; los puntos pierden la mitad por semana (`TURF_HALF_LIFE`) y,
  por debajo de un mínimo (`TURF_MIN`), el barrio no es de nadie. **Es casi exactamente el sistema que se quiere para las ciudades.**

## El modelo nuevo

### 1. Tu personaje está en un lugar

- El estado guarda **dónde estás** (un punto del mapa y la ciudad). Ya no volvés a casa después de cada cosa:
  te quedás donde terminaste hasta que decidas ir a otro lado.
- Dónde dormís depende de dónde estés (ver **Vivienda**).

### 2. Vivienda: hostel, guarida o casa (en todas las ciudades, Buenos Aires incluida)

| Dónde | Cuánto cuesta | Qué te da | Qué no |
|---|---|---|---|
| **Hostel** | Pagás **por día**, como una posada. Cada ciudad tiene su precio. | Una cama (recarga normal de energía) y un lugar donde volver. Sirve para cualquiera, en cualquier ciudad. | Sin caja fuerte: la plata que tenés encima se puede perder. |
| **Guarida de tu pandilla** | Gratis, si sos de una pandilla y la pandilla tiene guarida en esa ciudad. | Un techo y la gente de tu pandilla cerca. | **No podés hacer golpes grandes** ni lo que pida una base propia. Sin caja fuerte. |
| **Casa propia** | Cara. **Una por ciudad** como máximo. | Todo lo de hoy (cama que da energía, caja fuerte, armario) y **lo que solo da una casa**: golpes grandes, guardar botín, recibir a tu gente. | — |

- **La pieza de pensión gratis de hoy se convierte en hostel:** se paga por día. Hay que medir con el bot cuánto pesa el gasto diario al principio
  (no puede ahogar al que recién llega: quizás los primeros días los paga Marga).
- **Si no podés pagar el hostel** y no tenés guarida: **A decidir** (dormir en la calle con menos energía y riesgo de que te roben, o quedar debiendo).
- **A decidir:** la lista exacta de «golpes grandes» que piden casa (propuesta: los de riesgo alto y los que dejan botín para guardar).

### 3. Viajar y hacer cosas son dos cosas distintas

- Se separan **el viaje** (de dónde, a dónde, en qué, cuándo llegás, por dónde pasás) y **las actividades** en un lugar (una misión, un golpe, un encargo).
- **Hasta 3 misiones aceptadas a la vez** (decidido). Cada una avanza cuando estás en su lugar.
- **En el viaje hay paradas (checkpoints) y eventos** (decidido):
  - **paradas:** terminales del micro, estaciones del tren, o donde pares con tu auto. Ahí se miran las oportunidades cercanas y podés bajarte;
  - **eventos** entre parada y parada: un control de Gendarmería, alguien que te ofrece un trabajo, un robo en el micro, un corte de ruta.

### 4. Las misiones aparecen por cercanía

- No hace falta que haya misiones en todos lados: **aparecen cerca de donde estás**.
- **Radio según cómo te movés:** a pie, unas cuadras; en auto, la ciudad; en ruta, la próxima parada.
- **Las ciudades grandes tienen más** (y mejor paga, y más policía); los pueblos, pocas pero raras.
- Las misiones de calle ya se generan solas para cualquier lugar (`streetMission` en `missions.ts`): se usan las mismas, con el lugar de cada ciudad.
- La historia escrita sigue por **arcos**: hoy «Arco Capital Federal»; el próximo, el de la Provincia de Buenos Aires.

### 5. Larga distancia

| Medio | Dónde | Cómo funciona |
|---|---|---|
| **Auto / moto propios** | Cualquier ruta | Salís cuando querés; el recorrido es el real (OSRM). Gastás nafta (plata). Parás donde quieras. Controles de Gendarmería, como hoy. |
| **Micro** | Entre ciudades con terminal | Vas a la terminal, sale con horario, para en las terminales del camino y llegás a la terminal de destino. Barato. |
| **Tren** | **Solo las líneas que existen** | Como el micro, pero solo entre las estaciones reales. Hay que relevar las líneas vigentes. |
| **Avión** | Entre ciudades con aeropuerto y vuelos regulares | Lo más rápido y lo más caro. Hay que llegar al aeropuerto antes y esperar. |

- **Tiempos de referencia** (aproximados, a confirmar con el ruteo): Martínez a Capital a pie, unas 4 horas;
  Buenos Aires a Mar del Plata en micro, unas 5 o 6 horas; Salta a Rosario en micro, unas 15 horas.
- Bajarte en una parada te deja ahí: para seguir, tomás el próximo micro o lo que haya.

### 6. Energía y ritmo

- **Caminar sigue costando 1 de energía por km**, pero solo existe dentro de la ciudad, así que no hay caminatas imposibles.
- **La larga distancia cuesta plata, no energía.** La energía se recarga mientras viajás: el viaje largo es el momento de cerrar el juego y volver.
- **Con tiempo real todo se estira** (una misión de Capital puede pasar de 20 minutos a más de 1 hora). Se mide con el bot (`tools/playthrough.ts`)
  y se ajusta `docs/BALANCE.md`.

### 7. Las ciudades se toman (como los gimnasios de Pokémon)

- **Cada ciudad tiene su círculo de color**: el de la pandilla que la controla, o gris si no es de nadie.
- **Puntos por lo que se hace en la zona:** cada misión, golpe, choreo o pelea ganada en una ciudad le suma puntos a la pandilla del que lo hizo.
  Da igual de qué color sea la misión: cuenta para tu pandilla. Gana la ciudad la pandilla con **más porcentaje** de los puntos.
- **Si nadie hace nada, se pierde:** los puntos bajan con el tiempo (como hoy, la mitad por semana) y, por debajo de un mínimo, la ciudad pasa a ser **de nadie**.
- **Las pandillas locales:** cada ciudad arranca con pandillas del lugar (personajes del juego), repartidas al azar, que también suman puntos.
  **A decidir:** si las pandillas locales son las mismas cuatro de Capital con presencia en el interior, o pandillas propias de cada región.
- **Cómo arranca el mapa:** en lugar de repartir las ciudades al azar, **se simula un año entero con 90 bots** jugando (con el mismo bot de balance,
  en una corrida rápida, sin esperar un año de verdad) y el mapa empieza con el resultado. Después, los vecinos-bot siguen peleando las ciudades
  mientras haya pocos jugadores.

## Lo técnico

- **Ruteo:** por ahora el servidor público de OSRM, porque es todo prueba (Lucas y los bots). Cuando crezca se decide entre un servicio con plan
  gratis o un OSRM propio (unos 4 GB de memoria, servidor pago).
- **Datos que hay que juntar** (de fuentes abiertas, como el resto del mapa): partidos del conurbano y ciudades de la Provincia de Buenos Aires
  (con su tamaño, desde OpenStreetMap), terminales de micro, estaciones de tren y aeropuertos.
- **Partidas guardadas:** cambian los nombres de los barrios y la forma del estado (dónde estás, el viaje, las misiones aceptadas, la vivienda).
  Todo se contempla en `upgradeState` (`rules.ts`). El cambio de nombres también toca la base: territorio, noticias y diario (una migración).
- **El mapa:** las imágenes de OpenFreeMap ya cubren todo el mundo. Lo nuevo son las ciudades, las terminales y las rutas.

## Las etapas

Cada una se puede jugar sola. Antes de pasar a la siguiente se mide con el bot y se prueba.

1. **Nombres reales y tiempo real en Capital.**
   - Maires pasa a Buenos Aires y los barrios a su nombre real, en el mapa, en los textos y en las partidas guardadas.
   - Los viajes duran lo real (fuera la compresión de `TRAVEL_SCALE`). El bot mide el ritmo nuevo.
2. **Vivienda nueva.**
   - La pensión gratis pasa a hostel que se paga por día; la guarida de la pandilla; la casa con lo que solo ella da (golpes grandes).
   - Una casa por ciudad (por ahora, la única ciudad es Buenos Aires).
3. **Tu personaje en un lugar, varias misiones y misiones por cercanía.**
   - El estado guarda dónde estás; el viaje se separa de las actividades; hasta 3 misiones aceptadas.
4. **El Gran Buenos Aires y la Provincia de Buenos Aires** (con la Costa).
   - Los partidos del conurbano y las ciudades de la provincia, con nombre real.
   - Larga distancia (micro, tren, avión, lo tuyo) con paradas y eventos.
   - Las ciudades se toman por puntos, con pandillas locales y el arranque simulado de un año con 90 bots.
   - El arco de historia de la Provincia.
5. **El resto del país**, región por región, con lo mismo.

## A decidir (lo que queda)

1. **Si no podés pagar el hostel** y no tenés guarida: ¿dormís en la calle (menos energía, riesgo de robo) o quedás debiendo?
2. **Qué golpes piden casa propia** (propuesta: los de riesgo alto y los que dejan botín).
3. **Pandillas locales:** ¿las cuatro de Capital con presencia en el interior, o pandillas propias de cada región?
4. **Los hospitales con nombre de persona** (hoy «Hospital Ramos Mejido» y otros): con nombres reales para todo, ¿van con su nombre de verdad
   (los hospitales públicos llevan nombres de personas) o con uno genérico del barrio («Hospital de Balvanera»)? La regla de oro dice
   ninguna persona real: la propuesta es el genérico.

## Los barrios con su nombre real

| Hoy | Pasa a |
|---|---|
| Agromanía | Agronomía |
| Almagrito | Almagro |
| Once y Medio | Balvanera |
| Belgranito | Belgrano |
| Caballote | Caballito |
| Chacarota | Chacarita |
| Coglán | Coghlan |
| Colegas | Colegiales |
| Floreros | Flores |
| Florestita | Floresta |
| Liniers Sur | Liniers |
| Mosecraft | Monserrat |
| Monte Castrito | Monte Castro |
| Ñuñez | Núñez |
| Palermo Soja | Palermo |
| Parque Chau | Parque Chas |
| La Paterna | La Paternal |
| Puerto Mareo | Puerto Madero |
| Reloquita | Recoleta |
| Salida | Retiro |
| Saavedrita | Saavedra |
| San Nicolasito | San Nicolás |
| Vélez Sarsfeel | Vélez Sarsfield |
| Versalles Chico | Versalles |
| Villa Crespa | Villa Crespo |
| Villa del Charque | Villa del Parque |
| Villa Devota | Villa Devoto |
| Villa Mitrecito | Villa General Mitre |
| Villa Lurio | Villa Luro |
| Villa Ortuzán | Villa Ortúzar |
| Villa Puerredón | Villa Pueyrredón |
| Villa Realeza | Villa Real |
| Villa Santa Rata | Villa Santa Rita |
| Villa Urquisa | Villa Urquiza |

(Los barrios que hoy no están, como Boedo, San Telmo o La Boca, se pueden sumar en la etapa 1 si el mapa de barrios los trae.)
