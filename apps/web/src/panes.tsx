import { useEffect, useState } from "react";
import {
  canStart, DUEL_COST, guardiaTime, trainTime, getMission, healCost, itemLocked, jobList, maxHp, MIN_HP_TO_FIGHT, MISSIONS, money, RANKS,
  rankOf, RING, SCOUT_COST, SHOP, STAT_HELP, STAT_NAMES, trainCost, VALIJA, type Mission, type StatKey, type TabKey
} from "@pop/shared";
import { api, type RankRow } from "./api";
import type { Ui } from "./Game";
import { avatarImg, hasPortrait, img, Portrait, portraitOf, silhouette } from "./art";
import { ItemIcon } from "./icons";

const riskTxt = ["", "bajo", "medio", "alto"];

export function Pane({ tab, ...rest }: Ui & { tab: TabKey }) {
  /* mientras entrenás o estás internado, todo lo que lleva energía o pelea queda bloqueado */
  const ui = { ...rest, busy: rest.busy || !!rest.s.busy };
  switch (tab) {
    case "laburos": return <Jobs {...ui} />;
    case "gimnasio": return <Gym {...ui} />;
    case "feria": return <Shop {...rest} />;
    case "ring": return <Ring {...ui} />;
    case "guardia": return <Hospital {...rest} />;
    case "misiones": return <Missions {...ui} />;
    case "calle": return <Street {...ui} />;
    case "ranking": return <Ranking {...ui} />;
  }
}

function Jobs({ s, act, busy }: Ui) {
  const p = s.side === "placa";
  const intro = !s.side ? "Trabajos de todo tipo. Más riesgo, más plata. La labia te ayuda a cobrar mejor."
    : p ? "Salís a la calle con el uniforme. Paga menos que el otro lado, pero suma respeto y cobrás sueldo cada diez minutos."
        : "Cada golpe paga bien y suma respeto, pero también suma calor. Con mucho calor es más fácil que te agarren.";
  return <>
    <h2>{!s.side ? "Laburos" : p ? "Patrullaje" : "Golpes"}</h2>
    <p>{intro}</p>
    <div className="list">{jobList(s).filter(j => j.lvl <= s.lvl + 2).map(j => (
      <div className="item" key={j.id}>
        <div><h3>{j.name}<span className={`risk r${j.risk}`}>riesgo {riskTxt[j.risk]}</span></h3>
          <div className="meta num">{money(j.gold[0])}–{money(j.gold[1])} · {j.xp[0]}–{j.xp[1]} XP{j.resp ? ` · +${j.resp} respeto` : ""}{j.heat ? ` · +${j.heat} calor` : ""} · {j.cost} energía{s.lvl < j.lvl ? ` · desde nivel ${j.lvl}` : ""}</div></div>
        <div className="act"><button disabled={busy || s.energy < j.cost || s.lvl < j.lvl} onClick={() => act({ type: "job", id: j.id })}>{!s.side ? "Trabajar" : p ? "Salir" : "Hacerlo"}</button></div>
      </div>))}
    </div>
  </>;
}

function Gym({ s, act, busy }: Ui) {
  return <>
    <div className="with-art">
      <Portrait src={img("retratos/tito")} size={72} />
      <div><h2>Gimnasio de Don Tito</h2><p className="say">«Cada punto cuesta más que el anterior, pibe, y lleva más tiempo. Mientras entrenás, no hacés otra cosa.»</p></div>
    </div>
    <div className="list">{(Object.keys(STAT_NAMES) as StatKey[]).map(k => {
      const c = trainCost(s.stats[k]);
      return <div className="item" key={k}>
        <div><h3>{STAT_NAMES[k]} <span className="num">{s.stats[k]}</span></h3><div className="meta">{STAT_HELP[k]}</div></div>
        <div className="act"><button disabled={busy || s.gold < c} onClick={() => act({ type: "train", stat: k })}>Entrenar · <span className="num">{money(c)} · {Math.round(trainTime(s.stats[k]) / 60000)} min</span></button></div>
      </div>;
    })}</div>
  </>;
}

