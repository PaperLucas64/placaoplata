# Placa o Plata — Game Design Document

**Estudio:** Mauspi Lab · **Versión del documento:** 1.0 (15/10/2026) · **Estado del juego:** jugable online, en prueba entre amigos
**Dónde se juega:** https://cinectomia.com/juego/ · **Repo:** github.com/PaperLucas64/placaoplata
Documentos relacionados: [BALANCE.md](BALANCE.md) (números y cómo medirlos) · [CREDITOS.md](CREDITOS.md) (arte y licencias)

> Los números de este documento salen del código (`packages/shared/src`). Si se cambia un número allá, actualizar acá.

---

## 1. Visión

**Placa o Plata** es un juego de navegador por energía, al estilo **BiteFight**, ambientado en **Bahía Gris**, una ciudad
portuaria rioplatense de noche. Llegás solo con tu nombre y elegís de qué lado de la ley jugar: **la placa** (policía) o
**la plata** (delincuente). Después peleás contra el otro bando —personajes del juego y **jugadores reales**— para ganar
respeto y subir de rango.

- **Género:** juego de navegador persistente (browser game / idle-RPG por energía), PvE + PvP asincrónico.
- **Plataforma:** web (escritorio y celular), sin descarga. Cuenta con usuario y contraseña.
- **Público:** grupos de amigos y comunidades chicas; sesiones cortas varias veces por día.
- **Tono:** policial negro con humor de barrio. Textos en español rioplatense.
- **Inspiración:** BiteFight (energía, caza, gruta, duelos entre jugadores), GTA (misiones por etapas), novelas visuales (retratos).

### Pilares
1. **Una decisión que define todo:** placa o plata. No hay vuelta atrás y cada bando juega distinto.
2. **Sesiones cortas con progreso real:** entrás, gastás la energía en 5–10 minutos, te vas; siempre avanzaste algo.
3. **La ciudad está viva:** otros jugadores te pueden atacar mientras no estás; el ranking mezcla personas y personajes.
4. **Riesgo con sentido:** más paga = más riesgo (calor, golpes, emboscadas). Nunca se pierde el personaje.

---

## 2. Loops de juego

**Sesión (5–10 min):** entrar → cobrar sueldo / bajar el calor → gastar la energía (trabajos, misiones, peleas en la calle)
→ entrenar o comprar equipo con lo ganado → curarse → salir. La energía se llena en 1 hora.

**Progreso (días/semanas):** subir de nivel → entrenar atributos → juntar respeto → subir de rango → destrabar misión y
equipo del rango → cumplir la misión del bando → escalar en el ranking.

**Social:** atacar jugadores reales del otro bando → recibir ataques (aviso en vivo) → comparar en el ranking.

---

## 3. Mundo y personajes

**Bahía Gris:** puerto, mercado, avenidas con control policial, comisaría 4ª, el depósito de La Señora, el bar La Esquina.

| Personaje | Rol |
|---|---|
| **Marga** | Dueña del bar La Esquina. Guía del tutorial: te da los 6 encargos iniciales. |
| **Don Tito** | Dueño del gimnasio. |
| **Comisaria Inés Ríos** | Jefa de la placa. Te da sueldo, misiones y armería. |
| **La Señora** | Jefa de la plata. Te da trabajos, abogado y mercado negro. |
| **El Gallego** | Mano derecha de La Señora; jefe de la misión final de la placa. |
| Rivales de la calle | 10 policías y 10 delincuentes con nombre (Sargento Paredes, La Turca, etc.), escalados a tu nivel. |
| Rivales del ring | Sparring, El Toro Medina, La Zurda Paz, Kid Cemento, El campeón del barrio. |

---

## 4. Progresión

### 4.1 Niveles
- XP necesaria para pasar del nivel *n*: `40 × n^1,55` (nivel 5: 485 · nivel 10: 1.419 · nivel 20: 4.156 · nivel 30: 7.791).
- **No hay nivel máximo.** El contenido se acaba antes: el último trabajo se destraba en nivel 15 y el último rival del ring en nivel 12.
- Al subir de nivel: vida al máximo, +6 de vida máxima.
- Ritmo medido por el bot: nivel 10 con ~1.000 de energía (1 semana casual), nivel 20 con ~4.700–5.000 (2–5 semanas).

