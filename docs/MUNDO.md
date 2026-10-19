# El mundo de Malandro: de Capital al país entero

Documento de diseño para revisar entre Lucas y Tomi **antes** de escribir código. Nada de esto está hecho todavía.
Lo marcado como **A decidir** necesita una respuesta antes de arrancar la etapa que lo usa.

## La idea en una frase

Malandro pasa de ser «Capital con un mapa» a ser **la Argentina como un mundo abierto en tiempo real**:
tu personaje está en un lugar, viaja de verdad (tarda lo que tarda en la vida real) y en el camino le aparecen
cosas para hacer cerca de donde está.

## Reglas que no se discuten

1. **El tiempo es real, 1 a 1.** Si caminar de Martínez a Capital lleva 4 horas, en el juego lleva 4 horas.
   Hoy el viaje está comprimido (en la ciudad, 1 minuto real son 4 de viaje; en la ruta, 8): eso se va.
2. **Se respeta la realidad del transporte.**
   - **Dentro de una ciudad** (y su conurbano): a pie, colectivo, subte o tren urbano donde exista, taxi, moto o auto.
   - **Entre ciudades no se camina.** Hace falta auto o moto propios, o un viaje de larga distancia:
     **micro, tren o avión, solo donde existan de verdad** (las líneas de tren y los vuelos que hay en el país).
3. **Regla de oro de los nombres:** provincias, países y ciudades con su nombre real. Ninguna persona real ni marca real
   (las empresas de micros, trenes y aviones van con nombres inventados o genéricos: «el micro», «el tren», «el avión»).

## Lo que hay hoy

- **Mapa:** Capital Federal con 34 barrios de nombre paródico (`packages/shared/src/geo-data.ts`, generado por `tools/geo/capital.py`).
  El conurbano y el interior ya aparecen en textos (zonas norte, sur y oeste; «Rosarito» en una historia), pero no hay ciudades cargadas.
- **Recorridos reales:** por las cuadras de OpenStreetMap; el servidor se los pide a OSRM. El subte tiene sus líneas reales (`subte.json`).
- **Medios:** a pie, colectivo, subte y tren, taxi, micro de larga distancia, moto, auto (y la ambulancia para curarte).
- **Un solo casillero de «lo que estás haciendo»** (`busy` en `types.ts`): una misión, un golpe, entrenar, la guardia o volver a casa.
  Mientras volvés a casa podés arrancar otra cosa, pero no hay dos misiones a la vez.
- **Energía:** 40 de máximo, +1 cada 1,5 min (la barra se llena en 1 hora). Caminar gasta 1 por km.
- **Tu casa** es el centro: todos los viajes salen de ahí y vuelven ahí.

## El modelo nuevo

### 1. Tu personaje está en un lugar

- El estado guarda **dónde estás** (un punto del mapa y la ciudad). Ya no volvés solo a casa después de cada cosa:
  te quedás donde terminaste hasta que decidas ir a otro lado.
- **La casa sigue existiendo** como base: ahí dormís (la cama da energía), está la caja fuerte y el armario.
  Para usarlos tenés que estar ahí. **A decidir:** ¿se puede tener una casa por ciudad, o una sola?

### 2. Viajar y hacer cosas son dos cosas distintas

- Hoy «viajar a la misión» y «hacer la misión» son lo mismo. Se separan:
  - **el viaje** (de dónde, a dónde, en qué, cuándo llegás, por dónde pasás);
  - **las actividades** que hacés en un lugar (una misión, un golpe, un encargo).
- **Varias misiones a la vez:** podés tener **aceptadas** varias (por ejemplo, hasta 3). Cada una avanza cuando estás en su lugar.
  Así se puede aceptar algo en Rosario, otra en Córdoba, y hacerlas en el orden que te convenga.
- **A decidir:** ¿se puede hacer una actividad **mientras** viajás (por ejemplo, en el micro), o solo en las paradas?
  Propuesta: solo en las paradas y al llegar; en el viaje pasan **eventos** (controles, alguien que te ofrece algo, un robo).

### 3. Las misiones aparecen por cercanía

- No hace falta que haya misiones en todos lados: **aparecen cerca de donde estás**.
- **Radio según cómo te movés:** a pie, unas cuadras; en auto, el barrio o la ciudad; en ruta, el próximo pueblo o la próxima terminal.
- **Las ciudades grandes tienen más** (y mejor paga, y más policía); los pueblos, pocas pero raras.
- Las misiones de calle ya se generan solas para cualquier lugar (`streetMission` en `missions.ts`): se usan las mismas, con el lugar de cada ciudad.
- La historia escrita sigue por **arcos**: hoy «Arco Capital Federal»; después, un arco por región (**A decidir** cuál primero).

### 4. Larga distancia

| Medio | Dónde | Cómo funciona |
|---|---|---|
| **Auto / moto propios** | Cualquier ruta | Salís cuando querés; el recorrido es el real (OSRM). Gastás nafta (plata). Parás donde quieras. Controles de Gendarmería, como hoy. |
| **Micro** | Entre ciudades con terminal | Vas a la terminal de tu ciudad, sale con horario (por ejemplo, cada pocas horas), para en las terminales del camino y llegás a la terminal de destino. Barato. |
| **Tren** | **Solo las líneas que existen** en el país | Como el micro, pero solo entre las estaciones reales. Más barato y a veces más lento. Hay que relevar las líneas vigentes. |
| **Avión** | Entre ciudades con aeropuerto y vuelos regulares | Lo más rápido y lo más caro. Hay que llegar al aeropuerto antes y esperar. |