function Shop({ s, act, busy }: Ui) {
  return <>
    <h2>Feria de usados</h2>
    <p>Una cosa en la mano y una encima. Lo nuevo reemplaza a lo viejo.{s.side && (s.side === "placa" ? " Al fondo está lo que te da la armería de la comisaría, según tu rango." : " Al fondo, lo del mercado negro de La Señora, según tu rango.")}</p>
    <div className="list">{SHOP.filter(it => it.lvl <= s.lvl + 3 && (!it.side || it.side === s.side)).map(it => {
      const own = it.slot !== "consumible" && s.gear[it.slot] === it.id;
      return <div className="item" key={it.id}>
        <div className="with-art"><ItemIcon id={it.id} /><div><h3>{it.name}{it.side && <span className={`badge ${it.side}`} style={{ marginLeft: 6 }}>{it.side === "placa" ? "armería" : "mercado negro"}</span>}</h3>
          <div className="meta num">{it.slot === "consumible" ? "Se usa desde la guardia" : `${it.slot === "arma" ? "golpe" : "protección"} +${it.val}`} · {money(it.price)}
            {s.lvl < it.lvl && ` · desde nivel ${it.lvl}`}{it.rank && it.side && rankOf(s) < it.rank ? ` · desde rango ${RANKS[it.side][it.rank]}` : ""}</div></div></div>
        <div className="act"><button disabled={busy || own || s.gold < it.price || itemLocked(s, it)} onClick={() => act({ type: "buy", id: it.id })}>{own ? "Lo tenés" : "Comprar"}</button></div>
      </div>;
    })}</div>
  </>;
}

function Ring({ s, act, busy }: Ui) {
  return <>
    <h2>El ring</h2>
    <p>Peleas de gimnasio. Cada una gasta 3 de energía. Si perdés, no perdés plata: solo orgullo.</p>
    <div className="list">{RING.map((m, i) => (
      <div className="item" key={m.name}>
        <div className="with-art"><Portrait src={silhouette(m.name)} silhouetteOf size={52} />
          <div><h3>{m.name}<span className={`risk r${m.mult < 0.9 ? 1 : m.mult < 1.3 ? 2 : 3}`}>×{m.mult.toFixed(1)}</span></h3>
          <div className="meta">{s.lvl < m.lvl ? `Pelea con gente de nivel ${m.lvl} para arriba` : m.lore}</div></div></div>
        <div className="act"><button disabled={busy || s.energy < 3 || s.hp < 2 || s.lvl < m.lvl} onClick={() => act({ type: "spar", i })}>Pelear</button></div>
      </div>))}
    </div>
  </>;
}

function Hospital({ s, act, busy }: Ui) {
  const c = healCost(s), full = s.hp >= maxHp(s), occupied = !!s.busy;
  return <>
    <h2>Clínica y guardia</h2>
    <p>La vida se recupera sola de a poco (de cero a lleno en media hora). Si no querés esperar, tenés dos opciones.</p>
    <div className="list">
      <div className="item"><div><h3>Clínica privada</h3><div className="meta num">{full ? "Estás entero" : `${money(c)} · al instante`}</div></div>
        <div className="act"><button disabled={busy || occupied || full || s.gold < c} onClick={() => act({ type: "heal" })}>Pagar y curarme</button></div></div>
      <div className="item"><div><h3>Guardia del hospital</h3><div className="meta num">{full ? "Estás entero" : `Gratis · te dan el alta en ${Math.max(1, Math.round(guardiaTime(s) / 60000))} min`} · mientras estás internado nadie te puede atacar</div></div>
        <div className="act"><button disabled={busy || occupied || full} onClick={() => act({ type: "guardia" })}>Internarme</button></div></div>
      <div className="item"><div><h3>Usar un botiquín</h3><div className="meta num">Tenés {s.potions} · +50% de vida</div></div>
        <div className="act"><button disabled={busy || !s.potions} onClick={() => act({ type: "kit" })}>Usar</button></div></div>
    </div>
  </>;
}

function MissionRun({ M, ...ui }: Ui & { M: Mission }) {
  const { s, act, busy, mission } = ui;
  const step = s.mis && s.mis.id === M.id ? s.mis.step : M.steps.length;
  const cur = M.steps[step];
  return <div className="mission">
    <h2>{M.title}</h2>
    <ol className="steps">{M.steps.map((st, i) => (
      <li key={i} className={i < step ? "ok" : i === step ? "now" : ""}>
        <span className="n">{i < step ? "✓" : i + 1}</span>
        <span>{i === step && st.fight && hasPortrait(st.fight.name) && <span style={{ float: "right", marginLeft: 10 }}><Portrait src={portraitOf(st.fight.name)} size={72} /></span>}{st.text}{i === step && <><br /><span className="tag">{st.fight ? "pelea" : st.auto ? "entrega" : `prueba de ${STAT_NAMES[st.stat!].toLowerCase()}`} · {st.energy} energía</span></>}</span>
      </li>))}
    </ol>
    {mission && <p className={`result ${mission.ok ? "good" : "bad"}`}>{mission.text}</p>}
    {cur && <div><button className="primary" disabled={busy || s.energy < cur.energy || s.hp < 2} onClick={() => act({ type: "mstep" })}>{cur.fight ? "Pelear" : cur.auto ? "Entregar" : "Intentarlo"}</button></div>}
  </div>;
}