### 4.2 Atributos
| Atributo | Efecto |
|---|---|
| Fuerza | Daño de cada golpe |
| Dureza | Reduce el daño recibido |
| Reflejos | Chance de acertar y de esquivar |
| Aguante | Vida máxima (+12 por punto) |
| Labia | +1,5% de paga en trabajos por punto; pruebas de misiones |

- Empiezan en 5. Entrenar cuesta `3 × valor²` (de 10 a 11: $300 · de 20 a 21: $1.200 · de 40 a 41: $4.800).
- **No hay tope de atributos**; el límite es la plata (el costo sube al cuadrado).
- Vida máxima: `40 + Aguante × 12 + nivel × 6`.

### 4.3 Energía y tiempos
| | Valor |
|---|---|
| Energía máxima | 40 (se llena en 1 hora: +1 cada 1,5 min) |
| Vida | +2% cada 36 s (de cero a lleno en ~30 min) |
| Sueldo de la placa | cada 1 hora |
| Calor de la plata | −1 cada 1,5 min |
| Emboscadas de personajes | chance del 30% cada 6 min; si no estabas, como mucho 1 |

### 4.4 Respeto y rangos (después de elegir bando)
| Rango | Respeto | Placa | Plata | Destraba |
|---|---|---|---|---|
| 0 | 0 | Agente | Campana | Misión 1 |
| 1 | 50 | Cabo | Soldadito | Equipo nivel 1 |
| 2 | 220 | Sargento | Puntero | Misión 2, equipo nivel 2 |
| 3 | 600 | Subinspector | Lugarteniente | Equipo nivel 3 |
| 4 | 1.400 | Inspector | Mano derecha | Misión final, equipo nivel 4 |
| 5 | 3.000 | Comisario | Capo | (nada todavía) |

Respeto se gana con trabajos (+1 a +5), peleas en la calle (+1 a +12; +2 extra contra jugadores reales), misiones
(+30 / +90 / +300) y emboscadas rechazadas (+2 o +3). Se pierde al perder peleas que iniciaste (−2).
**Se puede bajar de rango** si el respeto cae por debajo del umbral.

---

## 5. Sistemas

### 5.1 Tutorial (Marga)
6 encargos, cada uno destraba una pestaña y paga plata + XP:
1. Recién llegado — 2 laburos → Gimnasio · 2. Ponerse en forma — entrenar 1 vez → Feria · 3. Algo para defenderte — comprar algo → Ring
4. Primer round — ganarle al sparring → Guardia · 5. Puntos y gasas — visitar la guardia → Misiones · 6. Un encargo de confianza — misión «La valija».
Después aparece la **elección de bando** (definitiva). Dura ~32 de energía: entra en la primera sesión.

### 5.2 Trabajos ("caza" de BiteFight)
Cada trabajo gasta energía y puede salir mal (riesgo bajo 6%, medio 18%, alto 30%: perdés 14%/28%/42% de la vida).

**Laburos (sin bando)**
| Trabajo | Energía | Plata | XP | Nivel |
|---|---|---|---|---|
| Repartir pedidos en bici | 1 | 4–10 | 2–4 | 1 |
| Lavar autos en la estación | 2 | 10–22 | 5–8 | 2 |
| Cuidar la puerta de un boliche | 3 | 22–45 | 10–15 | 4 |
| Chofer de noche | 4 | 45–90 | 18–26 | 6 |
| Seguridad en un depósito del puerto | 5 | 90–170 | 30–45 | 9 |

**Patrullaje (placa)** — paga menos, más XP, y la placa cobra sueldo (`30 + nivel×12 + rango×25` por hora).
| Trabajo | Energía | Plata | XP | Respeto | Nivel |
|---|---|---|---|---|---|
| Parada en la esquina | 1 | 5–12 | 4–6 | 1 | 1 |
| Control vehicular | 2 | 12–26 | 8–12 | 1 | 3 |
| Patrullaje en el centro | 3 | 25–50 | 14–20 | 2 | 5 |
| Operativo en la cancha | 4 | 45–90 | 24–34 | 3 | 8 |
| Persecución en la ruta | 5 | 80–150 | 38–52 | 4 | 11 |
| Traslado de presos al penal | 6 | 130–240 | 55–75 | 5 | 15 |

