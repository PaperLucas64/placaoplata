# Malandro — Modo historia

> **Temporada 1 · Arco Capital Federal — Episodio 01: «Los inicios»**
> Estado: las **60 misiones de los cuatro jefes están escritas y en el juego** (`packages/shared/src/historia.ts`). Los 8 contactos vienen después.

## 1. Lo que se decidió

1. **Temas:** la herencia (Familia), el diario (Sindicato), el clásico (Barra) y la aplicación de autos (Amarillos). Después del final de Rita, **Vamo se puede comprar** como negocio: nivel 20, $90.000, deja $650 por hora.
2. **Se pueden jugar las cuatro historias**, salvo la misión 15 (el final del capítulo), que es solo para la pandilla de la que sos.
3. **Los 8 contactos** quedan como estaban en la propuesta.
4. **El villano oculto es Marga**, la dueña del bar La Esquina: la que te recibe en el tutorial y te consigue la pieza.
   - Nadie la nombra. Las cuatro historias la van rozando: la Fundación La Esquina, los chalecos violetas, el «2027», el café con leche, la letra redonda de maestra y la foto de 1987.
   - Al final de cada capítulo queda claro que se quiere postular a intendenta. Eso es el gancho del Episodio 02.
   - El rival de la barra se llama **el Pelado Salvedad**.
5. **Duraciones:**
   - El tiempo de la misión empieza **cuando llegás**. El viaje va aparte: primero dice «llegás en X» y después corre la cuenta regresiva.
   - Las primeras son cortas, para que el que recién empieza juegue varias seguidas y aprenda.
   - Después se alargan:

| Acto | Misiones | Duración en el lugar | Rango |
|---|---|---|---|
| I · Mandadero | 1 a 5 | 5 a 20 min | desde el tutorial |
| II · De confianza | 6 a 10 | 1 a 4 horas | Soldado |
| III · Mano derecha | 11 a 14 | 4 a 8 horas | Puntero |
| Final del capítulo | 15 | 18 horas | Puntero, y ser de esa pandilla |

6. **El diario de la Crónica:**
   - La Crónica tiene dos solapas: **Diario** y **Lo último**.
   - El diario es el episodio, dividido en un capítulo por jefe, y cada capítulo en sus 15 misiones, agrupadas en tres actos.
   - Cada misión hecha destraba su **bloque de lore**, con la fecha y la hora reales en que la hiciste, cómo te fue (cuántas etapas salieron bien) y la historia.
   - Cada página anota también **qué pasaba en la ciudad en ese momento**: tres noticias reales de otros jugadores («Mientras tanto, en Maires: Malickud robó un kiosco en Floreros…»).
   - Las misiones que faltan aparecen como páginas en blanco. De la que sigue se ve el título.

## 2. Premios

Pagan por energía, como el resto del juego, para no romper el ritmo. El balance está medido con el bot de `tools/balance.test.ts`. Las de muchas horas pagan más en total, pero no más por energía. Algunas misiones enseñan algo: dan +1 a un atributo (la 3, 5, 8, 10, 12 y 14) y la final da +2.

## 3. Las 60 misiones

### La Familia — Elvira «La Señora» Santoro · «La herencia»

| # | Misión | Dónde | Dura | Energía |
|---|---|---|---|---|
| 1 | El sobre | Mosecraft | 5 min | 5 |
| 2 | La cuota | Belgranito | 8 min | 6 |
| 3 | Carga sin papeles | Puerto Mareo | 12 min | 6 |
| 4 | El contador | San Nicolasito | 15 min | 7 |
| 5 | La libreta | Puerto Mareo | 20 min | 8 |
| 6 | Sangre nueva | Palermo Soja | 1 h | 10 |
| 7 | La subasta | Reloquita | 1 h 30 | 10 |
| 8 | Doble fondo | La Paterna | 2 h | 11 |
| 9 | La cena | Puerto Mareo | 3 h | 12 |
| 10 | Una página menos | Puerto Mareo | 4 h | 12 |
| 11 | El prestamista | Once y Medio | 4 h | 14 |
| 12 | Fuego en el dique | Puerto Mareo | 5 h | 14 |
| 13 | La traición | Chacarota | 6 h | 15 |
| 14 | Recuperar el nombre | Villa Crespa | 8 h | 16 |
| 15 | **La última página** | Puerto Mareo | 18 h | 20 |

