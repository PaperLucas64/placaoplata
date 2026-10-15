/* El chat de la ciudad: un solo canal para todos. Los mensajes llegan en vivo; al abrirlo se ven los últimos. */
import { useEffect, useRef, useState } from "react";
import { GANGS } from "@pop/shared";
import { api, type ChatMsg } from "./api";

export const CHAT_MAX = 280;
const hhmm = (t: number) => new Date(t).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

export function Chat({ msgs, myName, onSent, toast }: { msgs: ChatMsg[]; myName: string; onSent: (m: ChatMsg) => void; toast: (text: string) => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  /* siempre mostrando lo último */
  useEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs.length]);
  const send = async () => {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    try { onSent(await api.say(msg)); setText(""); }
    catch (e: any) { toast(e.message); }
    finally { setSending(false); }
  };
  return <section className="chat">
    <p className="tag">El chat de Maires: lo lee todo el que está conectado.</p>
    <ol ref={list} aria-live="polite">
      {msgs.length === 0 && <li className="empty">Todavía no habló nadie. Arrancá vos.</li>}
      {msgs.map(m => {
        const mine = m.me || m.name === myName;
        return <li key={m.id} className={mine ? "mine" : ""}>
          <span className="who" style={{ color: m.gang ? GANGS[m.gang].color : undefined }}>{m.name}</span>
          <time className="num">{hhmm(m.t)}</time>
          <span className="msg">{m.msg}</span>
        </li>;
      })}
    </ol>
    <form onSubmit={e => { e.preventDefault(); send(); }}>
      <input id="chat-msg" value={text} maxLength={CHAT_MAX} placeholder="Escribí un mensaje" aria-label="Mensaje para el chat"
        onChange={e => setText(e.target.value)} autoComplete="off" />
      <button className="primary" disabled={sending || !text.trim()}>Mandar</button>
    </form>
  </section>;
}