**Golpes (plata)** — paga más pero suma **calor**. Chance de que te detengan en cada golpe: `calor/400 + riesgo×1%`.
Detención: pagás fianza (10% de tu plata + nivel×5) y el calor baja 35. El **abogado** baja 40 de calor por `20 + nivel×8`.
| Trabajo | Energía | Plata | XP | Respeto | Calor | Nivel |
|---|---|---|---|---|---|---|
| Arrebato de celulares | 1 | 8–18 | 4–6 | 1 | 1 | 1 |
| Robar estéreos de autos | 2 | 18–38 | 7–12 | 1 | 2 | 3 |
| Laburo en el desarmadero | 3 | 38–75 | 14–20 | 2 | 3 | 5 |
| Asalto a una estación de servicio | 4 | 70–130 | 24–34 | 3 | 5 | 8 |
| Contrabando en el puerto | 5 | 120–220 | 38–53 | 4 | 6 | 11 |
| Asalto a una financiera | 6 | 200–360 | 55–74 | 5 | 8 | 15 |

### 5.3 Feria de usados y equipo
**1 arma + 1 protección equipadas.** Comprar una nueva **reemplaza** la anterior (no hay inventario ni venta).
El arma suma al daño; la protección resta al daño recibido.

| Neutral | Tipo | Valor | Precio | Nivel |
|---|---|---|---|---|
| Llave inglesa | arma | +3 | $30 | 1 |
| Bate de aluminio | arma | +6 | $150 | 3 |
| Bastón extensible | arma | +9 | $450 | 6 |
| Campera de cuero | protección | +2 | $25 | 1 |
| Casco de moto | protección | +5 | $180 | 3 |
| Chaleco acolchado | protección | +8 | $500 | 6 |
| Botiquín (+50% de vida) | consumible | — | $20 | 1 |

| Rango | Armería (placa) | Mercado negro (plata) | Valor | Precio |
|---|---|---|---|---|
| 1 | Tonfa reglamentaria / Chaleco reglamentario | Manopla de bronce / Campera de cuero gruesa | +11 / +10 | $900 c/u |
| 2 | Pistola taser / Chaleco antibalas | Navaja automática / Campera con placas | +15 / +15 | $2.200 c/u |
| 3 | Pistola reglamentaria / Equipo táctico | Escopeta recortada / Chaleco robado a la policía | +19 / +19 | $3.800 c/u |
| 4 | Escopeta antimotines / Escudo antidisturbios | Fusil del contrabando / Chaleco del mercado negro | +23 / +23 | $6.000 c/u |

### 5.4 Ring ("gruta" de BiteFight)
Peleas de práctica: 3 de energía, si perdés no perdés plata (ganás un tercio de la XP). El rival se escala a tu nivel.
Sparring (nv 1) · El Toro Medina (nv 3) · La Zurda Paz (nv 5) · Kid Cemento (nv 8) · El campeón del barrio (nv 12).
Ganar: bolsa de plata y XP según el rival.

### 5.5 Guardia
Curarse completo cuesta $0,25 por punto de vida faltante. Botiquín: +50% de vida, se compra en la feria.

### 5.6 Misiones por etapas
Cada etapa gasta energía y es una **prueba de atributo** (chance `50% + (atributo − dificultad) × 7%`, entre 15% y 95%),
una **pelea** contra un jefe, o una **entrega**. Si sale mal se reintenta; algunas pruebas fallidas quitan vida.
Son **de una sola vez** y van en orden.

