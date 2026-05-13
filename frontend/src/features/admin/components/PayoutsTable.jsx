import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import DataTable from "@/components/DataTable";
import { upsertWorkerNetRevenueOverride } from "../../../shared/api/payouts";
import { toUserErrorMessage } from "../../../shared/lib/uiError";

const ADMIN_TABLE_DENSITY_CLASS =
  "text-xs sm:text-sm [&_th]:px-2.5 [&_td]:px-2.5 [&_th]:py-2 [&_td]:py-2.5 sm:[&_th]:px-4 sm:[&_td]:p-4";

/**
 * @param {{
 *   payouts: Array<{
 *     workerId: number, name: string, email?: string, percentage: number,
 *     assignedDomains: string[], assignedRevenue: number,
 *     assignedRevenueGam?: number,
 *     hasRevenueOverride?: boolean,
 *     assignedImpressions: number, payout: number, deletedAt?: string | null
 *   }>,
 *   totalPayout: number,
 *   highlightedWorkerId?: number | null,
 *   earningsDateRange: { startDate: string, endDate: string },
 *   networkCode: string | null | undefined,
 *   onNetOverrideSaved?: () => void | Promise<void>,
 * }} props
 */
export default function PayoutsTable({
  payouts,
  totalPayout,
  highlightedWorkerId = null,
  isLoading = false,
  earningsDateRange = { startDate: "", endDate: "" },
  networkCode = null,
  onNetOverrideSaved,
}) {
  const [draftNetByWorker, setDraftNetByWorker] = useState({});
  const [savingWorkerId, setSavingWorkerId] = useState(null);
  const [rowError, setRowError] = useState(null);

  const payoutsOrdered = useMemo(() => {
    return [...payouts].sort((a, b) => {
      const aInactive = !!a.deletedAt;
      const bInactive = !!b.deletedAt;
      if (aInactive !== bInactive) return aInactive ? 1 : -1;
      return String(a.name || "").localeCompare(String(b.name || ""), "es");
    });
  }, [payouts]);

  const payoutSignature = useMemo(
    () =>
      payouts
        .map(
          (p) =>
            `${p.workerId}:${p.assignedRevenue}:${p.payout}:${p.hasRevenueOverride ? 1 : 0}`,
        )
        .join("|"),
    [payouts],
  );

  useEffect(() => {
    setDraftNetByWorker({});
    setRowError(null);
  }, [payoutSignature, earningsDateRange.startDate, earningsDateRange.endDate, networkCode]);

  function netInputValue(w) {
    const d = draftNetByWorker[w.workerId];
    if (d !== undefined && d !== "") return d;
    return String(Number(w.assignedRevenue ?? 0).toFixed(2));
  }

  async function handleRecalculate(w) {
    setRowError(null);
    const raw = netInputValue(w);
    const net = parseFloat(String(raw).replace(",", "."));
    if (!Number.isFinite(net) || net < 0) {
      setRowError("Introduce un ingreso neto válido (número ≥ 0).");
      return;
    }
    if (!networkCode || !earningsDateRange.startDate || !earningsDateRange.endDate) {
      setRowError("Falta contexto de red o fechas.");
      return;
    }
    setSavingWorkerId(w.workerId);
    try {
      await upsertWorkerNetRevenueOverride({
        workerId: w.workerId,
        gamNetworkCode: networkCode,
        periodStart: earningsDateRange.startDate,
        periodEnd: earningsDateRange.endDate,
        netRevenue: net,
      });
      setDraftNetByWorker((prev) => {
        const next = { ...prev };
        delete next[w.workerId];
        return next;
      });
      await onNetOverrideSaved?.();
    } catch (err) {
      setRowError(toUserErrorMessage(err, "No se pudo guardar el ajuste."));
    } finally {
      setSavingWorkerId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="admin-table-shell">
        <DataTable
          className={ADMIN_TABLE_DENSITY_CLASS}
          columns={[
            "Trabajador",
            "Subdominios asignados",
            "Impresiones",
            "Ingresos netos",
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
                <Skeleton className="h-8 w-24" />
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
    <div className="admin-table-shell space-y-2">
      <p className="text-xs text-muted-foreground max-w-3xl">
        Los ingresos netos provienen de Ad Manager salvo que los ajustes aquí. Pulsa{" "}
        <strong>Recalcular ganancia</strong> para aplicar el porcentaje del trabajador sobre el neto
        indicado. Para que el cambio coincida con el <strong>Historial de pagos</strong> del
        trabajador (mismo mes calendario), elige el <strong>mes completo</strong> en el selector de
        periodo de arriba.
      </p>
      {rowError && <p className="text-sm font-medium text-destructive">{rowError}</p>}
      <DataTable
        className={ADMIN_TABLE_DENSITY_CLASS}
        columns={[
          "Trabajador",
          "Subdominios asignados",
          "Impresiones",
          "Ingresos netos",
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
            <TableCell className="align-top min-w-[9rem] max-w-[11rem]">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground text-xs shrink-0">$</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    className="h-8 text-xs tabular-nums"
                    disabled={!!w.deletedAt || w.assignedDomains.length === 0}
                    value={netInputValue(w)}
                    onChange={(e) =>
                      setDraftNetByWorker((prev) => ({
                        ...prev,
                        [w.workerId]: e.target.value,
                      }))
                    }
                    aria-label={`Ingresos netos ${w.name}`}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs w-full"
                  disabled={
                    !!w.deletedAt ||
                    w.assignedDomains.length === 0 ||
                    savingWorkerId === w.workerId
                  }
                  onClick={() => handleRecalculate(w)}
                >
                  {savingWorkerId === w.workerId ? "Guardando…" : "Recalcular ganancia"}
                </Button>
                {w.hasRevenueOverride ? (
                  <span className="text-[10px] text-muted-foreground">Ajustado manualmente</span>
                ) : null}
              </div>
            </TableCell>
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
