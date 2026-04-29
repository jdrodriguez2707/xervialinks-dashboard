import { useEffect, useState, useCallback } from "react";
import { getStoredUser, logout } from "../shared/api/auth";
import { fetchSummary } from "../shared/api/summary";
import { fetchWorkers } from "../shared/api/workers";
import { fetchPayouts } from "../shared/api/payouts";
import { fetchWorkerDashboard } from "../shared/api/worker";
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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function currentMonthStartISO() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function getAdminDateRange(rangeKey) {
  switch (rangeKey) {
    case "today":
      return { startDate: todayISO(), endDate: todayISO() };
    case "yesterday":
      return { startDate: daysAgoISO(1), endDate: daysAgoISO(1) };
    case "last7Days":
      return { startDate: daysAgoISO(7), endDate: daysAgoISO(1) };
    case "currentMonth":
    default:
      return { startDate: currentMonthStartISO(), endDate: todayISO() };
  }
}

export default function App() {
  const [user, setUser] = useState(() => getStoredUser());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshingAdmin, setRefreshingAdmin] = useState(false);
  const [adminRange, setAdminRange] = useState("today");
  const [adminReady, setAdminReady] = useState(false);
  const [error, setError] = useState(null);

  const loadInitial = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      if (user.role === "admin") {
        const range = getAdminDateRange("currentMonth");
        const [summary, workers, payouts, sites] = await Promise.all([
          fetchSummary(range),
          fetchWorkers(),
          fetchPayouts(range),
          fetchSites(),
        ]);
        setData({ summary, workers, payouts, sites });
        setAdminReady(true);
      } else {
        const dashboard = await fetchWorkerDashboard();
        setData({ dashboard });
      }
    } catch (err) {
      if (err.message === "401") handleLogout();
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    async function refreshAdminByRange() {
      if (!user || user.role !== "admin" || !adminReady) return;
      setRefreshingAdmin(true);
      setError(null);
      try {
        const range = getAdminDateRange(adminRange);
        const [summary, payouts] = await Promise.all([
          fetchSummary(range),
          fetchPayouts(range),
        ]);
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
      setData((prev) => ({ ...prev, workers, payouts, summary }));
    } catch (err) {
      if (err.message === "401") handleLogout();
      else setError(err.message);
    } finally {
      setRefreshingAdmin(false);
    }
  }, [user, adminRange]);

  function handleLogin(loggedUser) {
    setUser(loggedUser);
  }

  function handleLogout() {
    logout();
    setUser(null);
    setData(null);
    setAdminReady(false);
  }

  if (!user) return <LoginForm onLogin={handleLogin} />;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Dashboard de Ad Manager</h1>
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
      </header>

      <main className="app-main">
        {user.role === "admin" && (
          <>
            {loading && <p className="status-msg">Cargando dashboard…</p>}
            {refreshingAdmin && <p className="status-msg">Actualizando trabajadores…</p>}
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
            dashboard={data?.dashboard ?? null}
            loading={loading}
            error={error}
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
