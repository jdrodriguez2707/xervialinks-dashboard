import { useState } from "react";
import { login } from "../../../shared/api/auth";
import { toUserErrorMessage } from "../../../shared/lib/uiError";

/**
 * @param {{ onLogin: (user: object) => void, notice?: string | null }} props
 */
export default function LoginForm({ onLogin, notice = null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { user } = await login(email, password);
      onLogin(user);
    } catch (err) {
      setError(toUserErrorMessage(err, "No se pudo iniciar sesión. Inténtalo nuevamente."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-bg-art" aria-hidden="true" />
      <div className="login-card">
        <h1 className="login-title">XerviaLinks Metrics</h1>
        <p className="login-subtitle">Ingresa tus credenciales para continuar</p>
        {typeof notice === "string" && notice.trim() ? (
          <p className="status-msg">{notice}</p>
        ) : null}

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            type="email"
            className="form-input"
            placeholder="Correo electrónico"
            aria-label="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />

          <input
            type="password"
            className="form-input"
            placeholder="Contraseña"
            aria-label="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn login-btn" disabled={submitting}>
            {submitting ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
