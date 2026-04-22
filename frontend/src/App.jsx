import { useEffect, useState, useCallback } from "react";
import { fetchReports } from "./api/reports";
import { fetchWorkers } from "./api/workers";
import { fetchPayouts } from "./api/payouts";
import SummaryCards from "./components/SummaryCards";
import ReportsTable from "./components/ReportsTable";
import PayoutsTable from "./components/PayoutsTable";
import WorkersList from "./components/WorkersList";
import WorkerForm from "./components/WorkerForm";

export default function App() {
  const [reports, setReports] = useState(null);
  const [workers, setWorkers] = useState(null);
  const [payouts, setPayouts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [reportsData, workersData, payoutsData] = await Promise.all([
        fetchReports(),
        fetchWorkers(),
        fetchPayouts(),
      ]);
      setReports(reportsData);
      setWorkers(workersData);
      setPayouts(payoutsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (loading) {
    return (
      <div className="app">
        <AppHeader />
        <main className="app-main">
          <p className="status-msg">Cargando dashboard…</p>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <AppHeader />
        <main className="app-main">
          <p className="status-msg error">Error al cargar el dashboard: {error}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <AppHeader />
      <main className="app-main">
        <section>
          <h2>Resumen</h2>
          <SummaryCards summary={reports.summary} />
        </section>

        <section>
          <h2>Ganancias por trabajador</h2>
          <PayoutsTable
            payouts={payouts.payouts}
            totalPayout={payouts.totalPayout}
          />
        </section>

        <section>
          <h2>Trabajadores</h2>
          <WorkerForm onCreated={loadAll} />
          <WorkersList workers={workers} onUpdate={loadAll} />
        </section>

        <section>
          <h2>Reportes</h2>
          <ReportsTable reports={reports.reports} />
        </section>
      </main>
    </div>
  );
}

function AppHeader() {
  return (
    <header className="app-header">
      <h1>Dashboard de Ad Manager</h1>
    </header>
  );
}
