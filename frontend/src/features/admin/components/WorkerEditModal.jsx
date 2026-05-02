import { useEffect, useMemo, useState } from "react";
import { updateWorker } from "../../../shared/api/workers";

/**
 * @param {{
 *   worker: object,
 *   sites: string[],
 *   globallyAssignedDomains: Set<string>,
 *   onClose: () => void,
 *   onSaved: () => void | Promise<void>,
 * }} props
 */
export default function WorkerEditModal({ worker, sites, globallyAssignedDomains, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [percentage, setPercentage] = useState("");
  const [password, setPassword] = useState("");
  const [domains, setDomains] = useState([]);
  const [selectedSite, setSelectedSite] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!worker) return;
    setName(worker.name || "");
    setEmail(worker.email || "");
    setPercentage(String(worker.percentage ?? ""));
    setPassword("");
    setDomains(
      (worker.properties || [])
        .filter((p) => p.type === "domain")
        .map((p) => p.value)
    );
    setSelectedSite("");
    setError(null);
  }, [worker]);

  const availableSites = useMemo(() => {
    const set = new Set(domains);
    return sites.filter((s) => !globallyAssignedDomains.has(s) || set.has(s));
  }, [sites, globallyAssignedDomains, domains]);

  function removeDomain(value) {
    setDomains((prev) => prev.filter((d) => d !== value));
  }

  function addDomainFromSelect(e) {
    e.preventDefault();
    if (!selectedSite) return;
    if (domains.includes(selectedSite)) return;
    setDomains((prev) => [...prev, selectedSite]);
    setSelectedSite("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const pct = parseFloat(percentage);
      const payload = {
        name: name.trim(),
        email: email.trim(),
        percentage: pct,
        domains,
      };
      if (password.trim()) {
        payload.password = password.trim();
      }
      await updateWorker(worker.id, payload);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "No se pudo guardar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal worker-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`worker-edit-title-${worker.id}`}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id={`worker-edit-title-${worker.id}`} className="modal-title">
            Editar trabajador · {worker.name}
          </h3>
          <button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="worker-form worker-edit-form" onSubmit={handleSubmit}>
          <label className="worker-edit-label">
            Nombre
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              required
            />
          </label>
          <label className="worker-edit-label">
            Correo
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
            />
          </label>
          <label className="worker-edit-label">
            Contraseña
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              placeholder="Dejar en blanco para no cambiar"
              autoComplete="new-password"
            />
          </label>
          <label className="worker-edit-label">
            Porcentaje (%)
            <input
              type="number"
              className="form-input form-input-short"
              min="0.01"
              max="100"
              step="0.01"
              value={percentage}
              onChange={(ev) => setPercentage(ev.target.value)}
              required
            />
          </label>

          <div className="worker-edit-domains">
            <span className="worker-edit-domains-title">Subdominios</span>
            <p className="worker-edit-domains-hint">
              Puedes quitar o añadir subdominios aquí. Los cambios se guardan al pulsar «Guardar cambios».
            </p>
            {domains.length > 0 ? (
              <ul className="worker-edit-domain-list">
                {domains.map((d) => (
                  <li key={d} className="worker-edit-domain-row">
                    <span className="worker-edit-domain-value">{d}</span>
                    <button
                      type="button"
                      className="btn-icon btn-edit-domain-remove"
                      aria-label={`Quitar ${d}`}
                      onClick={() => removeDomain(d)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="worker-edit-domains-empty">Sin subdominios en este perfil.</p>
            )}
            <div className="worker-edit-domain-add">
              <select
                className="form-select"
                value={selectedSite}
                onChange={(ev) => setSelectedSite(ev.target.value)}
                aria-label="Subdominio a añadir"
              >
                <option value="">Elegir subdominio disponible…</option>
                {availableSites.map((s) => (
                  <option key={s} value={s} disabled={domains.includes(s)}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-sm"
                disabled={!selectedSite || availableSites.length === 0}
                onClick={addDomainFromSelect}
              >
                Añadir
              </button>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
