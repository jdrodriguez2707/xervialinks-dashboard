const fmt = (n) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n ?? 0);

const fmtImpressions = (n) =>
  new Intl.NumberFormat("es-MX").format(n ?? 0);

const PROPERTY_LABELS = {
  domain: "Dominio",
  ad_unit: "Ad Unit",
};

export default function WorkerDashboard({ dashboard, loading, error }) {
  if (loading) {
    return <p className="status-msg">Cargando ingresos…</p>;
  }

  if (error) {
    return <p className="status-msg error">Error al cargar los ingresos.</p>;
  }

  if (!dashboard) {
    return <p className="status-msg">Sin datos disponibles.</p>;
  }

  const { today, yesterday, last7Days, currentMonth, impressions, properties = [] } = dashboard;

  const domains = properties.filter((p) => p.type === "domain");
  const adUnits = properties.filter((p) => p.type === "ad_unit");

  return (
    <div className="worker-dashboard">
      <section className="adsense-section">
        <h2 className="section-title">Tus ingresos estimados</h2>

        <div className="adsense-cards">
          <div className="adsense-card">
            <span className="adsense-label">Hoy (estimado)</span>
            <span className="adsense-value">{fmt(today)}</span>
          </div>

          <div className="adsense-card">
            <span className="adsense-label">Ayer</span>
            <span className="adsense-value">{fmt(yesterday)}</span>
          </div>

          <div className="adsense-card">
            <span className="adsense-label">Últimos 7 días</span>
            <span className="adsense-value">{fmt(last7Days)}</span>
          </div>

          <div className="adsense-card highlight">
            <span className="adsense-label">Tu ganancia (este mes)</span>
            <span className="adsense-value gain">{fmt(currentMonth)}</span>
          </div>
        </div>

        <p className="adsense-note">
          * Los ingresos de hoy son estimados y pueden variar.
          Los datos de Ad Manager no son en tiempo real.
        </p>
      </section>

      <section className="adsense-section">
        <h2 className="section-title">Impresiones este mes</h2>
        <div className="adsense-cards">
          <div className="adsense-card">
            <span className="adsense-label">Total de impresiones</span>
            <span className="adsense-value">{fmtImpressions(impressions)}</span>
          </div>
        </div>
      </section>

      <section className="adsense-section">
        <h2 className="section-title">Propiedades asignadas</h2>

        {properties.length === 0 ? (
          <p className="empty-state">
            Sin propiedades asignadas. Contacta al administrador.
          </p>
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
                    <td>
                      <span className="prop-badge prop-domain">
                        {PROPERTY_LABELS[p.type]}
                      </span>
                    </td>
                    <td className="prop-value">{p.value}</td>
                  </tr>
                ))}
                {adUnits.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="prop-badge prop-adunit">
                        {PROPERTY_LABELS[p.type]}
                      </span>
                    </td>
                    <td className="prop-value">{p.value}</td>
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
