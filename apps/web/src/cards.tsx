/* La tarjeta de arriba: Marga en el tutorial; después, tu situación en las pandillas */
import {
  affShare, GANG_KEYS, GANG_MIN_POINTS, GANG_THRESHOLD, GANGS, gangOf, lawyerCost, money, RANK_AT, RANK_NAMES, rankOf, TUT, affTotal
} from "@pop/shared";
import type { Ui } from "./Game";
import { bossImg, img, Portrait } from "./art";

/* fondo de la tarjeta: la escena oscurecida para que el texto se lea */
const cardBg = (scene: string) => ({ backgroundImage: `linear-gradient(90deg, rgba(20,16,10,.92) 30%, rgba(20,16,10,.72)), url(${img(`fondos/${scene}`)})` });

export function Boss({ s, act, busy }: Ui) {
  const t = TUT[s.tut]; if (!t) return null;
  const done = t.goal(s);
  return (
    <section className="boss" aria-live="polite" style={cardBg("bar")}>
      <Portrait src={img("retratos/marga")} size={96} />
      <div className="head"><span className="tag">Marga, dueña del bar La Esquina · encargo {s.tut + 1} de {TUT.length}</span><h3>{t.title}</h3></div>
      <p className="say">«{t.say}»</p>
      <div className="goal">{done
        ? <><span className="done">Listo. Andá a cobrar.</span><button className="primary" disabled={busy} onClick={() => act({ type: "claimTut" })}>Cobrar {money(t.reward.gold)}</button></>
        : <span className="num">{t.prog(s)}</span>}
      </div>
    </section>
  );
}

export function Situation({ s, act, busy }: Ui) {
  const g = gangOf(s), rk = rankOf(s), nextAt = RANK_AT[rk + 1];
  const lawyer = s.heat > 0 && <button disabled={busy || s.gold < lawyerCost(s)} onClick={() => act({ type: "lawyer" })}>Abogado · −40 de búsqueda · {money(lawyerCost(s))}</button>;
  const respect = <span className="num">{RANK_NAMES[rk]} · respeto {s.respect}{nextAt !== undefined ? ` · ${RANK_NAMES[rk + 1]} a los ${nextAt}` : " · rango máximo"}</span>;

  if (g) {
    const info = GANGS[g];
    return (
      <section className="boss" aria-live="polite" style={{ ...cardBg(g), borderColor: info.color }}>
        <Portrait src={bossImg(g)} gang={g} size={96} />
        <div className="head"><span className="tag">{info.boss} · {info.hood}</span><h3 style={{ color: info.color }}>{info.name}</h3></div>
        <p className="say">«{info.say}» <span className="tag">Ventaja: {info.perk}.{s.turf ? ` Controlan ${s.turf} ${s.turf === 1 ? "barrio" : "barrios"}: +${s.turf * 2}% de plata.` : ""}</span></p>
        <div className="goal">{respect}{lawyer}</div>
      </section>
    );
  }
  /* suelto: cuánto le falta con cada pandilla */
  const total = affTotal(s);
  return (
    <section className="boss" aria-live="polite" style={cardBg("calle")}>
      <Portrait src={img("retratos/marga")} size={96} />
      <div className="head"><span className="tag">Andás suelto · Buenos Aires</span><h3>Cuatro pandillas, una ciudad</h3></div>
      <p className="say">«Hacé encargos y misiones para las pandillas. La que tenga la mitad de lo que hiciste te va a reclamar como propio.»</p>
      <div className="aff-bars">{GANG_KEYS.map(k => (
        <div key={k} className="aff"><span style={{ color: GANGS[k].color }}>{GANGS[k].name}</span>
          <div className="track"><div className="fill" style={{ width: `${affShare(s, k) * 100}%`, background: GANGS[k].color }} /></div>
          <span className="num">{Math.round(affShare(s, k) * 100)}%</span></div>
      ))}</div>
      <div className="goal">{total < GANG_MIN_POINTS
        ? <span className="tag">Todavía nadie te conoce: hacé tu primera misión para una pandilla.</span>
        : <span className="tag">Necesitás {Math.round(GANG_THRESHOLD * 100)}% con una pandilla para ser de ella.</span>}
        {respect}{lawyer}</div>
    </section>
  );
}
