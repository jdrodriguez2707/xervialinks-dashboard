import { DollarSign, Eye, Percent } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * @param {{
 *   summary: { totalRevenue: number, totalImpressions: number, ecpm: number },
 *   isLoading?: boolean
 * }} props
 */
export default function SummaryCards({ summary, isLoading = false }) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={`summary-skeleton-${idx}`} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-36" />
              </div>
              <Skeleton className="h-9 w-9 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

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
