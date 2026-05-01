import { Trash2 } from "lucide-react";
import { purgeInactiveWorker } from "../../../shared/api/workers";

/**
 * @param {{
 *   payouts: Array<{
 *     workerId: number, name: string, percentage: number,
 *     assignedDomains: string[], assignedRevenue: number,
 *     assignedImpressions: number, payout: number, deletedAt?: string | null
 *   }>,
 *   totalPayout: number,
 *   onPurgeInactive?: () => void
 * }} props
 */
export default function PayoutsTable({ payouts, totalPayout, onPurgeInactive }) {
  async function handlePurgeInactive(worker) {
    const confirmed = window.confirm(`Eliminar definitivamente a ${worker.name}? Esta acción es permanente.`);
    if (!confirmed) return;
    try {
      await purgeInactiveWorker(worker.workerId);
      if (typeof onPurgeInactive === "function") onPurgeInactive();
    } catch (err) {
      window.alert(err.message || "No se pudo eliminar al trabajador inactivo");
    }
  }

  if (payouts.length === 0) {
    return (
      <p className="empty-state">
        Aún no hay trabajadores configurados. Agrega uno y asígnale subdominios para ver sus ganancias.
      </p>  
    );
  }

  return (
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
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((w) => (
            <tr key={w.workerId}>
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
                  <button
                    type="button"
                    className="btn-icon btn-delete"
                    onClick={() => handlePurgeInactive(w)}
                    title="Eliminar definitivamente trabajador inactivo"
                    aria-label={`Eliminar definitivamente a ${w.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                ) : (
                  <span className="no-domains">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} className="tfoot-label">
              Ganancia total
            </td>
            <td>
              <span className="payout-amount">${totalPayout.toFixed(2)}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
