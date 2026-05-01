import { useEffect, useState, useCallback, useRef } from "react";
import { getStoredUser, logout } from "../shared/api/auth";
import { getAdminDateRange } from "../shared/lib/reportCalendar";
import { fetchSummary } from "../shared/api/summary";
import { fetchWorkers } from "../shared/api/workers";
import { fetchPayouts } from "../shared/api/payouts";
import { fetchWorkerContext, fetchWorkerDashboard } from "../shared/api/worker";
import { fetchSites } from "../shared/api/sites";
import LoginForm from "../features/auth/components/LoginForm";
import SummaryCards from "../features/admin/components/SummaryCards";
import PayoutsTable from "../features/admin/components/PayoutsTable";
import WorkersList from "../features/admin/components/WorkersList";
import WorkerForm from "../features/admin/components/WorkerForm";
import WorkerDashboard from "../features/worker/components/WorkerDashboard";

const ADMIN_RANGE_LABELS = {
  today: "Hoy",
  yesterday: "Ayer",
  last7Days: "Últimos 7 días",
  currentMonth: "Este mes",
};
const ADMIN_CACHE_TTL_MS = 60 * 1000;
const WORKER_DOMAIN_STORAGE_PREFIX = "workerDashboardSelectedDomain";

function getWorkerDomains(context) {
  return (context?.properties || [])
    .filter((p) => p.type === "domain")
    .map((p) => p.value);
}

function getWorkerDomainStorageKey(workerId) {
  return `${WORKER_DOMAIN_STORAGE_PREFIX}:${workerId || "unknown"}`;
}

