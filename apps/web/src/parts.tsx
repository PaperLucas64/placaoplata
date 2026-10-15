import { useState, type ReactNode } from "react";
import {
  clamp, energyMax, findMission, HOME, ENERGY_EVERY, gangOf, maxHp, money, RANK_NAMES, rankOf, SHOP, STAT_NAMES, xpNeed,
  type FightView, type PlayerState, type StatKey, attackVal, defenseVal, SLOTS, SLOT_NAMES } from "@pop/shared";
import { avatarImg, GangBadge, GangRing, Portrait, portraitOf } from "./art";
import { ItemIcon } from "./icons";

export function Bar({ cls, label, v, max, note }: { cls: string; label: string; v: number; max: number; note?: string }) {
  return (
    <div className={`bar ${cls}`}>
      <div className="row"><span>{label}{note && <> <span className="tag">{note}</span></>}</span><span className="num">{v} / {max}</span></div>
      <div className="track"><div className="fill" style={{ width: `${clamp(v / max * 100, 0, 100)}%` }} /></div>
    </div>
  );
}

export function Sheet({ s, now, onCancel, disabled }: { s: PlayerState; now: number; onCancel: () => void; disabled: boolean }) {
  const mh = maxHp(s);
  const em = energyMax(s), g = gangOf(s);
  const nextE = s.energy < em ? Math.max(0, Math.ceil((ENERGY_EVERY - (now - s.tEnergy)) / 1000)) : 0;

  return (
    <aside className="sheet">
      <div className="who-row">
      <GangRing s={s} size={84} />
      <div className="who">
        <h2>{s.name}</h2>
        {s.tutDone ? <GangBadge gang={g} /> : <span className="badge">Recién llegado</span>}
        <span className="tag">Nivel {s.lvl}</span>
      </div>
      </div>
      <BusyBar s={s} now={now} onCancel={onCancel} disabled={disabled} />
      <Bar cls="hp" label="Vida" v={Math.round(s.hp)} max={mh} />
      <Bar cls="en" label="Energía" v={s.energy} max={em} note={nextE ? `+1 en ${nextE}s` : ""} />
      <Bar cls="xp" label="Experiencia" v={s.xp} max={xpNeed(s)} />
      {s.tutDone && <Bar cls="heat" label="Nivel de búsqueda" v={s.heat} max={100} note={s.heat >= 60 ? "cuidado" : ""} />}
      {s.tutDone && <div className="stat"><span>{RANK_NAMES[rankOf(s)]}</span><span className="num">{s.respect} de respeto</span></div>}
      <div className="money"><span>Plata encima</span><span className="num">{money(s.gold)}</span></div>
      {s.home.safe > 0 && <div className="stat"><span>En la caja fuerte</span><span className="num">{money(s.home.safe)}</span></div>}
      {s.tabs.includes("gimnasio") && (
        <div className="stats">{(Object.keys(STAT_NAMES) as StatKey[]).map(k =>
          <div className="stat" key={k}><span>{STAT_NAMES[k]}</span><span className="num">{s.stats[k]}</span></div>)}
        </div>
      )}
      {s.tabs.includes("feria") && (
        <div className="gear">
          <div className="stat"><span>Golpe</span><span className="num">+{attackVal(s)}</span></div>
          <div className="stat"><span>Protección</span><span className="num">+{defenseVal(s)}</span></div>
          <div className="gear-row">{SLOTS.map(k => s.gear[k]
            ? <span key={k} title={`${SLOT_NAMES[k]}: ${SHOP.find(i => i.id === s.gear[k])?.name}`}><ItemIcon id={s.gear[k]!} /></span>
            : <span key={k} className="icon empty" title={`${SLOT_NAMES[k]}: vacío`} />)}</div>
          {s.potions > 0 && <span>Botiquines: {s.potions}</span>}
        </div>
      )}
    </aside>
  );
}

export function Fight({ f, s }: { f: FightView; s: PlayerState }) {
  return (
    <section className={`fight ${f.won ? "" : "shake"}`} aria-live="polite">
      <div className="vs">
        <div className="side"><Portrait src={avatarImg(s.avatar)} gang={gangOf(s)} size={72} /><h3>{f.p.name}</h3><Bar cls="hp" label="Vida" v={f.p.hp} max={f.p.max} /></div>
        <div className="mid">VS</div>
        <div className="side"><Portrait src={portraitOf(f.e.name)} silhouetteOf size={72} /><h3>{f.e.name}</h3><Bar cls="hp" label="Vida" v={f.e.hp} max={f.e.max} /></div>
      </div>
      <div className="rounds">{f.rounds.map((r, i) => <div key={i} className={r.who}>{r.txt}</div>)}</div>
      <div className={`verdict ${f.won ? "win" : "lose"}`}>{f.won ? "Ganaste" : "Perdiste"}</div>
    </section>
  );
}

