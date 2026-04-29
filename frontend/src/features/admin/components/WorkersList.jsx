import { useState, useEffect } from "react";
import { addProperty, deleteWorker } from "../../../shared/api/workers";
import { fetchSites } from "../../../shared/api/sites";

/**
 * @param {{
 *   workers: Array<{ id: number, name: string, email: string, percentage: number, properties: Array }>,
 *   onUpdate: () => void
 * }} props
 */
export default function WorkersList({ workers, onUpdate }) {
  const [sites, setSites] = useState([]);

  useEffect(() => {
    fetchSites()
      .then(setSites)
      .catch(() => {});
  }, []);

  if (workers.length === 0) {
    return (
      <p className="empty-state">
        Aún no hay trabajadores. Usa el botón de arriba para agregar uno.
      </p>
    );
  }

  return (
    <div className="workers-list">
      {workers.map((worker) => (
        <WorkerCard
          key={worker.id}
          worker={worker}
          sites={sites}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}

function WorkerCard({ worker, sites, onUpdate }) {
  const [selectedSite, setSelectedSite] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const domains = worker.properties.filter((p) => p.type === "domain");

  // Sites not yet assigned to this worker
  const assignedValues = new Set(domains.map((p) => p.value));
  const availableSites = sites.filter((s) => !assignedValues.has(s));

  async function handleAddDomain(e) {
    e.preventDefault();
    if (!selectedSite) return;
    setError(null);
    setSubmitting(true);
    try {
      await addProperty(worker.id, { type: "domain", value: selectedSite });
      setSelectedSite("");
      onUpdate();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar a ${worker.name}? Esta acción no se puede deshacer.`))
      return;
    setDeleting(true);
    try {
      await deleteWorker(worker.id);
      onUpdate();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <div className="worker-card">
      {/* ── Header ── */}
      <div className="worker-card-header">
        <div className="worker-card-info">
          <p className="worker-name">{worker.name}</p>
          <p className="worker-email">{worker.email}</p>
        </div>
        <div className="worker-card-actions">
          <span className="percentage-badge">{worker.percentage}%</span>
          <button
            className="btn-icon btn-delete"
            aria-label={`Eliminar a ${worker.name}`}
            onClick={handleDelete}
            disabled={deleting}
            title="Eliminar trabajador"
          >
            {deleting ? "…" : "✕"}
          </button>
        </div>
      </div>

      {/* ── Assigned domains ── */}
      <div className="worker-properties">
        {domains.length > 0 ? (
          <div className="domain-tags">
            {domains.map((p) => (
              <span key={p.id} className="tag tag-domain">
                {p.value}
              </span>
            ))}
          </div>
        ) : (
          <p className="no-domains">Sin subdominios asignados.</p>
        )}
      </div>

      {/* ── Add domain form ── */}
      <form className="property-form" onSubmit={handleAddDomain}>
        <span className="property-form-label">Subdominio</span>
        <select
          className="form-select property-form-select"
          value={selectedSite}
          onChange={(e) => setSelectedSite(e.target.value)}
          required
        >
          <option value="" disabled>
            Seleccionar sitio…
          </option>
          {availableSites.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="btn btn-sm btn-add-domain"
          disabled={submitting || availableSites.length === 0}
        >
          {submitting ? "Agregando…" : "Agregar"}
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
