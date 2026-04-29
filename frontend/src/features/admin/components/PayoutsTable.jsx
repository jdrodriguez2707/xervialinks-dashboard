/**
 * @param {{
 *   payouts: Array<{
 *     workerId: number, name: string, percentage: number,
 *     assignedDomains: string[], assignedRevenue: number,
 *     assignedImpressions: number, payout: number
 *   }>,
 *   totalPayout: number
 * }} props
 */
export default function PayoutsTable({ payouts, totalPayout }) {
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
          </tr>
        </thead>
        <tbody>
          {payouts.map((w) => (
            <tr key={w.workerId}>
              <td>
                <span className="worker-name">{w.name}</span>
                <span className="worker-email">{w.email}</span>
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
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} className="tfoot-label">
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
