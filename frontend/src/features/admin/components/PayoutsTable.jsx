import { useMemo, useState } from "react";
import { WalletCards } from "lucide-react";
import { updateWorkerPaymentStatus } from "../../../shared/api/workers";

/**
 * @param {{
 *   payouts: Array<{
 *     workerId: number, name: string, email?: string, percentage: number,
 *     assignedDomains: string[], assignedRevenue: number,
 *     assignedImpressions: number, payout: number, deletedAt?: string | null
 *   }>,
 *   totalPayout: number,
 *   workers?: Array<{
 *     id: number, paymentStatus?: string, paymentInfo?: { methodType: string, paymentDetails: string } | null
 *   }>,
 *   highlightedWorkerId?: number | null,
 *   onRefresh?: () => void,
 * }} props
 */
export default function PayoutsTable({
  payouts,
  totalPayout,
  workers = [],
  highlightedWorkerId = null,
  onRefresh,
}) {
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [updatingPaymentStatus, setUpdatingPaymentStatus] = useState(false);

  const workersById = useMemo(
    () => new Map(workers.map((worker) => [worker.id, worker])),
    [workers]
  );

  const payoutsOrdered = useMemo(() => {
    return [...payouts].sort((a, b) => {
      const aInactive = !!a.deletedAt;
      const bInactive = !!b.deletedAt;
      if (aInactive !== bInactive) return aInactive ? 1 : -1;
      return String(a.name || "").localeCompare(String(b.name || ""), "es");
    });
  }, [payouts]);

  async function handleTogglePaymentStatus() {
    if (!selectedWorker || selectedWorker.deletedAt) return;
    const currentStatus = selectedWorker.paymentStatus || "pending";
    const nextStatus = currentStatus === "paid" ? "pending" : "paid";
    setUpdatingPaymentStatus(true);
    try {
      await updateWorkerPaymentStatus(selectedWorker.workerId, nextStatus);
      setSelectedWorker(null);
      if (typeof onRefresh === "function") {
        await onRefresh();
      }
    } catch (err) {
      window.alert(err.message || "No se pudo actualizar el estado de pago");
    } finally {
      setUpdatingPaymentStatus(false);
    }
  }

  function openPaymentModal(payoutWorker) {
    const workerDetail = workersById.get(payoutWorker.workerId) || {};
    setSelectedWorker({
      ...payoutWorker,
      paymentStatus: workerDetail.paymentStatus || "pending",
      paymentInfo: workerDetail.paymentInfo || null,
    });
  }

  const isInactivePayoutRow = !!selectedWorker?.deletedAt;

  if (payouts.length === 0) {
    return (
      <p className="empty-state">
        Aún no hay trabajadores configurados. Agrega uno y asígnale subdominios para ver sus ganancias.
      </p>
    );
  }

  return (
    <>
      <div className="table-wrapper">
        <table className="reports-table">
          <thead>
            <tr>
              <th>Trabajador</th>
              <th>Subdominios asignados</th>
              <th>Impresiones</th>
              <th>Ingresos asignados</th>
              <th>%</th>
              <th>Ganancia</th>
              <th>Estado de pago</th>
              <th>Pagos</th>
            </tr>
          </thead>
          <tbody>
            {payoutsOrdered.map((w) => (
              <tr
                key={w.workerId}
                className={w.workerId === highlightedWorkerId ? "row-highlight" : ""}
              >
                <td>
                  <span className="worker-name">{w.name}</span>
                  <span className="worker-email">{w.email}</span>
                  <span
                    className={`worker-activity-badge ${w.deletedAt ? "is-inactive" : "is-active"}`}
                  >
                    {w.deletedAt ? "Inactivo" : "Activo"}
                  </span>
                </td>
                <td>
                  {w.assignedDomains.length === 0 ? (
                    <span className="no-domains">—</span>
                  ) : (
                    <div className="domain-tags">
                      {w.assignedDomains.map((d) => (
                        <span key={d} className="tag">
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td>{w.assignedImpressions.toLocaleString()}</td>
                <td>${w.assignedRevenue.toFixed(2)}</td>
                <td>{w.percentage}%</td>
                <td>
                  <span className="payout-amount">${w.payout.toFixed(2)}</span>
                </td>
                <td>
                  {w.deletedAt ? (
                    <span
                      className="payment-status-na"
                      title="El estado de pago no aplica a trabajadores inactivos"
                    >
                      —
                    </span>
                  ) : (
                    (() => {
                      const status = workersById.get(w.workerId)?.paymentStatus || "pending";
                      const statusLabel = status === "paid" ? "Pagado" : "Pendiente";
                      const statusClass = `payment-status-badge ${status === "paid" ? "is-paid" : "is-pending"}`;
                      return <span className={statusClass}>{statusLabel}</span>;
                    })()
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn-icon btn-payment"
                    title={
                      w.deletedAt
                        ? `Ver información de pago de ${w.name}`
                        : `Gestionar estado de pago de ${w.name}`
                    }
                    aria-label={
                      w.deletedAt
                        ? `Ver información de pago de ${w.name}`
                        : `Gestionar estado de pago de ${w.name}`
                    }
                    onClick={() => openPaymentModal(w)}
                  >
                    <WalletCards size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7} className="tfoot-label">
                Ganancia total
              </td>
              <td>
                <span className="payout-amount">${totalPayout.toFixed(2)}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {selectedWorker && (
        <div className="modal-overlay" onClick={() => setSelectedWorker(null)}>
          <div
            className="modal payment-status-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`payment-modal-title-${selectedWorker.workerId}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id={`payment-modal-title-${selectedWorker.workerId}`} className="modal-title">
                {isInactivePayoutRow
                  ? `Información de pago · ${selectedWorker.name}`
                  : `Estado de pago de ${selectedWorker.name}`}
              </h3>
              <button
                className="modal-close"
                aria-label="Cerrar"
                onClick={() => setSelectedWorker(null)}
              >
                ✕
              </button>
            </div>

            <div className="payment-status-modal-content">
              {isInactivePayoutRow && (
                <p className="payment-inactive-banner">
                  Perfil <strong>Inactivo</strong>: puedes revisar método y datos de pago registrados.
                  El <strong>estado de pago</strong> (pagado/pendiente) no aplica ni se muestra.
                </p>
              )}
              {!isInactivePayoutRow && (
                <div className="payment-status-summary">
                  <span
                    className={`payment-status-badge ${selectedWorker.paymentStatus === "paid" ? "is-paid" : "is-pending"}`}
                  >
                    {selectedWorker.paymentStatus === "paid" ? "Pagado" : "Pendiente de pago"}
                  </span>
                </div>
              )}

              {selectedWorker.paymentInfo ? (
                <div className="payment-info-card payment-info-card--admin">
                  <p className="payment-info-label">Método</p>
                  <p className="payment-info-value">{selectedWorker.paymentInfo.methodType}</p>
                  <p className="payment-info-label">Detalle</p>
                  <p className="payment-info-value">{selectedWorker.paymentInfo.paymentDetails}</p>
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
                onClick={() => setSelectedWorker(null)}
              >
                Cerrar
              </button>
              {!isInactivePayoutRow && (
                <button
                  type="button"
                  className={`btn ${selectedWorker.paymentStatus === "paid" ? "btn-warning" : "btn-success"}`}
                  onClick={handleTogglePaymentStatus}
                  disabled={updatingPaymentStatus}
                >
                  {updatingPaymentStatus
                    ? "Actualizando…"
                    : selectedWorker.paymentStatus === "paid"
                      ? "Marcar como pendiente"
                      : "Marcar como pagado"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
