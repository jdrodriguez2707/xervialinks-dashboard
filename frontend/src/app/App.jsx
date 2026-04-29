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

export default function App() {
  const [user, setUser] = useState(() => getStoredUser());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshingAdmin, setRefreshingAdmin] = useState(false);
  const [error, setError] = useState(null);

  const loadInitial = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      if (user.role === "admin") {
        const [summary, workers, payouts, sites] = await Promise.all([
          fetchSummary(),
          fetchWorkers(),
          fetchPayouts(),
          fetchSites(),
        ]);
        setData({ summary, workers, payouts, sites });
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

  const refreshAdminWorkersAndPayouts = useCallback(async () => {
    if (!user || user.role !== "admin") return;
    setRefreshingAdmin(true);
    setError(null);
    try {
      const [workers, payouts] = await Promise.all([fetchWorkers(), fetchPayouts()]);
      setData((prev) => ({ ...prev, workers, payouts }));
    } catch (err) {
      if (err.message === "401") handleLogout();
      else setError(err.message);
    } finally {
      setRefreshingAdmin(false);
    }
  }, [user]);

  function handleLogin(loggedUser) {
    setUser(loggedUser);
  }

  function handleLogout() {
    logout();
    setUser(null);
    setData(null);
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
              <AdminDashboard data={data} onWorkersUpdate={refreshAdminWorkersAndPayouts} />
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

function AdminDashboard({ data, onWorkersUpdate }) {
  const { summary, workers, payouts, sites } = data;
  return (
    <>
      <section>
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