function Missions(ui: Ui) {
  const { s, act, busy, mission } = ui;
  if (s.mis) return <MissionRun M={getMission(s.mis.id)!} {...ui} />;
  if (!s.side) {
    if (s.c.valija) return <MissionRun M={VALIJA} {...ui} />;
    return <>
      <h2>Misiones</h2>
      <p>Las misiones tienen varias etapas. Cada etapa gasta energía y pone a prueba un atributo distinto. Si una etapa sale mal, la podés volver a intentar.</p>
      <div className="item"><div><h3>{VALIJA.title}</h3><div className="meta">{VALIJA.intro}</div></div>
        <div className="act"><button className="primary" disabled={busy} onClick={() => act({ type: "mstart", id: "valija" })}>Empezar</button></div></div>
    </>;
  }
  const rk = rankOf(s);
  return <>
    <h2>Misiones</h2>
    <p>{s.side === "placa" ? "Operativos de la comisaría." : "Trabajos de La Señora."} Van en orden y algunos piden un rango mínimo. Cada etapa se puede reintentar.</p>
    {mission && <p className={`result ${mission.ok ? "good" : "bad"}`}>{mission.text}</p>}
    <div className="list">{MISSIONS[s.side].map(m => {
      const done = s.done[m.id], ok = canStart(s, m);
      return <div className="item" key={m.id}>
        <div><h3>{m.title}</h3><div className="meta">{done ? "Hecha." : m.intro}</div>
          {!done && !ok && <div className="lock">{rk < m.rank ? `Pide rango ${RANKS[s.side!][m.rank]}` : "Primero terminá la anterior"}</div>}</div>
        <div className="act"><button className={ok ? "primary" : ""} disabled={busy || !ok} onClick={() => act({ type: "mstart", id: m.id })}>{done ? "Hecha" : "Empezar"}</button></div>
      </div>;
    })}</div>
  </>;
}

function Street({ s, act, busy }: Ui) {
  const p = s.side === "placa", weak = s.hp < maxHp(s) * MIN_HP_TO_FIGHT;
  return <>
    <h2>La calle</h2>
    <p>{p ? "Delincuentes que andan por tu zona. Si ganás, cobrás la recompensa y decomisás parte de lo que llevan."
          : "Policías que andan por tu zona. Si ganás, te quedás con parte de lo que llevan encima."} Cada pelea gasta {DUEL_COST} de energía. Los que dicen <span className="kind">jugador</span> son personas de verdad, y a vos también te pueden venir a buscar.</p>
    {weak && <p className="result bad">Estás muy golpeado para salir a pelear. Pasá por la guardia.</p>}
    <div className="list">{s.targets.map((t, i) => {
      const d = t.lvl - s.lvl;
      return <div className="item" key={`${t.name}-${i}`}>
        <div className="with-art">
          <Portrait src={t.kind === "player" ? avatarImg(t.avatar) : silhouette(t.name)} side={p ? "plata" : "placa"} silhouetteOf={t.kind !== "player"} size={56} />
          <div><h3>{t.name}<span className={`risk r${d < 0 ? 1 : d < 2 ? 2 : 3}`}>nivel {t.lvl}</span>{t.kind === "player" && <span className="kind">jugador</span>}</h3>
          <div className="meta num">Lleva unos {money(t.gold)}</div></div></div>
        <div className="act"><button disabled={busy || s.energy < DUEL_COST || weak} onClick={() => act({ type: "duel", i })}>{p ? "Arrestar" : "Atacar"}</button></div>
      </div>;
    })}</div>
    <div><button disabled={busy || s.energy < SCOUT_COST} onClick={() => act({ type: "scout" })}>Buscar a otros · {SCOUT_COST} energía</button></div>
  </>;
}

function Ranking({ s }: Ui) {
  const [rows, setRows] = useState<RankRow[] | null>(null);
  useEffect(() => { api.ranking().then(setRows).catch(() => setRows([])); }, [s.respect]);
  return <>
    <h2>Ranking de Bahía Gris</h2>
    <p>Quién manda en la ciudad, de los dos lados de la ley. Se ordena por respeto.</p>
    {!rows ? <p className="tag">Cargando…</p> :
      <ol className="ranking">{rows.map((r, i) => (
        <li key={`${r.name}-${i}`} className={r.me ? "me" : ""}>
          <span className="pos">{i + 1}</span>
          <span>{r.name} <span className={`badge ${r.side}`}>{r.side === "placa" ? "Policía" : "Delincuente"}</span>{!r.npc && !r.me && <span className="kind">jugador</span>}</span>
          <span className="tag num">nivel {r.lvl}</span><span className="num">{r.resp}</span>
        </li>))}
      </ol>}
  </>;
}
