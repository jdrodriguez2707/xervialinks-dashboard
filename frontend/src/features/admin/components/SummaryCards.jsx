/**
 * @param {{ summary: { totalRevenue: number, totalImpressions: number, ecpm: number } }} props
 */
export default function SummaryCards({ summary }) {
  const cards = [
    {
      label: "Ingresos",
      value: `$${summary.totalRevenue.toFixed(2)}`,
    },
    {
      label: "Impresiones",
      value: summary.totalImpressions.toLocaleString(),
    },
    {
      label: "eCPM",
      value: `$${summary.ecpm.toFixed(4)}`,
    },
  ];

  return (
    <div className="summary-cards">
      {cards.map((card) => (
        <div key={card.label} className="card">
          <span className="card-label">{card.label}</span>
          <span className="card-value">{card.value}</span>
        </div>
      ))}
    </div>
  );
}
