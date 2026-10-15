# Placa o Plata

Juego de navegador por turnos de energía, al estilo BiteFight, sobre policías y ladrones.

Llegás a Bahía Gris solo con tu nombre. Marga, la dueña del bar La Esquina, te da encargos que te enseñan cada mecánica de a una:

1. **Laburos**: trabajos que gastan energía y dan plata y experiencia.
2. **Gimnasio**: entrenás Fuerza, Dureza, Reflejos, Aguante y Labia.
3. **Feria de usados**: armas, protección y botiquines.
4. **Ring**: peleas por rounds contra rivales del gimnasio.
5. **Guardia**: te curan a cambio de plata.
6. **Misiones**: encargos por etapas, cada una prueba un atributo distinto.

Al terminar la primera misión elegís bando: **la placa** (policía) o **la plata** (delincuente).

Después de elegir, cada bando tiene lo suyo:

| | La placa | La plata |
|---|---|---|
| Jefa | Comisaria Inés Ríos | La Señora |
| Caza | **Patrullaje**: paga menos, cobrás sueldo cada 10 min | **Golpes**: paga más pero suma **calor**; con mucho calor te detienen y pagás fianza (el abogado lo baja) |
| La calle | Arrestás delincuentes: recompensa + decomiso | Asaltás policías: te quedás con lo que llevan |
| Misiones | Ronda nocturna → Allanamiento en el puerto → Detener a La Señora | La protección → El blindado → La libreta de la 4ª |
| Armería | Tonfa, chaleco antibalas, pistola, escudo | Manopla, campera con placas, recortada, chaleco |

- **Respeto y rangos**: se gana con trabajos, peleas en la calle y misiones. Los rangos destraban misiones y equipo.
- **Emboscadas**: cada tanto alguien del otro bando te ataca a vos. Si perdés, te sacan plata.
- **Ranking**: tu posición en Bahía Gris contra los personajes de los dos bandos.

## Cómo jugar

Abrí `index.html` en cualquier navegador. No necesita instalar nada.
La partida se guarda en el navegador donde jugás (localStorage).

## Estado

- Parte 1 (tutorial neutral y elección de bando): lista.
- Parte 2 (patrullajes/golpes, la calle, rangos, armería, ranking y 3 misiones por bando): lista.
- Pendiente: los rivales de la calle y del ranking son personajes del juego, no jugadores reales (eso necesitaría un servidor).

## Prototipos

En `prototipos/` quedan las versiones anteriores con otras temáticas:
`colmillo-y-garra` (vampiros y licántropos), `septima-luna` (lobizones y salamanqueros),
`la-pulperia` y `pulperia-la-esquina` (pulpería tranquila y de administración).
