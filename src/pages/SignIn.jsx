import { useState } from "react";
import { signIn, verifyCode } from "../api.js";
import { Icon } from "../components/ui.jsx";

export default function SignIn({ onSignedIn }) {
  const [step, setStep] = useState("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (step === "password") {
        await signIn(email.trim(), password);
        setStep("code");
      } else {
        onSignedIn(await verifyCode(email.trim(), code.trim()));
      }
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
      <p className="page-sub" style={{ marginTop: 10 }}>For staff and admins only.</p>

      <form className="card" style={{ marginTop: 30, padding: 20 }} onSubmit={submit}>
        {step === "password" ? (
          <>
            <label className="field"><span>Email</span>
              <input className="input" type="email" autoComplete="username" value={email}
                     onChange={(e) => setEmail(e.target.value)} placeholder="you@dmarby.ph" required />
            </label>
            <label className="field"><span>Password</span>
              <input className="input" type="password" autoComplete="current-password" value={password}
                     onChange={(e) => setPassword(e.target.value)} required />
            </label>
          </>
        ) : (
          <label className="field"><span>6-digit code for {email}</span>
            <input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                   value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                   style={{ letterSpacing: 6, fontSize: 20, fontWeight: 700 }} autoFocus />
          </label>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy}>
          {busy ? "Checking…" : step === "password" ? "Sign in" : "Verify code"}
        </button>
        {step === "password" ? (
          <button type="button" className="btn" style={{ color: "var(--blue)", height: 40, marginTop: 6, fontSize: 13 }}>
            Forgot password?
          </button>
        ) : (
          <button type="button" className="btn" style={{ color: "var(--blue)", height: 40, marginTop: 6, fontSize: 13 }}
                  onClick={() => { setStep("password"); setCode(""); setError(""); }}>
            Use a different account
          </button>
        )}
      </form>

      <div className="note glass">
        <span aria-hidden>{Icon.lock}</span>
        <span>Admins confirm with a 6-digit code after signing in.</span>
      </div>
    </div>
  );
}
