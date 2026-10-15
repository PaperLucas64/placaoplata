# Balance de Maires

Cómo está calibrado el juego, con qué objetivo y cómo volver a medirlo. Todos los números de este documento
salen de herramientas que usan **las reglas reales del juego** (`packages/shared`):

| Herramienta | Qué hace |
|---|---|
| `npm run brief` | Un bot juega 30 partidas completas por bando y resume ritmo, peleas y plata |
| `npm run playthrough` | Lo mismo con todo el detalle (`-- --json` para datos crudos) |
| `npm run sim` | Miles de peleas sueltas: la calle por diferencia de nivel y el Ring |
| `npm test` | Incluye `tools/balance.test.ts`: si un cambio rompe el ritmo, falla |

El bot juega como una persona razonable: hace el tutorial, juega por sesiones (entra con la energía llena y la gasta),
se cura cuando está a media vida, compra el siguiente escalón de equipo (ahorra si cuesta hasta ~2,5 sesiones),
entrena parejo, hace las misiones apenas puede y pelea en la calle contra rivales de su nivel o uno más.

## 1. La unidad: la energía

Todo se mide en **energía gastada**, así el balance no depende de qué tan rápido se recarga.
El ritmo se ajusta en `packages/shared/src/config.ts`:

| Valor | Antes | Ahora | Por qué |
|---|---|---|---|
| Energía máxima | 20 | **40** | Una barra llena alcanza para el tutorial entero |
| +1 energía cada | 20 s | **1,5 min** | La barra se llena en 1 hora: ritmo de juego online, se entra varias veces por día |
| Vida | +2% cada 10 s | **+2% cada 36 s** | De cero a lleno en ~30 min |
| Sueldo de la placa | cada 10 min | **cada 1 hora** | Mantiene la proporción con la energía (~40 de energía por sueldo) |
| Calor | −1 cada 20 s | **−1 cada 1,5 min** | Baja al mismo ritmo que sube la energía |
| Entrenar | instantáneo | **2 + 0,4 × valor minutos** (máx. 30) | Tiempo humano: planificar el entrenamiento como en BiteFight |
| Curarse | guardia paga | **clínica paga al instante o guardia gratis hasta 15 min** | La guardia es la opción del que no tiene plata |

Con los tiempos del gimnasio, un jugador muy activo llega a nivel 10 en ~27 horas de reloj y a la misión final en ~65–70;
pasa ~37% del tiempo entrenando (la energía se carga mientras tanto, por eso el progreso por energía casi no cambia).

**Pasado a días** (jugador casual ≈ 150 de energía por día, activo ≈ 400):

| Hito | Energía | Casual | Activo |
|---|---|---|---|
| Tutorial y elección de bando | ~32 | primera sesión | primera sesión |
| Rango 1 (Cabo / Soldadito) y misión 1 | ~85 | día 1 | día 1 |
| Rango 2 (Sargento / Puntero) y misión 2 | ~450–500 | día 3 | día 2 |
| Rango 3 (Subinspector / Lugarteniente) | ~1.000–1.100 | 1 semana | día 3 |
| Rango 4 (Inspector / Mano derecha) y misión final | ~2.500–2.850 | 2,5 semanas | 1 semana |
| Rango 5 (Comisario / Capo) | ~4.900–5.500 | 5 semanas | 2 semanas |
| Nivel 10 | ~1.000–1.100 | 1 semana | día 3 |
| Nivel 20 | ~4.700–5.000 | 5 semanas | 2 semanas |

## 2. Peleas

### Cómo se pelea
Los golpes son fuertes y variables (entre 50% y 150%, con 15% de golpe crítico), así que las peleas duran pocos
rounds y **un rival un poco mejor no es imposible**. Antes los golpes eran chicos y parejos: las peleas llegaban
siempre al round 12 y ganaba siempre el que tenía un punto más.

Los rivales del juego crecen como crece un jugador que entrena parejo: **atributo ≈ 1,4 × nivel**, con equipo
que acompaña hasta +24.

### La calle (`npm run sim`)
Probabilidad de ganar según el nivel del rival comparado con el tuyo:

| Rival | Nivel 5 | Nivel 12 | Nivel 20 |
|---|---|---|---|
| 2 abajo | 99% | 97% | 87% |
| 1 abajo | 89% | 88% | 72% |
| tu nivel | 56% | 78% | 62% |
| 1 arriba | 24% | 53% | 51% |
| 2 arriba | 2% | 37% | 33% |
| 3 arriba | 0% | 23% | 27% |

