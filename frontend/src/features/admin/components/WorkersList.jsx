import { useMemo, useState } from "react";
import { WalletCards } from "lucide-react";
import {
  addProperty,
  deleteWorker,
  updateWorkerPaymentStatus,
} from "../../../shared/api/workers";

/**
 * @param {{
 *   workers: Array<{ id: number, name: string, email: string, percentage: number, properties: Array }>,
 *   sites: string[],
 *   onUpdate: () => void
 * }} props
 */
export default function WorkersList({ workers, sites = [], onUpdate }) {
  const globallyAssignedDomains = new Set(
    workers.flatMap((w) =>
      w.properties
        .filter((p) => p.type === "domain")
        .map((p) => p.value)
    )
  );

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
          globallyAssignedDomains={globallyAssignedDomains}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}

function WorkerCard({ worker, sites, globallyAssignedDomains, onUpdate }) {
  const [selectedSite, setSelectedSite] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [openPaymentModal, setOpenPaymentModal] = useState(false);
  const [updatingPaymentStatus, setUpdatingPaymentStatus] = useState(false);

  const domains = worker.properties.filter((p) => p.type === "domain");
  const paymentInfo = worker.paymentInfo || null;
  const paymentStatus = worker.paymentStatus || "pending";
  const isPaid = paymentStatus === "paid";
  const paymentStatusLabel = isPaid ? "Pagado" : "Pendiente de pago";

  // Sites still unassigned to any worker (exclusive ownership per domain).
  const availableSites = sites.filter((s) => !globallyAssignedDomains.has(s));

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

  async function handleTogglePaymentStatus() {
    const nextStatus = isPaid ? "pending" : "paid";
    setError(null);
    setUpdatingPaymentStatus(true);
    try {
      await updateWorkerPaymentStatus(worker.id, nextStatus);
      onUpdate();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingPaymentStatus(false);
    }
  }

  const statusClassName = useMemo(
    () => `payment-status-badge ${isPaid ? "is-paid" : "is-pending"}`,
    [isPaid]
  );

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
          <div className="worker-properties-row">
            <div className="domain-tags">
              {domains.map((p) => (
                <span key={p.id} className="tag tag-domain">
                  {p.value}
                </span>
              ))}
            </div>
            <button
              type="button"
              className="btn-icon btn-payment"
              title="Ver estado e información de pago"
              aria-label={`Ver información de pago de ${worker.name}`}
              onClick={() => setOpenPaymentModal(true)}
            >
              <WalletCards size={16} />
            </button>
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

      <div className="worker-payment-status-row">
        <span className={statusClassName}>{paymentStatusLabel}</span>
      </div>

      {error && <p className="form-error">{error}</p>}

      {openPaymentModal && (
        <div className="modal-overlay" onClick={() => setOpenPaymentModal(false)}>
          <div
            className="modal payment-status-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`payment-modal-title-${worker.id}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id={`payment-modal-title-${worker.id}`} className="modal-title">
                Estado de pago de {worker.name}
              </h3>
              <button
                className="modal-close"
                aria-label="Cerrar"
                onClick={() => setOpenPaymentModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="payment-status-modal-content">
              <div className="payment-status-summary">
                <span className={statusClassName}>{paymentStatusLabel}</span>
              </div>

              {paymentInfo ? (
                <div className="payment-info-card payment-info-card--admin">
                  <p className="payment-info-label">Método</p>
                  <p className="payment-info-value">{paymentInfo.methodType}</p>
                  <p className="payment-info-label">Detalle</p>
                  <p className="payment-info-value">{paymentInfo.paymentDetails}</p>
                </div>
              ) : (
                <div className="payment-empty payment-empty--admin">
                  <p className="payment-empty-title">Información de pago pendiente</p>
                  <p className="payment-empty-text">
                    El trabajador aún no ha registrado su método e información de pago.
                  </p>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setOpenPaymentModal(false)}
              >
                Cerrar
              </button>
              <button
                type="button"
                className={`btn ${isPaid ? "btn-warning" : "btn-success"}`}
                onClick={handleTogglePaymentStatus}
                disabled={updatingPaymentStatus}
              >
                {updatingPaymentStatus
                  ? "Actualizando…"
                  : isPaid
                    ? "Marcar como pendiente"
                    : "Marcar como pagado"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
