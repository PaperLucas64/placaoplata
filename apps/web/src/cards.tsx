/* La tarjeta de arriba: Marga en el tutorial, la elección de bando, y después la jefa de cada bando */
import { useState } from "react";
import { lawyerCost, MISSIONS, money, RANK_AT, RANKS, rankOf, salary, salaryLeft, TUT, type Side } from "@pop/shared";
import type { Act, Ui } from "./Game";

export function Boss({ s, act, busy }: Ui) {
  const t = TUT[s.tut]; if (!t) return null;
  const done = t.goal(s);
  return (
    <section className="boss" aria-live="polite">
      <div className="head"><span className="tag">Marga, dueña del bar La Esquina · encargo {s.tut + 1} de {TUT.length}</span><h3>{t.title}</h3></div>
      <p className="say">«{t.say}»</p>
      <div className="goal">{done
        ? <><span className="done">Listo. Andá a cobrar.</span><button className="primary" disabled={busy} onClick={() => act({ type: "claimTut" })}>Cobrar {money(t.reward.gold)}</button></>
        : <span className="num">{t.prog(s)}</span>}
      </div>
    </section>
  );
}

export function Choice({ act, busy }: { act: Act; busy: boolean }) {
  const [pick, setPick] = useState<Side | null>(null);
  const card = (side: Side, who: string, title: string, say: string, items: string[]) => (
    <button className={`side-card ${side}`} aria-pressed={pick === side} onClick={() => setPick(side)}>
      <span className="tag">{who}</span><h3>{title}</h3><span className="say">«{say}»</span>
      <ul>{items.map(i => <li key={i}>{i}</li>)}</ul>
    </button>
  );
  return (
    <section className="choice">
      <div className="siren" aria-hidden="true" />
      <div className="tag">En la vereda del bar, dos personas te esperan</div>
      <h2>¿Placa o plata?</h2>
      <p>Ya sabés laburar, entrenar, pelear y curarte. Ya hiciste tu primera misión. Ahora te toca elegir de qué lado de la ley vas a jugar. No hay vuelta atrás.</p>
      <div className="sides">
        {card("placa", "Comisaria Inés Ríos", "La placa", "Necesito gente que conozca la calle. Vos la conocés.",
          ["Patrullajes con sueldo", "Operativos y allanamientos como misiones", "Arrestos de delincuentes, también de otros jugadores"])}
        {card("plata", "La Señora", "La plata", "Pagan poco por ser honesto. Yo pago bien.",
          ["Golpes que pagan más, pero suman calor", "Atracos por etapas como misiones", "Peleas contra policías, también de otros jugadores"])}
      </div>
      {pick && (
        <div className="confirm">¿Seguro que elegís {pick === "placa" ? "la placa" : "la plata"}?
          <button className="primary" disabled={busy} onClick={() => act({ type: "side", side: pick })}>Sí, elijo {pick === "placa" ? "la placa" : "la plata"}</button>
          <button onClick={() => setPick(null)}>Pensarlo</button>
        </div>
      )}
    </section>
  );
}

export function Faction({ s, now, act, busy }: Ui) {
  const side = s.side!, p = side === "placa", rk = rankOf(s);
  const next = MISSIONS[side].find(m => !s.done[m.id]);
  let say: string;
  if (s.mis) say = p ? "Terminá lo que empezaste. Te estoy esperando." : "No me gusta esperar. Terminá ese trabajo.";
  else if (!next) say = p ? "Bahía Gris está más tranquila gracias a vos. Seguí patrullando: siempre aparece alguien nuevo." : "Bahía Gris es nuestra. Ahora hay que cuidarla.";
  else if (rk >= next.rank) say = p ? `Tengo algo para vos: “${next.title}”. Está en Misiones.` : `Tengo un trabajo: “${next.title}”. Fijate en Misiones.`;
  else say = p ? `Para lo que viene necesito a alguien con rango de ${RANKS.placa[next.rank]}. Ganate el respeto en la calle.`
               : `Lo que viene es para un ${RANKS.plata[next.rank]}. Hacete respetar en la calle primero.`;
  const nextAt = RANK_AT[rk + 1];
  const left = salaryLeft(s, now);
  return (
    <section className={`boss ${side}`} aria-live="polite">
      <div className="head"><span className="tag">{p ? "Comisaria Inés Ríos · Comisaría 4ª" : "La Señora · el depósito del puerto"}</span><h3>{RANKS[side][rk]}</h3></div>
      <p className="say">«{say}»</p>
      <div className="goal">
        <span className="num">Respeto {s.respect}{nextAt !== undefined ? ` · ${RANKS[side][rk + 1]} a los ${nextAt}` : " · rango máximo"}</span>
        {p
          ? (left ? <span className="tag num">Próximo sueldo en {Math.ceil(left / 60000)} min</span>
                  : <button className="primary" disabled={busy} onClick={() => act({ type: "salary" })}>Cobrar sueldo · {money(salary(s))}</button>)
          : <button disabled={busy || !s.heat || s.gold < lawyerCost(s)} onClick={() => act({ type: "lawyer" })}>Llamar al abogado · −40 calor · {money(lawyerCost(s))}</button>}
      </div>
    </section>
  );
}
