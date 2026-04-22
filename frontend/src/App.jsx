import { useEffect, useState } from "react";
import { fetchReports } from "./api/reports";
import SummaryCards from "./components/SummaryCards";
import ReportsTable from "./components/ReportsTable";

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReports()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Ad Manager Dashboard</h1>
      </header>

      <main className="app-main">
        {loading && <p className="status-msg">Loading reports...</p>}

        {error && <p className="status-msg error">Error: {error}</p>}

        {data && (
          <>
            <section>
              <h2>Summary</h2>
              <SummaryCards summary={data.summary} />
            </section>

            <section>
              <h2>Reports</h2>
              <ReportsTable reports={data.reports} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