| Bando | Misión | Rango | Etapas | Premio |
|---|---|---|---|---|
| — | La valija (tutorial) | — | 4 | $40 + 15 XP (Marga) |
| Placa | Ronda nocturna | 0 | 4 | $120, 60 XP, 30 respeto |
| Placa | Allanamiento en el puerto | 2 | 5 | $400, 180 XP, 90 respeto |
| Placa | Detener a La Señora | 4 | 5 | $1.500, 600 XP, 300 respeto |
| Plata | La protección | 0 | 4 | $180, 60 XP, 30 respeto, +15 calor |
| Plata | El blindado | 2 | 5 | $600, 180 XP, 90 respeto, +25 calor |
| Plata | La libreta de la 4ª | 4 | 5 | $2.200, 600 XP, 300 respeto, +40 calor |

### 5.7 La calle (duelos)
- 5 rivales del otro bando: hasta 3 **jugadores reales** de nivel parecido y el resto personajes del juego.
- Atacar cuesta 3 de energía; "Buscar a otros" cuesta 1.
- No se puede atacar ni ser atacado con menos del 25% de vida.
- Rango de niveles: hasta nivel 7, rivales de −2 a +1; después de −2 a +2 (jugadores reales: de −3 a +3).
- A un mismo jugador real, **una vez por hora**.
- Ganar contra un personaje: plata (placa: recompensa + decomiso; plata: 35% de lo que lleva), XP y respeto.
- Ganar contra un jugador: el perdedor pierde hasta el 25% de su plata (la placa decomisa una parte; el resto lo paga el Estado como recompensa).
- El jugador atacado recibe **aviso en vivo** y queda en su crónica. Si rechaza el ataque, gana +3 de respeto.

### 5.8 Emboscadas
Cada 6 min hay 30% de chance de que un personaje del otro bando te ataque. Si gana te saca 8% de tu plata; si perdés, nada más que vida.

### 5.9 Ranking
Por respeto. Mezcla jugadores reales (marcados) y 12 personajes fijos que van de 10 a 2.600 de respeto.

### 5.10 Crónica
Las últimas 40 cosas que te pasaron, con hora.

---

## 6. Combate
Pelea por rounds (hasta 12), ataca primero quien inicia. Cada golpe:
- Acierto: `62% + (Reflejos atacante − Reflejos defensor) × 1,5%` (entre 25% y 92%).
- Daño: `3 × ((Fuerza × 1,6 + arma) × azar[0,5–1,5] − Dureza × 0,5 − protección × 0,7)`, mínimo 1; 15% de crítico (×1,6).
- Gana quien deja al otro en cero; si llegan al round 12, quien conserva más vida proporcional.
- Los rivales del juego crecen como un jugador que entrena parejo: atributo ≈ `máx(5; 0,5 + 1,4 × nivel)`, equipo hasta +24.
- Probabilidades medidas: ver [BALANCE.md](BALANCE.md) §2.

---

## 7. Economía

**Fuentes:** trabajos (58–81%), calle (18–19%), sueldo de la placa (~23% de lo que gana la placa), misiones, ring, tutorial.
**Sumideros:** gimnasio (73–79%), guardia (15–16%), equipo (~5%), fianzas y abogado (plata), emboscadas y derrotas contra jugadores.
**Andar con plata encima tiene riesgo** (emboscadas 8%, fianzas 10%, derrotas contra jugadores hasta 25%): incentiva gastarla.

### Límites y topes actuales
| Qué | Límite hoy |
|---|---|
| Nivel | **Sin tope** (el contenido llega hasta nivel ~15) |
| Atributos | **Sin tope**; costo `3 × valor²` |
| Rango | Máximo 5 (Comisario / Capo) |
| Energía | Máximo 40; no hay forma de recargarla salvo esperar |
| Equipo | 1 arma + 1 protección; comprar reemplaza; no se vende ni se guarda |
| Botiquines | Sin tope de compra ni de cantidad guardada |
| Curarse en la guardia | Sin tope (solo cuesta plata) |
| Plata | Sin tope ni banco; toda la plata está expuesta a robos y fianzas |
| Duelos contra un mismo jugador | 1 por hora; **sin tope diario total** |
| Misiones | 1 vez cada una; 3 por bando |
| Calor | 0 a 100 |
| Bando | Definitivo |
| Avatar | Se elige al crear el personaje; no se puede cambiar |

