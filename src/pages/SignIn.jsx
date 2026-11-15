import { useState } from "react";
import { signIn } from "../api.js";
import { Icon } from "../components/ui.jsx";

export default function SignIn({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      onSignedIn(await signIn(email.trim(), password));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signin">
      <div className="coin big">20</div>
      <h1>D' MARBY<br />Admin</h1>
      <p className="page-sub" style={{ marginTop: 10 }}>For D' MARBY admins only.</p>

      <form className="card" style={{ marginTop: 30, padding: 20 }} onSubmit={submit}>
        <label className="field"><span>Email</span>
          <input className="input" type="email" autoComplete="username" value={email}
                 onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" required />
        </label>
        <label className="field"><span>Password</span>
          <input className="input" type="password" autoComplete="current-password" value={password}
                 onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <button type="button" className="btn" style={{ color: "var(--blue)", height: 40, marginTop: 6, fontSize: 13 }}
                onClick={() => setHelp((h) => !h)}>
          Forgot password?
        </button>
        {help && (
          <p className="muted small" style={{ textAlign: "center", lineHeight: 1.5 }}>
            Ask another admin to reset it in Supabase, under Authentication, then Users.
          </p>
        )}
      </form>

      <div className="note glass">
        <span aria-hidden>{Icon.lock}</span>
        <span>Only accounts on the admin list can see machine data.</span>
      </div>
    </div>
  );
}
