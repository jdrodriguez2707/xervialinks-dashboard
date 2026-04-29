import { useMemo, useState } from "react";
import { BarChart3, Globe } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState("stats");
  const [selectedRange, setSelectedRange] = useState("today");

  if (error) {
    return <p className="status-msg error">Error al cargar los ingresos.</p>;
  }

  const { properties = [] } = dashboard ?? {};
  const domains = properties.filter((p) => p.type === "domain");
  const hasDomains = domains.length > 0;
  const tabs = useMemo(
    () => [
      { id: "stats", label: "Estadísticas", icon: BarChart3 },
      { id: "domains", label: "Subdominios", icon: Globe },
    ],
    []
  );

  return (
    <div className="worker-dashboard">
      <nav className="worker-nav" aria-label="Secciones del panel">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`worker-nav-btn ${isActive ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

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
      ) : activeTab === "stats" ? (
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

          <section className="adsense-section">
              <select
                className="form-select metric-range-select"
                value={selectedRange}
                onChange={(e) => setSelectedRange(e.target.value)}
              >
                {PERIODS.map((period) => (
                  <option key={period} value={period}>
                    {PERIOD_LABELS[period]}
                  </option>
                ))}
              </select>
            <div className="metric-header-row">
              <h2 className="section-title">eCPM promedio</h2>
            </div>
            {loading ? (
              <div className="adsense-cards adsense-cards--single">
                <div className="adsense-card adsense-card--skeleton" />
              </div>
            ) : (
              <div className="adsense-cards adsense-cards--single">
                <div className="adsense-card card--ecpm">
                  <span className="adsense-label">{PERIOD_LABELS[selectedRange]}</span>
                  <span className="adsense-value">
                    {fmtEcpm(dashboard?.[selectedRange]?.ecpm)}
                  </span>
                </div>
              </div>
            )}
          </section>

          <section className="adsense-section">
            <div className="metric-header-row">
              <h2 className="section-title">Impresiones</h2>
            </div>
            {loading ? (
              <div className="adsense-cards adsense-cards--single">
                <div className="adsense-card adsense-card--skeleton" />
              </div>
            ) : (
              <div className="adsense-cards adsense-cards--single">
                <div className="adsense-card card--impressions">
                  <span className="adsense-label">{PERIOD_LABELS[selectedRange]}</span>
                  <span className="adsense-value">
                    {fmtImpressions(dashboard?.[selectedRange]?.impressions)}
                  </span>
                </div>
              </div>
            )}
          </section>
        </>
      ) : null}

      {activeTab === "domains" && (
        <section className="adsense-section">
          <h2 className="section-title">Subdominios asignados</h2>

          {!loading && domains.length === 0 ? (
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
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