const hhmm = (t: number) => new Date(t).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

export function Chronicle({ s, onOut }: { s: PlayerState; onOut: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [credits, setCredits] = useState(false);
  return (
    <section className="log">
      <div className="foot"><h3>Crónica</h3>
        <div className="confirm">{confirm
          ? <>¿Salir de tu cuenta? <button className="primary" onClick={onOut}>Sí, salir</button><button onClick={() => setConfirm(false)}>Cancelar</button></>
          : <><button className="link" onClick={() => setCredits(true)}>Créditos</button><button className="link" onClick={() => setConfirm(true)}>Salir</button></>}
        </div>
      </div>
      <ol>{s.log.map((l, i) => <li key={i}><time>{hhmm(l.t)}</time><span className={l.cls}>{l.msg}</span></li>)}</ol>
      {credits && <Credits onClose={() => setCredits(false)} />}
    </section>
  );
}

/* Créditos del arte (algunas licencias lo piden; las demás lo agradecen). Ver docs/CREDITOS.md */
export function Credits({ onClose }: { onClose: () => void }) {
  return (
    <div className="credits" role="dialog" aria-modal="true" aria-label="Créditos" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}>
        <h2>Créditos</h2>
        <p>Maires es un juego de Mauspi Lab.</p>
        <ul>
          <li><b>Fondos:</b> Noraneko Games (@NoranekoGames), packs de fondos para novela visual. Modificados (recorte y filtro nocturno).</li>
          <li><b>Retratos y siluetas:</b> わたおきば / Wataokiba (わたおび), personajes de cuerpo entero. Recortados.</li>
          <li><b>Armas de fuego:</b> arlantr, Free Guns Pixel Art (arlantr.itch.io).</li>
          <li><b>Íconos:</b> Prinbles, Yet Another Icons (prinbles.itch.io), y Robert Brooks, gamedeveloperstudio.com.</li>
          <li><b>Resto de íconos, código y diseño:</b> Mauspi Lab.</li>
        </ul>
        <div><button className="primary" onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  );
}

const mmss = (ms: number) => { const t = Math.ceil(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };

/* Lo que estás haciendo en tiempo real (entrenar, guardia) y la obra de la casa: cuenta regresiva con su línea de tiempo */
function Countdown({ label, since, until, now, note, action }: { label: string; since: number; until: number; now: number; note?: string; action?: ReactNode }) {
  const total = Math.max(1, until - since), left = Math.max(0, until - now);
  return (
    <div className="busy" aria-live="polite">
      <div className="row"><b>{label}</b><span className="num">{mmss(left)}</span></div>
      <div className="track"><div className="fill" style={{ width: `${clamp((1 - left / total) * 100, 0, 100)}%` }} /></div>
      {(note || action) && <div className="row"><span className="tag">{note}</span>{action}</div>}
    </div>
  );
}

export function BusyBar({ s, now, onCancel, disabled }: { s: PlayerState; now: number; onCancel: () => void; disabled: boolean }) {
  const b = s.busy, o = s.home?.obra;
  if (!b && !o) return null;
  return <>
    {b && <Countdown now={now} since={b.since} until={b.until}
      label={b.kind === "gym" ? `Entrenando ${STAT_NAMES[b.stat].toLowerCase()}` : b.kind === "mision" ? `Misión: ${findMission(s, b.id)?.title ?? ""}`
        : b.kind === "caza" ? `Buscando a ${b.targetName}` : b.kind === "vuelta" ? (b.safe ? "En ambulancia a casa" : "Volviendo a casa")
        : b.kind === "salida" ? `${b.what === "golpe" ? "Golpe" : "Encargo"} en ${b.place}`
        : b.clinic ? "En la clínica" : "En la guardia"}
      note={b.kind === "gym" ? "Si cortás, perdés la plata y el punto." : b.kind === "mision" ? `Etapa ${Math.min(b.done + 1, findMission(s, b.id)?.steps.length ?? 1)} · la crónica te cuenta.`
        : b.kind === "caza" ? `Lo cruzás cerca de ${b.place}. Lo ves en el mapa.` : b.kind === "vuelta" ? (b.safe ? "Nadie te puede tocar." : "Andás por la calle: podés arrancar otra cosa desde acá.")
        : b.kind === "salida" ? "Cuando lo hagas, la crónica te cuenta cómo salió."
        : "Mientras te curan, nadie te puede tocar."}
      action={b.kind === "vuelta" ? undefined : <button className="link" disabled={disabled} onClick={onCancel}>Cancelar</button>} />}
    {o && <Countdown now={now} since={o.since} until={o.until} label={`Obra: ${HOME[o.part].levels[s.home[o.part] + 1]?.name.toLowerCase()}`} />}
  </>;
}
