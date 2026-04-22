/**
 * @param {{ reports: Array<{ date: string, domain: string, impressions: number, revenue: number, ecpm: number }> }} props
 */
export default function ReportsTable({ reports }) {
  if (reports.length === 0) {
    return <p className="empty-state">No reports found for the selected filters.</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="reports-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Domain</th>
            <th>Impressions</th>
            <th>Revenue</th>
            <th>eCPM</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report, index) => (
            <tr key={`${report.date}-${report.domain}-${index}`}>
              <td>{report.date}</td>
              <td>{report.domain}</td>
              <td>{report.impressions.toLocaleString()}</td>
              <td>${report.revenue.toFixed(2)}</td>
              <td>${report.ecpm.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