---

## 8. Online, cuentas y seguridad
- Cuenta con usuario (3–20 caracteres) y contraseña (mínimo 6, guardada con scrypt). Sesión de 30 días.
- **El servidor hace todas las cuentas**: la pantalla solo pide acciones (no se puede hacer trampa editando la partida).
- Límite de 10 intentos de login/registro por minuto.
- Avisos en vivo por WebSocket cuando te atacan.
- El tiempo (energía, vida, calor) se calcula al leer, sin tareas programadas.

---

## 9. Arte, interfaz y sonido
- Estética **2D nocturna**: asfalto, luz de sodio; azul para la placa, rojo para la plata.
- Retratos estilo novela visual (Wataokiba), fondos con filtro nocturno (Noraneko Games), armas en pixel art (arlantr),
  íconos planos (packs + propios). Créditos en el juego y en [CREDITOS.md](CREDITOS.md).
- 4 avatares a elegir. Rivales anónimos como siluetas sobre el color de su bando.
- Diseño adaptable a celular.
- **Sonido:** no tiene todavía (hay música CC0 disponible en la carpeta de assets).

## 10. Tecnología
TypeScript en todo: `packages/shared` (reglas puras), `apps/server` (Node + Fastify + Postgres), `apps/web` (React + Vite).
Producción: servidor en Render (gratis), base en Neon (gratis), pantalla en Donweb por FTP automático desde GitHub,
UptimeRobot para que no se duerma. Herramientas: bot de balance (`npm run brief`), simulador de peleas (`npm run sim`), tests.

---

## 11. Qué falta (roadmap)

### Prioridad alta — para que se pueda abrir a más gente
- **Recuperar contraseña:** hoy si alguien la olvida, pierde la cuenta (no se pide mail).
- **Protección para nuevos:** hoy te pueden atacar jugadores reales apenas elegís bando.
- **Tope diario de ataques entre jugadores** y protección contra que alguien abuse de un mismo rival débil todos los días.
- **Moderación básica:** nombres ofensivos, borrar o bloquear cuentas, panel de administración.
- **Probar el balance de las peleas entre jugadores reales** (el bot solo juega contra personajes).

### Prioridad media — contenido
- **Fin de juego:** después del rango 4 no hay nada nuevo. Falta: equipo de nivel 5+, misiones para rangos 3 y 5,
  trabajos y rivales de ring para niveles 15–30, recompensa por llegar a Comisario / Capo.
- **Nivel máximo o curva de fin de juego:** decidir si hay tope (por ejemplo 50) o prestigio/reinicio.
- **Más misiones** por bando (hoy 3) y **misiones repetibles** (diarias o semanales).
- **Turno largo** (como el cementerio de BiteFight): trabajo de horas que se cobra al volver.
- **Inventario:** guardar equipo, vender lo viejo a la feria, más de un consumible.
- **Banco o caja fuerte** (con comisión) para proteger parte de la plata.
- **Contrapeso de la placa:** la plata tiene calor; la placa no tiene riesgo propio (idea: sospecha de corrupción, asuntos internos).
- **Cambiar de bando** (traición) con costo alto, o dejarlo definitivo como regla de diseño.
- **Informes de pelea** detallados para el atacado y **revancha**.

### Prioridad media — social
- Chat de la ciudad y por bando.
- Bandas (familias) y comisarías: clanes con caja común, ranking de grupos y guerras.
- Mensajes entre jugadores.
- Ranking por otras categorías (botín, victorias, arrestos).

### Prioridad baja — presentación
- Música y sonidos (hay música CC0 en los assets).
- Más retratos: un retrato por jefe de misión y por rival del ring; expresiones según el resultado.
- Cambiar el avatar desde el juego; más avatares.
- Arte más "rioplatense" (los fondos actuales son de estilo japonés con filtro).
- Logros, eventos de la ciudad con tiempo, notificaciones al celular.

### Infraestructura
- Plan pago de Render (~US$7) si hay muchos jugadores a la vez; vigilar las horas gratis de Neon.
- Copias de seguridad de la base.
- Pasar el repo a privado (licencias de arte).
