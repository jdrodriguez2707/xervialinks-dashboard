/**
 * Vista personal del trabajador con las tres secciones definidas en el proyecto:
 *  1. Ingresos personales   — revenue generado por sus propiedades
 *  2. Monto a recibir       — su ganancia después de aplicar el porcentaje
 *  3. Propiedades asignadas — dominios y ad units que le fueron asignados
 *
 * @param {{ myPayout: object|null }} props
 */
export default function WorkerDashboard({ myPayout }) {
  if (!myPayout) {
    return (
      <p className="empty-state">
        Aún no tienes propiedades asignadas. Contacta al administrador.
      </p>
    );
  }

  const { assignedRevenue, assignedImpressions, percentage, payout, assignedProperties } = myPayout;
  const domains = assignedProperties.filter((p) => p.type === "domain");
  const adUnits = assignedProperties.filter((p) => p.type === "ad_unit");
  const hasProperties = assignedProperties.length > 0;

  return (
    <div className="worker-dashboard">

      {/* 1. Ingresos personales */}
      <section>
        <h2>Ingresos personales</h2>
        <div className="worker-summary">
          <div className="card">
            <span className="card-label">Ingresos generados</span>
            <span className="card-value">${assignedRevenue.toFixed(2)}</span>
          </div>
          <div className="card">
            <span className="card-label">Impresiones</span>
            <span className="card-value">{assignedImpressions.toLocaleString()}</span>
          </div>
          <div className="card">
            <span className="card-label">Porcentaje asignado</span>
            <span className="card-value">{percentage}%</span>
          </div>
        </div>
      </section>

      {/* 2. Monto a recibir */}
      <section>
        <h2>Monto a recibir</h2>
        <div className="worker-summary">
          <div className="card card-highlight">
            <span className="card-label">Tu ganancia</span>
            <span className="card-value payout-amount">${payout.toFixed(2)}</span>
          </div>
          <div className="card">
            <span className="card-label">Cálculo</span>
            <span className="card-value card-formula">
              ${assignedRevenue.toFixed(2)} × {percentage}%
            </span>
          </div>
        </div>
      </section>

      {/* 3. Propiedades asignadas */}
      <section>
        <h2>Propiedades asignadas</h2>
        {!hasProperties ? (
          <p className="empty-state">Sin propiedades asignadas. Contacta al administrador.</p>
        ) : (
          <div className="table-wrapper">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((p) => (
                  <tr key={p.id}>
                    <td><span className="tag">Dominio</span></td>
                    <td>{p.value}</td>
                  </tr>
                ))}
                {adUnits.map((p) => (
                  <tr key={p.id}>
                    <td><span className="tag tag-adunit">Ad Unit</span></td>
                    <td>{p.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  );
}
