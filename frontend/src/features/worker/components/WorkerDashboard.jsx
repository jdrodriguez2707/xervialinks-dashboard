const PERIODS = ["today", "yesterday", "last7Days", "currentMonth"];

const PERIOD_LABELS = {
  today:        "Hoy (estimado)",
  yesterday:    "Ayer",
  last7Days:    "Últimos 7 días",
  currentMonth: "Este mes",
};

const PROPERTY_LABELS = {
  domain:  "Subdominio",
  ad_unit: "Ad Unit",
};

const fmtCurrency = (n) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n ?? 0);

const fmtEcpm = (n) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n ?? 0);

const fmtImpressions = (n) =>
  new Intl.NumberFormat("es-MX").format(n ?? 0);

function SkeletonCards() {
  return (
    <div className="adsense-cards">
      {PERIODS.map((p) => (
        <div key={p} className="adsense-card adsense-card--skeleton" />
      ))}
    </div>
  );
}

function MetricSection({ title, colorClass, loading, data, getValue, format, highlight }) {
  return (
    <section className="adsense-section">
      <h2 className="section-title">{title}</h2>
      {loading ? (
        <SkeletonCards />
      ) : (
        <div className="adsense-cards">
          {PERIODS.map((period) => (
            <div
              key={period}
              className={`adsense-card ${colorClass} ${period === "currentMonth" && highlight ? "highlight" : ""}`}
            >
              <span className="adsense-label">{PERIOD_LABELS[period]}</span>
              <span className="adsense-value">
                {format(getValue(data, period))}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function WorkerDashboard({ dashboard, loading, error }) {
  if (error) {
    return <p className="status-msg error">Error al cargar los ingresos.</p>;
  }

  const { properties = [] } = dashboard ?? {};
  const domains = properties.filter((p) => p.type === "domain");
  const adUnits = properties.filter((p) => p.type === "ad_unit");

  const hasDomains = domains.length > 0;

  return (
    <div className="worker-dashboard">
      {!loading && !hasDomains ? (
        <div className="no-domains-notice">
          <span className="no-domains-icon">📊</span>
          <h2 className="no-domains-title">Panel no disponible aún</h2>
          <p className="no-domains-text">
            Tu cuenta no tiene subdominios asignados. Una vez que el administrador
            configure tu acceso, aquí verás tus ingresos, eCPM e impresiones
            en tiempo real.
          </p>
          <p className="no-domains-hint">
            Si crees que esto es un error, comunícate con el administrador.
          </p>
        </div>
      ) : (
        <>
          <MetricSection
            title="Ingresos estimados"
            colorClass="card--revenue"
            loading={loading}
            data={dashboard}
            getValue={(d, period) => d?.[period]?.revenue}
            format={fmtCurrency}
            highlight
          />

          <MetricSection
            title="eCPM promedio"
            colorClass="card--ecpm"
            loading={loading}
            data={dashboard}
            getValue={(d, period) => d?.[period]?.ecpm}
            format={fmtEcpm}
          />

          <MetricSection
            title="Impresiones"
            colorClass="card--impressions"
            loading={loading}
            data={dashboard}
            getValue={(d, period) => d?.[period]?.impressions}
            format={fmtImpressions}
          />
        </>
      )}

      <section className="adsense-section">
        <h2 className="section-title">Subdominios asignados</h2>

        {!loading && properties.length === 0 ? (
          <p className="empty-state">
            Sin subdominios asignados. Contacta al administrador.
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
