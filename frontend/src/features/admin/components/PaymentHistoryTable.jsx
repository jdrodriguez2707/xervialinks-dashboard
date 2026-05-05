import { useMemo } from "react";

export default function PaymentHistoryTable({ rows = [] }) {
  const orderedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime()
      ),
    [rows]
  );

  if (orderedRows.length === 0) {
    return (
      <p className="empty-state">
        Aún no hay pagos registrados. Cuando marques trabajadores como pagados aparecerán aquí.
      </p>
    );
  }

  return (
    <div className="table-wrapper">
      <table className="reports-table">
        <thead>
          <tr>
            <th>Fecha de pago</th>
            <th>Estado</th>
            <th>Trabajador</th>
            <th>Método de pago</th>
            <th>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {orderedRows.map((row, idx) => (
            <tr key={`${row.workerName}-${row.paymentMonth}-${row.paidAt}-${idx}`}>
              <td>{formatPaidAt(row.paidAt)}</td>
              <td>
                <span className="payment-status-badge is-paid">{row.statusLabel || "Pago realizado"}</span>
              </td>
              <td>{row.workerName}</td>
              <td>{row.methodType || "-"}</td>
              <td>
                <span className="payout-amount">
                  {new Intl.NumberFormat("es-ES", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(row.amount || 0)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatPaidAt(raw) {
  if (!raw) return "-";
  const normalized = String(raw).includes("T")
    ? String(raw)
    : String(raw).replace(" ", "T") + "Z";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(raw);
  return new Intl.DateTimeFormat("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
