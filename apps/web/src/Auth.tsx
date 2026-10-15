import { useState, type FormEvent } from "react";
import { api } from "./api";
import { AVATARS, avatarImg, Portrait } from "./art";

export function Auth({ onIn }: { onIn: () => void }) {
  const [mode, setMode] = useState<"new" | "login">("new");
  const [username, setUser] = useState("");
  const [password, setPass] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await (mode === "new" ? api.register(username.trim(), password, avatar) : api.login(username.trim(), password)); onIn(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <section id="auth">
      <div><div className="tag">Bahía Gris · de noche</div><h1>Placa <span className="o">o</span> Plata</h1></div>
      <p>Llegás a Bahía Gris con un bolso y diez pesos. Marga, la dueña del bar La Esquina, te da un lugar donde dormir a cambio de que le hagas unos encargos. Después vas a tener que elegir: la placa o la plata.</p>
      <form onSubmit={submit}>
        <h3>{mode === "new" ? "Bajar del micro" : "Volver a Bahía Gris"}</h3>
        <label className="tag" htmlFor="u">{mode === "new" ? "¿Cómo te llamás?" : "Tu nombre"}</label>
        <input id="u" value={username} onChange={e => setUser(e.target.value)} maxLength={20} autoComplete="username" required />
        {mode === "new" && <>
          <span className="tag">¿Cómo sos?</span>
          <div className="avatars" role="group" aria-label="Elegí tu cara">
            {AVATARS.map(n => <button type="button" key={n} aria-pressed={avatar === n} aria-label={`Cara ${n}`} onClick={() => setAvatar(n)}><Portrait src={avatarImg(n)} size={64} /></button>)}
          </div>
        </>}
        <label className="tag" htmlFor="p">Contraseña</label>
        <input id="p" type="password" value={password} onChange={e => setPass(e.target.value)}
          autoComplete={mode === "new" ? "new-password" : "current-password"} minLength={6} required />
        {err && <p className="err" role="alert">{err}</p>}
        <div className="row">
          <button className="primary" disabled={busy}>{mode === "new" ? "Bajar del micro" : "Entrar"}</button>
          <button type="button" className="link" onClick={() => { setMode(mode === "new" ? "login" : "new"); setErr(""); }}>
            {mode === "new" ? "Ya tengo personaje" : "Crear un personaje nuevo"}
          </button>
        </div>
      </form>
    </section>
  );
}
