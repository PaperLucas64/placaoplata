/* Tiempos del juego en milisegundos. Todo el ritmo se ajusta desde acá. */
export const ENERGY_MAX = 20;
export const ENERGY_EVERY = 20_000;   // +1 energía
export const HEAL_EVERY = 10_000;     // +2% de vida
export const SALARY_EVERY = 600_000;  // sueldo de la placa
export const ATTACK_EVERY = 90_000;   // ventana de emboscadas de personajes del juego
export const AMBUSH_CHANCE = 0.3;
export const AMBUSH_MAX_CATCHUP = 1;  // si estuviste afuera, como mucho te emboscan una vez
export const HEAT_EVERY = 20_000;     // -1 de calor

/* La calle */
export const DUEL_COST = 3;
export const SCOUT_COST = 1;
export const TARGETS = 5;
export const MIN_HP_TO_FIGHT = 0.25;  // ni atacás ni te atacan con menos de esto
export const PVP_SAME_TARGET_EVERY = 3_600_000; // a un mismo jugador, una vez por hora
export const LOG_SIZE = 40;