### El Sindicato — Don Ramón Ferrante · «Primera plana»

| # | Misión | Dónde | Dura | Energía |
|---|---|---|---|---|
| 1 | El reparto | Chacarota | 5 min | 5 |
| 2 | Paro de brazos caídos | La Paterna | 8 min | 6 |
| 3 | El camión del Faro | Villa Crespa | 12 min | 6 |
| 4 | Canillita | Colegas | 15 min | 7 |
| 5 | La primera plana | Chacarota | 20 min | 8 |
| 6 | El periodista | Villa Ortuzán | 1 h | 10 |
| 7 | La imprenta | Villa Mitrecito | 1 h 30 | 10 |
| 8 | Asamblea | Chacarota | 2 h | 11 |
| 9 | El soplón | Chacarota | 3 h | 12 |
| 10 | Fe de erratas | Villa Mitrecito | 4 h | 12 |
| 11 | Huelga general | San Nicolasito | 4 h | 14 |
| 12 | La lista negra | Chacarota | 5 h | 14 |
| 13 | El dueño del Faro | Almagrito | 6 h | 15 |
| 14 | Última edición | Villa Mitrecito | 8 h | 16 |
| 15 | **Paren las rotativas** | Villa Mitrecito | 18 h | 20 |

### La Barra — El Tano Lucero · «El clásico»

| # | Misión | Dónde | Dura | Energía |
|---|---|---|---|---|
| 1 | El trapo | Floreros | 5 min | 5 |
| 2 | Los trapitos | Ñuñez | 8 min | 6 |
| 3 | La reventa | Ñuñez | 12 min | 6 |
| 4 | El micro | Salida | 15 min | 7 |
| 5 | La interna | Ñuñez | 20 min | 8 |
| 6 | El presidente | Ñuñez | 1 h | 10 |
| 7 | El bombo | Floreros | 1 h 30 | 10 |
| 8 | El jugador | Belgranito | 2 h | 11 |
| 9 | El árbitro | San Nicolasito | 3 h | 12 |
| 10 | Partida | Ñuñez | 4 h | 12 |
| 11 | El estadio | Reloquita | 4 h | 14 |
| 12 | Los papeles | Reloquita | 5 h | 14 |
| 13 | La semana del clásico | Ñuñez | 6 h | 15 |
| 14 | El día antes | Ñuñez | 8 h | 16 |
| 15 | **El clásico** | Ñuñez | 18 h | 20 |

### Los Amarillos — Rita "Taxi" Quiroga · «Bajada de bandera»

| # | Misión | Dónde | Dura | Energía |
|---|---|---|---|---|
| 1 | Viaje sin taxímetro | Almagrito | 5 min | 5 |
| 2 | El desarmadero | Liniers Sur | 8 min | 6 |
| 3 | La radio | Once y Medio | 12 min | 6 |
| 4 | La picada | Puerto Mareo | 15 min | 7 |
| 5 | Vamo | Palermo Soja | 20 min | 8 |
| 6 | Pasajero misterioso | Reloquita | 1 h | 10 |
| 7 | La oficina | Palermo Soja | 1 h 30 | 10 |
| 8 | El servidor | Villa Urquisa | 2 h | 11 |
| 9 | Lo que ven | Almagrito | 3 h | 12 |
| 10 | Bloqueo | San Nicolasito | 4 h | 12 |
| 11 | El comprador | Mosecraft | 4 h | 14 |
| 12 | La flota | Palermo Soja | 5 h | 14 |
| 13 | Choque | Once y Medio | 6 h | 15 |
| 14 | La grabación | Almagrito | 8 h | 16 |
| 15 | **Última bajada** | San Nicolasito | 18 h | 20 |


> El texto completo de cada misión (presentación, etapas, cómo sale bien o mal, peleas y el bloque de diario) está en `packages/shared/src/historia.ts`.

## 4. El hilo de Marga, misión por misión