export default function App() {
  const [user, setUser] = useState(() => getStoredUser());
  const [sessionNotice, setSessionNotice] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshingAdmin, setRefreshingAdmin] = useState(false);
  const [adminRange, setAdminRange] = useState("today");
  const [adminReady, setAdminReady] = useState(false);
  const [error, setError] = useState(null);
  const [workerMetricsLoading, setWorkerMetricsLoading] = useState(false);
  const [workerMetricsError, setWorkerMetricsError] = useState(null);
  const [workerSelectedDomain, setWorkerSelectedDomain] = useState(null);
  const adminMetricsCacheRef = useRef(new Map());

  function getCachedAdminMetrics(rangeKey) {
    const entry = adminMetricsCacheRef.current.get(rangeKey);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > ADMIN_CACHE_TTL_MS) {
      adminMetricsCacheRef.current.delete(rangeKey);
      return null;
    }
    return entry;
  }

  function setCachedAdminMetrics(rangeKey, summary, payouts) {
    adminMetricsCacheRef.current.set(rangeKey, {
      summary,
      payouts,
      cachedAt: Date.now(),
    });
  }

  const loadWorkerMetrics = useCallback(
    async (domain) => {
      if (!user || user.role !== "worker") return;
      setWorkerMetricsError(null);
      setWorkerMetricsLoading(true);
      try {
        const metrics = await fetchWorkerDashboard({ domain });
        setData((prev) => ({ ...prev, workerMetrics: metrics }));
      } catch (err) {
        if (err.message === "401") handleLogout();
        else if (err.message.includes("cuenta de trabajador fue eliminada")) {
          handleLogout(err.message);
        }
        else setWorkerMetricsError(err.message || "Error al cargar métricas");
      } finally {
        setWorkerMetricsLoading(false);
      }
    },
    [user]
  );

  const loadInitial = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      if (user.role === "admin") {
        const range = getAdminDateRange("today");
        const [summary, workers, payouts, sites] = await Promise.all([
          fetchSummary(range),
          fetchWorkers(),
          fetchPayouts(range),
          fetchSites(),
        ]);
        setCachedAdminMetrics("today", summary, payouts);
        setData({ summary, workers, payouts, sites });
        setAdminReady(true);

        // Warm up all remaining ranges in background so any selector switch is instant.
        const remainingRanges = ["yesterday", "last7Days", "currentMonth"];
        remainingRanges.forEach((rangeKey) => {
          if (getCachedAdminMetrics(rangeKey)) return;
          const r = getAdminDateRange(rangeKey);
          Promise.all([fetchSummary(r), fetchPayouts(r)])
            .then(([s, p]) => setCachedAdminMetrics(rangeKey, s, p))
            .catch(() => {});
        });
      } else {
        const context = await fetchWorkerContext();
        const domains = getWorkerDomains(context);
        let initialDomain = domains[0] || null;
        if (typeof window !== "undefined") {
          const savedDomain = window.localStorage.getItem(
            getWorkerDomainStorageKey(context?.workerId)
          );
          if (savedDomain && domains.includes(savedDomain)) {
            initialDomain = savedDomain;
          }
        }
        setData({ workerContext: context, workerMetrics: null });
        setWorkerSelectedDomain(initialDomain);
        setWorkerMetricsError(null);
        if (initialDomain) {
          await loadWorkerMetrics(initialDomain);
        }
      }
    } catch (err) {
      if (err.message === "401") handleLogout();
      else if (err.message.includes("cuenta de trabajador fue eliminada")) {
        handleLogout(err.message);
      }
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, loadWorkerMetrics]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    async function refreshAdminByRange() {
      if (!user || user.role !== "admin" || !adminReady) return;
      const cached = getCachedAdminMetrics(adminRange);
      if (cached) {
        setData((prev) => ({
          ...prev,
          summary: cached.summary,
          payouts: cached.payouts,
        }));
        return;
      }
      setRefreshingAdmin(true);
      setError(null);
      try {
        const range = getAdminDateRange(adminRange);
        const [summary, payouts] = await Promise.all([
          fetchSummary(range),
          fetchPayouts(range),
        ]);
        setCachedAdminMetrics(adminRange, summary, payouts);
        setData((prev) => ({ ...prev, summary, payouts }));
      } catch (err) {
        if (err.message === "401") handleLogout();
        else setError(err.message);
      } finally {
        setRefreshingAdmin(false);
      }
    }
    refreshAdminByRange();
  }, [adminRange, user, adminReady]);

  useEffect(() => {
    if (!user || user.role !== "worker" || typeof window === "undefined") return;
    const workerId = data?.workerContext?.workerId;
    if (!workerId) return;
    const storageKey = getWorkerDomainStorageKey(workerId);
    if (workerSelectedDomain) {
      window.localStorage.setItem(storageKey, workerSelectedDomain);
    } else {
      window.localStorage.removeItem(storageKey);
    }
  }, [user, workerSelectedDomain, data?.workerContext?.workerId]);

  const refreshAdminWorkersAndPayouts = useCallback(async () => {
    if (!user || user.role !== "admin") return;
    setRefreshingAdmin(true);
    setError(null);
    try {
      const range = getAdminDateRange(adminRange);
      const [workers, payouts, summary] = await Promise.all([
        fetchWorkers(),
        fetchPayouts(range),
        fetchSummary(range),
      ]);
      setCachedAdminMetrics(adminRange, summary, payouts);
      setData((prev) => ({ ...prev, workers, payouts, summary }));
    } catch (err) {
      if (err.message === "401") handleLogout();
      else setError(err.message);
    } finally {
      setRefreshingAdmin(false);
    }
  }, [user, adminRange]);

  function handleLogin(loggedUser) {
    setSessionNotice(null);
    setUser(loggedUser);
  }

  function handleLogout(noticeMessage = null) {
    logout();
    if (noticeMessage) setSessionNotice(noticeMessage);
    setUser(null);
    setData(null);
    setAdminReady(false);
    setWorkerMetricsLoading(false);
    setWorkerMetricsError(null);
    setWorkerSelectedDomain(null);
    adminMetricsCacheRef.current.clear();
  }

  if (!user) return <LoginForm onLogin={handleLogin} notice={sessionNotice} />;

  return (
    <div className="app">
      <header className="app-header">
        <h1>XerviaLinks Metrics</h1>
        <div className="header-user">
          <div className="header-user-info">
            <span className="header-user-name">{user.name}</span>
            <span className="role-badge">
              {user.role === "admin" ? "Administrador" : "Trabajador"}
            </span>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
        {user.role === "admin" && (loading || refreshingAdmin) && (
          <div className="header-progress" aria-hidden="true" />
        )}
      </header>

      <main className="app-main">
        {user.role === "admin" && (
          <>
            {loading && <p className="status-msg">Cargando dashboard…</p>}
            {error && <p className="status-msg error">Error: {error}</p>}
            {!loading && data && (
              <AdminDashboard
                data={data}
                onWorkersUpdate={refreshAdminWorkersAndPayouts}
                adminRange={adminRange}
                onChangeAdminRange={setAdminRange}
              />
            )}
          </>
        )}

        {user.role === "worker" && (
          <WorkerDashboard
            workerContext={data?.workerContext ?? null}
            workerMetrics={data?.workerMetrics ?? null}
            selectedDomain={workerSelectedDomain}
            onDomainChange={async (nextDomain) => {
              setWorkerSelectedDomain(nextDomain);
              await loadWorkerMetrics(nextDomain);
            }}
            contextLoading={loading}
            metricsLoading={workerMetricsLoading}
            metricsError={workerMetricsError}
            error={error}
            onContextRefresh={async () => {
              try {
                const ctx = await fetchWorkerContext();
                const domains = getWorkerDomains(ctx);
                const stillValid = workerSelectedDomain && domains.includes(workerSelectedDomain);
                const nextDomain = stillValid ? workerSelectedDomain : domains[0] || null;
                setWorkerSelectedDomain(nextDomain);
                setData((prev) => ({ ...prev, workerContext: ctx }));
                if (nextDomain) {
                  await loadWorkerMetrics(nextDomain);
                }
              } catch {
                /* ignore refresh errors */
              }
            }}
          />
        )}
      </main>
    </div>
  );
}

function AdminDashboard({ data, onWorkersUpdate, adminRange, onChangeAdminRange }) {
  const { summary, workers, payouts, sites } = data;
  return (
    <>
      <section>
        <div className="admin-range-row">
          <select
            className="form-select admin-range-select"
            value={adminRange}
            onChange={(e) => onChangeAdminRange(e.target.value)}
          >
            {Object.entries(ADMIN_RANGE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <h2>Resumen</h2>
        <SummaryCards summary={summary} />
      </section>

      <section>
        <h2>Ganancias por trabajador</h2>
        <PayoutsTable payouts={payouts.payouts} totalPayout={payouts.totalPayout} />
      </section>

      <section>
        <h2>Trabajadores</h2>
        <WorkerForm onCreated={onWorkersUpdate} />
        <WorkersList workers={workers} sites={sites} onUpdate={onWorkersUpdate} />
      </section>
    </>
  );
}
