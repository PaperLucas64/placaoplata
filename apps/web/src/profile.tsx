/* El perfil de otro jugador, como en BiteFight: quién es, sus atributos, cómo le va y cuánto avanzó en la historia.
   Desde acá se lo agrega de amigo. */
import { useEffect, useState } from "react";
import { GANGS, GANG_KEYS, RANK_NAMES, STAT_NAMES, STORY_NAME, type StatKey } from "@pop/shared";
import { api, type Profile } from "./api";
import { avatarImg, GangBadge, Portrait } from "./art";

const fecha = (t: number) => new Date(t).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

export function ProfilePanel({ id, toast }: { id: number; toast: (text: string, good?: boolean) => void }) {
  const [p, setP] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const load = () => api.profile(id).then(x => { setP(x); setError(null); }).catch(e => setError(e.message));
  useEffect(() => { setP(null); load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <p className="tag">{error}</p>;
  if (!p) return <p className="tag">Buscando…</p>;

  const befriend = async () => {
    setSending(true);
    try {
      if (p.friend === "received") { await api.acceptFriend(p.id); toast(`Ahora sos amigo de ${p.name}.`, true); }
      else { const r = await api.addFriend(p.name); toast(r.accepted ? `Ahora sos amigo de ${p.name}.` : `Le mandaste una solicitud a ${p.name}.`, true); }
      await load();
    } catch (e: any) { toast(e.message); }
    finally { setSending(false); }
  };
  const fights = p.wins + p.losses;
  const storyDone = p.story.reduce((a, x) => a + x.done, 0), storyOf = p.story.reduce((a, x) => a + x.of, 0);
  return <section className="profile">
    <header>
      <Portrait src={avatarImg(p.avatar)} gang={p.gang} size={84} />
      <div>
        <h2>{p.name}</h2>
        <div className="row"><GangBadge gang={p.gang} /><span className="tag">{RANK_NAMES[p.rank] ?? ""}</span></div>
        <div className="tag num">Nivel {p.lvl} · {p.respect} de respeto · <span className={`live ${p.online ? "on" : ""}`}>{p.online ? "en línea" : "desconectado"}</span></div>
        <div className="tag">En Buenos Aires desde el {fecha(p.since)}</div>
      </div>
    </header>

    {p.friend !== "me" && <div className="profile-friend">
      {p.friend === "friend" ? <span className="tag">Son amigos.</span>
        : p.friend === "sent" ? <span className="tag">Le mandaste una solicitud de amistad. Falta que la acepte.</span>
        : <button className="primary" disabled={sending} onClick={befriend}>{p.friend === "received" ? "Aceptar su solicitud de amistad" : "Agregar de amigo"}</button>}
    </div>}

    <h3>Atributos</h3>
    <div className="profile-stats">{(Object.keys(STAT_NAMES) as StatKey[]).map(k => <div key={k}><span>{STAT_NAMES[k]}</span><b className="num">{p.stats[k]}</b></div>)}</div>

    <h3>Peleas</h3>
    <p className="num">{fights ? <>{p.wins} ganadas · {p.losses} perdidas · gana {Math.round(p.wins / fights * 100)}%</> : "Todavía no peleó."}</p>

    <h3>Pandillas</h3>
    <div className="profile-aff">{GANG_KEYS.map(g => {
      const total = GANG_KEYS.reduce((a, k) => a + (p.aff[k] ?? 0), 0) || 1;
      return <div key={g}><span style={{ color: GANGS[g].color }}>{GANGS[g].name}</span>
        <span className="track"><span className="fill" style={{ width: `${(p.aff[g] ?? 0) / total * 100}%`, background: GANGS[g].color }} /></span></div>;
    })}</div>

    <h3>Historia</h3>
    <p className="tag num">{storyDone} de {storyOf} misiones del Episodio 01 · {p.side} misiones secundarias descubiertas</p>
    <div className="profile-story">{p.story.map(x => <div key={x.gang}>
      <span style={{ color: GANGS[x.gang].color }}>{STORY_NAME[x.gang]}</span><b className="num">{x.done} de {x.of}</b></div>)}</div>
  </section>;
}