- **Familia:**
  - la página 47 de la libreta: «M. — La Esquina — no se le cobra»;
  - la deuda de Franco la paga la Fundación;
  - las anotaciones «vota / no vota» con letra de maestra;
  - el cartel «Intendenta» en la vidriera.
- **Sindicato:**
  - el borrador corregido con birome azul;
  - la sede de la Fundación arriba del bar;
  - la foto de 1987, donde la moza escuchó cómo se repartían la ciudad;
  - la tapa violeta que nunca salió: «Elecciones 2027. Ya sabés quién».
- **Barra:**
  - el micro violeta «Recorrida Nacional»;
  - Desarrollos Esquina SA quiere el estadio «después de las elecciones»;
  - el plano de la ciudad pintado de violeta;
  - el volante: «Te esperamos a tomar un café».
- **Amarillos:**
  - Vamo manda los datos a «PADRON_2027» en Almagrito;
  - la voz amable que dice «querido»;
  - la grabación: «Cuando se peleen todos, yo les voy a ofrecer un café».

## 5. Los 8 contactos (misiones de 4, al estilo Lester) — próximo paso

Aparecen como **contactos en el mapa** cuando cumplís su condición. Cada historia es corta, con un tono propio y un premio único: un ítem, un descuento o un lugar nuevo.

| Contacto | Dónde | Se destraba | Sus 4 misiones | Premio |
|---|---|---|---|---|
| **Jorge de la Reserva Ecológica** | Puerto Mareo (la Reserva) | 3 misiones en Puerto Mareo | Salvar carpinchos de una obra · Sabotear un muelle privado · Robar los planos del country flotante · Hundir la draga | Escondite en la Reserva: se cura más rápido |
| **La Turca Nélida**, prestamista | Once y Medio | Tener menos de $50 después del nivel 5 | Cobrar una deuda vieja · Cobrársela a un cobrador · El deudor famoso · La libreta de la Turca | Préstamos (plata ya, se devuelve con intereses) |
| **El Profe Gutiérrez**, químico jubilado | Caballote | Comprar 3 suplementos | Vinos importados de Villa Crespa · La bodega trucha · El inspector · Exportación | Suplementos más baratos |
| **Mirta, la peluquera** | Floreros | Tener amigos en el juego (2 o más) | El chisme del día · La clienta que sabe demasiado · El casamiento · La foto | Ves en el mapa quién anda cerca |
| **El Doctor Benítez**, cirujano sin matrícula | Reloquita | Ir 3 veces a la clínica privada | La receta · La operación de madrugada · El paciente que no se puede morir · El que sí | Clínica más barata |
| **Pipo, el DJ** | Palermo Soja | Llegar a nivel 10 | La fiesta clandestina · El equipo de sonido · La lista VIP · El after | Un boliche como negocio |
| **Sor Mónica** | San Nicolasito | Hacer 5 misiones para vecinos | Robarle al que roba · La colecta · El obispo · El comedor | Bajar el nivel de búsqueda a la mitad, una vez por semana |
| **El Ingeniero Sasaki**, hacker del cyber | Villa Urquisa | Robar 2 cybers | Las cámaras · Los semáforos · La base de la comisaría · El apagón | Los golpes tienen menos riesgo de policía |

## 6. Eventos y cosas que aparecen solas (ya empezado)

- **Misiones temporales:** una «Urgente» por tablón, que paga más y dura dos horas. **Ya está.**
- **Encuentros raros:** gente extraña que aparece un rato en un barrio (el hombre murciélago con su 110, la vidente, el del futuro, la estatua viviente…). Hay 14 y aparece uno cada hora y cuarto. **Ya está.**
- **Eventos del calendario**, con misiones y premios propios:
  - Noche de Brujas (ya está).
  - Semana del Clásico, que se puede atar a la historia de La Barra.
  - Día de la Primavera.
  - Navidad: «el arbolito de La Señora».
  - Fin de temporada.
- **Tutorial vivo:** las primeras misiones de cada jefe enseñan una cosa cada una:
  - Viajar
  - Pelear en la calle
  - Golpes en locales
  - Negocios y propiedades
  - Gimnasio

