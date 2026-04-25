import { useEffect, useState, useCallback } from "react";
import { getStoredUser, logout } from "./api/auth";
import { fetchSummary } from "./api/summary";
import { fetchWorkers } from "./api/workers";
import { fetchPayouts } from "./api/payouts";
import { fetchWorkerDashboard } from "./api/worker";
import LoginForm from "./components/LoginForm";
import SummaryCards from "./components/SummaryCards";
import PayoutsTable from "./components/PayoutsTable";
import WorkersList from "./components/WorkersList";
import WorkerForm from "./components/WorkerForm";
import WorkerDashboard from "./components/WorkerDashboard";

export default function App() {
  const [user, setUser] = useState(() => getStoredUser());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      if (user.role === "admin") {
        const [summary, workers, payouts] = await Promise.all([
          fetchSummary(),
          fetchWorkers(),
          fetchPayouts(),
        ]);
        setData({ summary, workers, payouts });
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
    loadAll();
  }, [loadAll]);

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
          <span>{user.name}</span>
          <span className="role-badge">
            {user.role === "admin" ? "Administrador" : "Trabajador"}
          </span>
          <button className="btn-logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="app-main">
        {user.role === "admin" && (
          <>
            {loading && <p className="status-msg">Cargando dashboard…</p>}
            {error && <p className="status-msg error">Error: {error}</p>}
            {!loading && !error && data && (
              <AdminDashboard data={data} onUpdate={loadAll} />
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

function AdminDashboard({ data, onUpdate }) {
  const { summary, workers, payouts } = data;
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
        <WorkerForm onCreated={onUpdate} />
        <WorkersList workers={workers} onUpdate={onUpdate} />
      </section>
    </>
  );
}
