import { useState } from "react";
import {
  clamp, ENERGY_EVERY, ENERGY_MAX, maxHp, money, RANKS, rankOf, SHOP, STAT_NAMES, xpNeed,
  type FightView, type PlayerState, type StatKey
} from "@pop/shared";

export function Bar({ cls, label, v, max, note }: { cls: string; label: string; v: number; max: number; note?: string }) {
  return (
    <div className={`bar ${cls}`}>
      <div className="row"><span>{label}{note && <> <span className="tag">{note}</span></>}</span><span className="num">{v} / {max}</span></div>
      <div className="track"><div className="fill" style={{ width: `${clamp(v / max * 100, 0, 100)}%` }} /></div>
    </div>
  );
}

export function Sheet({ s, now }: { s: PlayerState; now: number }) {
  const mh = maxHp(s);
  const nextE = s.energy < ENERGY_MAX ? Math.max(0, Math.ceil((ENERGY_EVERY - (now - s.tEnergy)) / 1000)) : 0;
  const w = SHOP.find(i => i.id === s.gear.arma), a = SHOP.find(i => i.id === s.gear.armadura);
  return (
    <aside className="sheet">
      <div className="who">
        <h2>{s.name}</h2>
        {s.side === "placa" ? <span className="badge placa">Policía</span> : s.side === "plata" ? <span className="badge plata">Delincuente</span> : <span className="badge">Recién llegado</span>}
        <span className="tag">Nivel {s.lvl}</span>
      </div>
      <Bar cls="hp" label="Vida" v={Math.round(s.hp)} max={mh} />
      <Bar cls="en" label="Energía" v={s.energy} max={ENERGY_MAX} note={nextE ? `+1 en ${nextE}s` : ""} />
      <Bar cls="xp" label="Experiencia" v={s.xp} max={xpNeed(s)} />
      {s.side === "plata" && <Bar cls="heat" label="Calor policial" v={s.heat} max={100} note={s.heat >= 60 ? "cuidado" : ""} />}
      {s.side && <div className="stat"><span>{RANKS[s.side][rankOf(s)]}</span><span className="num">{s.respect} de respeto</span></div>}
      <div className="money"><span>Plata</span><span className="num">{money(s.gold)}</span></div>
      {s.tabs.includes("gimnasio") && (
        <div className="stats">{(Object.keys(STAT_NAMES) as StatKey[]).map(k =>
          <div className="stat" key={k}><span>{STAT_NAMES[k]}</span><span className="num">{s.stats[k]}</span></div>)}
        </div>
      )}
      {s.tabs.includes("feria") && (
        <div className="gear">
          <span>Mano: {w ? `${w.name} (+${w.val})` : "nada"}</span>
          <span>Encima: {a ? `${a.name} (+${a.val})` : "ropa de calle"}</span>
          {s.potions > 0 && <span>Botiquines: {s.potions}</span>}
        </div>
      )}
    </aside>
  );
}

export function Fight({ f }: { f: FightView }) {
  return (
    <section className={`fight ${f.won ? "" : "shake"}`} aria-live="polite">
      <div className="vs">
        <div className="side"><h3>{f.p.name}</h3><Bar cls="hp" label="Vida" v={f.p.hp} max={f.p.max} /></div>
        <div className="mid">VS</div>
        <div className="side"><h3>{f.e.name}</h3><Bar cls="hp" label="Vida" v={f.e.hp} max={f.e.max} /></div>
      </div>
      <div className="rounds">{f.rounds.map((r, i) => <div key={i} className={r.who}>{r.txt}</div>)}</div>
      <div className={`verdict ${f.won ? "win" : "lose"}`}>{f.won ? "Ganaste" : "Perdiste"}</div>
    </section>
  );
}

const hhmm = (t: number) => new Date(t).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

export function Chronicle({ s, onOut }: { s: PlayerState; onOut: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <section className="log">
      <div className="foot"><h3>Crónica</h3>
        <div className="confirm">{confirm
          ? <>¿Salir de tu cuenta? <button className="primary" onClick={onOut}>Sí, salir</button><button onClick={() => setConfirm(false)}>Cancelar</button></>
          : <button className="link" onClick={() => setConfirm(true)}>Salir</button>}
        </div>
      </div>
      <ol>{s.log.map((l, i) => <li key={i}><time>{hhmm(l.t)}</time><span className={l.cls}>{l.msg}</span></li>)}</ol>
    </section>
  );
}