- **Tiempos de referencia** (aproximados, a confirmar con el ruteo):
  - Martínez a Capital, a pie: unas 4 horas.
  - Buenos Aires a Rosario, en micro: unas 4 horas.
  - Salta a Rosario, en micro: unas 15 horas.
  - Buenos Aires a Salta, en avión: unas 2 horas de vuelo, más el viaje al aeropuerto y la espera.
- **Paradas:** en cada parada del micro (o donde pares con tu auto) se miran las oportunidades cercanas.
  Bajarte en una parada te deja ahí: para seguir, tomás el próximo micro o lo que haya.

### 5. Energía y ritmo

- **Caminar sigue costando 1 de energía por km**, pero ahora solo existe dentro de la ciudad, así que no hay caminatas imposibles.
- **La larga distancia cuesta plata, no energía.** La energía se sigue recargando mientras viajás, y llegás con la barra llena:
  el viaje largo es el momento de cerrar el juego y volver después.
- **Con tiempo real, todo se estira:** una misión en Capital que hoy lleva 20 minutos puede llevar 1 hora o más.
  Para un juego que se juega en ratitos varias veces por día está bien, pero hay que medirlo con el bot (`tools/playthrough.ts`)
  y revisar `docs/BALANCE.md` (energía por día, cuánto tarda la historia).

### 6. Pandillas y territorio

- Las cuatro pandillas son de Capital. **A decidir:** en el interior, ¿hay pandillas locales, las de Capital se expanden,
  o el interior es tierra de nadie (solo la policía y los personajes del lugar)?
- El territorio (barrios con el color de quien manda) hoy es solo de Capital. Se puede extender a ciudades enteras como una unidad.

## Lo técnico

- **Calcular los caminos de todo el país.** El OSRM que usamos hoy es el servidor público de prueba: no está pensado para un juego en producción.
  - **Opción A:** un servicio de ruteo con plan gratis y límite diario (alcanza para empezar con pocos jugadores).
  - **Opción B:** nuestro propio OSRM con el mapa de Argentina. Necesita unos 4 GB de memoria: un servidor pago, aparte del de Render.
  - Se puede empezar con A y pasar a B si crece.
- **Datos que hay que juntar** (de fuentes abiertas, como el resto del mapa):
  - ciudades y pueblos, con su tamaño, desde OpenStreetMap;
  - terminales de micro y aeropuertos;
  - las líneas de tren de larga distancia que funcionan hoy, y los vuelos regulares entre ciudades.
- **Partidas guardadas:** el estado cambia de forma (dónde estás, el viaje, las misiones aceptadas). Se contempla en `upgradeState` (`rules.ts`):
  a todos los que ya juegan se los ubica en su casa.
- **El mapa:** las imágenes de OpenFreeMap ya cubren todo el mundo. Lo nuevo son las ciudades, las terminales y las rutas.

## Las etapas

Cada etapa se puede jugar sola, y antes de pasar a la siguiente se mide con el bot y se prueba entre amigos.

1. **Tiempo real en Capital y el conurbano.**
   - Los viajes pasan a durar lo real (fuera la compresión de `TRAVEL_SCALE`).
   - Se cargan las ciudades del conurbano (Martínez y compañía) y se camina solo dentro de la ciudad.
   - El bot mide cómo cambia el ritmo y se ajusta `docs/BALANCE.md`.
2. **Tu personaje en un lugar, misiones por cercanía y varias a la vez.**
   - El estado guarda dónde estás; el viaje se separa de las actividades.
   - Las misiones aparecen cerca de donde estás y podés tener varias aceptadas.
   - La casa pasa a ser la base (cama, caja fuerte, armario), no el punto de partida obligado.
3. **El país.**
   - Ciudades y pueblos reales, terminales, aeropuertos y las líneas de tren que existen.
   - Larga distancia en micro, tren, avión o con lo tuyo, con paradas y oportunidades en el camino.
   - El primer arco de historia fuera de Capital.

## A decidir (todo junto)

1. **Maires y los barrios:** con la regla de oro, ¿Maires pasa a llamarse Buenos Aires? ¿Los barrios siguen con nombre paródico
   (Almagrito, Reloquita…) o van con su nombre real? (Pendiente desde antes.)
2. **¿Una casa por ciudad o una sola?**
3. **¿Se hace algo mientras viajás, o solo en las paradas y al llegar?** (Propuesta: solo en paradas; en el viaje, eventos.)
4. **¿Cuántas misiones aceptadas a la vez?** (Propuesta: 3.)
5. **Pandillas en el interior:** locales, las de Capital que se expanden, o tierra de nadie.
6. **El primer lugar fuera de Capital:** ¿Rosario, La Plata, Córdoba, la Costa?
7. **Ruteo:** ¿empezamos con un servicio gratis con límite (opción A)?
