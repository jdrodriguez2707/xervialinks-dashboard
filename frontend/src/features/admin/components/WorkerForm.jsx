import { useState, useEffect, useRef } from "react";
import { createWorker } from "../../../shared/api/workers";

/**
 * @param {{
 *   onCreated: () => void,
 *   triggerClassName?: string,
 *   triggerLabel?: string,
 *   openRequestId?: number,
 * }} props
 */
export default function WorkerForm({
  onCreated,
  triggerClassName = "btn btn-add-worker",
  triggerLabel = "+ Agregar trabajador",
  openRequestId = 0,
}) {
  const [open, setOpen] = useState(false);
  const lastOpenRequestId = useRef(0);

  useEffect(() => {
    if (openRequestId > lastOpenRequestId.current) {
      lastOpenRequestId.current = openRequestId;
      setOpen(true);
    }
  }, [openRequestId]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [percentage, setPercentage] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createWorker({
        name,
        email,
        percentage: parseFloat(percentage),
        password,
      });
      setName("");
      setEmail("");
      setPercentage("");
      setPassword("");
      handleClose();
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        {triggerLabel}
      </button>

      {open && (
        <div className="modal-overlay" onClick={handleClose}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="modal-title" className="modal-title">
                Nuevo trabajador
              </h3>
              <button
                className="modal-close"
                aria-label="Cerrar"
                onClick={handleClose}
              >
                ✕
              </button>
            </div>

            <form className="worker-form" onSubmit={handleSubmit}>
              <input
                type="text"
                className="form-input"
                placeholder="Nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <input
                type="email"
                className="form-input"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="number"
                className="form-input form-input-short"
                placeholder="% (ej. 70)"
                min="0.01"
                max="100"
                step="0.01"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                required
              />
              <input
                type="password"
                className="form-input"
                placeholder="Contraseña (para acceso al sistema)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error && <p className="form-error">{error}</p>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleClose}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn" disabled={submitting}>
                  {submitting ? "Creando…" : "Guardar trabajador"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