A nivel bajo un nivel pesa mucho (de 7 a 9 de atributo es un 30% más), por eso **hasta nivel 7 la calle no muestra
rivales de más de un nivel arriba**, ni personajes del juego ni jugadores reales.

### Ring
| Rival | Al destrabarlo | 3 niveles después |
|---|---|---|
| Sparring del gimnasio | 99% | 99% |
| El Toro Medina | 98% | 97% |
| La Zurda Paz | 69% | 72% |
| Kid Cemento | 69% | 74% |
| El campeón del barrio | 51% | 40% |

### Misiones (lo que gana el bot en cada intento)

| | Pruebas de atributo | Pelea |
|---|---|---|
| La valija (tutorial) | 68% | 83% |
| Misión 1 (Ronda nocturna / La protección) | 65–73% | 91–94% |
| Misión 2 (Allanamiento / El blindado) | 50–55% | 61–83% |
| Misión final (Detener a La Señora / La libreta de la 4ª) | 77–80% | 64–79% |
| La calle, en general | | 58–61% |

Cada etapa se puede reintentar, así que 50–80% por intento es el rango buscado: hay tensión pero no frustra.

## 3. Economía: de dónde sale y adónde va la plata

| | Placa | Plata |
|---|---|---|
| **Entra** | trabajo 58%, sueldo 23%, calle 19% | trabajo 81%, calle 18% |
| **Sale** | gimnasio 79%, guardia 16%, equipo 5% | gimnasio 73%, guardia 15%, fianzas 6%, equipo 5% |

- **Gimnasio**: el gran sumidero. Entrenar cuesta `3 × valor²` (antes `2 × valor^1,7`). Con eso el atributo a nivel 10
  es ~12–15, en vez de 24.
- **Equipo**: cada rango trae un arma y una protección mejores que lo anterior, a ~2 sesiones de trabajo del nivel
  en que se llega al rango ($900 / $2.200 / $3.800 / $6.000). Antes el equipo de bando era **peor** que el de la feria.
- **Guardia**: curarse cuesta 0,25 por punto de vida (antes 0,6). Antes se comía el 40% de la plata.
- **Labia**: +1,5% de paga por punto (antes +3%, con 36 de Labia se cobraba el doble).
- **Andar con plata encima se castiga**: las emboscadas sacan 8% y las fianzas 10% + nivel × 5. No conviene acumular.

### El calor de la plata
Cada golpe suma calor (1 a 8 según el golpe, ~1 por punto de energía) y baja 1 por cada 1,5 min.
La chance de que te agarren es `calor/400 + riesgo × 1%`: con 50 de calor, ~1 de cada 7 golpes.
Antes era `calor/250 + riesgo × 2%` con golpes que sumaban hasta 14: el calor vivía en 100 y te agarraban 1 de cada 4.

## 4. Antes y después

| | Antes | Ahora |
|---|---|---|
| Calle contra tu nivel (nivel 12) | 98% | 78% |
| Rival 2 niveles arriba (nivel 12) | 74%, y a nivel 5, 5% | 37%; a nivel bajo no aparecen |
| Jefe final de bando | 100% | 64–79% |
| Atributo a nivel 10 | 24 | 12–15 |
| Llegar a Comisario / Capo | ~1.450 de energía (8 h de juego) | ~5.000 (2–5 semanas) |
| Equipo de bando | nunca convenía | un escalón por rango |
| Guardia | 40% del gasto | 16% |
| Diferencia placa / plata hasta nivel 20 | plata 30% más lenta | plata ~8% más lenta |

## 5. Pendiente y a vigilar

- **Fin de juego**: el equipo llega a +23/+24 en el rango 4 y los rivales a nivel 20 ya lo igualan. Después del rango 5
  hace falta contenido nuevo (más misiones, equipo de nivel alto, el "turno largo").
- **Peleas entre jugadores reales**: usan la misma fórmula pero no están en el bot. Cuando haya jugadores, mirar
  cuánta plata cambia de mano por día y si alguien abusa de atacar siempre a los más débiles (hoy: mismo rival una vez
  por hora, nada de rivales con menos de 25% de vida).
- **La plata sigue algo más lenta** (~8%). Es a propósito (paga más pero arriesga más), pero si los jugadores eligen
  mucho más la placa, subir un poco la paga de los golpes.
- **El sparring y el Toro Medina** se ganan casi siempre: están bien para el tutorial, pero el Ring necesita más
  rivales entre nivel 12 y 20.
