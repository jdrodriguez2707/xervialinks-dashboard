import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import DataTable from "@/components/DataTable";

const ADMIN_TABLE_DENSITY_CLASS =
  "text-xs sm:text-sm [&_th]:px-2.5 [&_td]:px-2.5 [&_th]:py-2 [&_td]:py-2.5 sm:[&_th]:px-4 sm:[&_td]:p-4";

/**
 * @param {{
 *   payouts: Array<{
 *     workerId: number, name: string, email?: string, percentage: number,
 *     assignedDomains: string[], assignedRevenue: number,
 *     assignedImpressions: number, payout: number, deletedAt?: string | null
 *   }>,
 *   totalPayout: number,
 *   highlightedWorkerId?: number | null,
 * }} props
 */
export default function PayoutsTable({
  payouts,
  totalPayout,
  highlightedWorkerId = null,
  isLoading = false,
}) {
  const payoutsOrdered = useMemo(() => {
    return [...payouts].sort((a, b) => {
      const aInactive = !!a.deletedAt;
      const bInactive = !!b.deletedAt;
      if (aInactive !== bInactive) return aInactive ? 1 : -1;
      return String(a.name || "").localeCompare(String(b.name || ""), "es");
    });
  }, [payouts]);

  if (isLoading) {
    return (
      <div className="admin-table-shell">
        <DataTable
          className={ADMIN_TABLE_DENSITY_CLASS}
          columns={[
            "Trabajador",
            "Subdominios asignados",
            "Impresiones",
            "Ingresos asignados",
            "%",
            "Ganancia",
          ]}
          rows={Array.from({ length: 4 })}
          renderRow={(_, idx) => (
            <TableRow key={`payout-skeleton-${idx}`}>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-44" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-8" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
            </TableRow>
          )}
        />
      </div>
    );
  }

  if (payouts.length === 0) {
    return (
      <EmptyState
        title="Sin ganancias registradas"
        description="Aún no hay trabajadores configurados. Agrega uno y asígnale subdominios para ver sus ganancias."
      />
    );
  }

  return (
    <div className="admin-table-shell">
      <DataTable
        className={ADMIN_TABLE_DENSITY_CLASS}
        columns={[
          "Trabajador",
          "Subdominios asignados",
          "Impresiones",
          "Ingresos asignados",
          "%",
          "Ganancia",
        ]}
        rows={payoutsOrdered}
        renderRow={(w) => (
          <TableRow
            key={w.workerId}
            className={`transition-colors hover:bg-muted/20 ${
              w.workerId === highlightedWorkerId
                ? "bg-primary/20 ring-1 ring-inset ring-primary/40"
                : ""
            }`}
          >
            <TableCell>
              <div className="space-y-1">
                <p className="text-sm font-semibold">{w.name}</p>
                <p className="text-xs text-muted-foreground">{w.email}</p>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    w.deletedAt
                      ? "border-border text-muted-foreground bg-background"
                      : "border-emerald-500/40 text-emerald-700 bg-emerald-50"
                  }`}
                >
                  {w.deletedAt ? "Inactivo" : "Activo"}
                </Badge>
              </div>
            </TableCell>
            <TableCell>
              {w.assignedDomains.length === 0 ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {w.assignedDomains.map((d) => (
                    <Badge key={d} variant="outline">
                      {d}
                    </Badge>
                  ))}
                </div>
              )}
            </TableCell>
            <TableCell className="tabular-nums">{w.assignedImpressions.toLocaleString()}</TableCell>
            <TableCell className="tabular-nums">${w.assignedRevenue.toFixed(2)}</TableCell>
            <TableCell className="tabular-nums">{w.percentage}%</TableCell>
            <TableCell className="tabular-nums font-semibold">${w.payout.toFixed(2)}</TableCell>
          </TableRow>
        )}
        footer={() => (
          <TableRow>
            <TableCell colSpan={5} className="text-sm font-semibold text-muted-foreground">
              Ganancia total
            </TableCell>
            <TableCell className="tabular-nums font-semibold">${totalPayout.toFixed(2)}</TableCell>
          </TableRow>
        )}
      />
    </div>
  );
}
