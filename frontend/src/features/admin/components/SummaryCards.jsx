import { DollarSign, Eye, Percent } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";

/**
 * @param {{ summary: { totalRevenue: number, totalImpressions: number, ecpm: number } }} props
 */
export default function SummaryCards({ summary }) {
  const cards = [
    {
      label: "Ingresos",
      value: `$${summary.totalRevenue.toFixed(2)}`,
      icon: DollarSign,
    },
    {
      label: "Impresiones",
      value: summary.totalImpressions.toLocaleString(),
      icon: Eye,
    },
    {
      label: "eCPM",
      value: `$${summary.ecpm.toFixed(4)}`,
      icon: Percent,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <MetricCard key={card.label} title={card.label} value={card.value} icon={card.icon} />
      ))}
    </div>
  );
}
