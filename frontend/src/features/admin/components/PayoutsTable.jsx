import { useMemo, useState } from "react";
import { HandCoins } from "lucide-react";
import { updateWorkerPaymentStatus } from "../../../shared/api/workers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import DataTable from "@/components/DataTable";

/**
 * @param {{
 *   payouts: Array<{
 *     workerId: number, name: string, email?: string, percentage: number,
 *     assignedDomains: string[], assignedRevenue: number,
 *     assignedImpressions: number, payout: number, deletedAt?: string | null
 *   }>,
 *   totalPayout: number,
 *   workers?: Array<{
 *     id: number, paymentStatus?: string, paymentInfo?: { methodType: string, paymentDetails: string } | null
 *   }>,
 *   highlightedWorkerId?: number | null,
 *   onRefresh?: () => void,
 * }} props
 */
export default function PayoutsTable({
  payouts,
  totalPayout,
  workers = [],
  highlightedWorkerId = null,
  paymentMonth,
  onPaymentMonthChange,
  onRefresh,
  isLoading = false,
}) {
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [updatingPaymentStatus, setUpdatingPaymentStatus] = useState(false);

  const workersById = useMemo(
    () => new Map(workers.map((worker) => [worker.id, worker])),
    [workers]
  );

  const payoutsOrdered = useMemo(() => {
    return [...payouts].sort((a, b) => {
      const aInactive = !!a.deletedAt;
      const bInactive = !!b.deletedAt;
      if (aInactive !== bInactive) return aInactive ? 1 : -1;
      return String(a.name || "").localeCompare(String(b.name || ""), "es");
    });
  }, [payouts]);

  const paymentMonthOptions = useMemo(() => buildPaymentMonthOptions(), []);
  const paymentMonthLabel = formatPaymentMonthLabel(paymentMonth);
  const selectedWorkerCurrentStatus =
    selectedWorker && !selectedWorker.deletedAt
      ? workersById.get(selectedWorker.workerId)?.paymentStatus || "pending"
      : selectedWorker?.paymentStatus || "pending";

  async function handleTogglePaymentStatus() {
    if (!selectedWorker || selectedWorker.deletedAt) return;
    const currentStatus = selectedWorkerCurrentStatus;
    const nextStatus = currentStatus === "paid" ? "pending" : "paid";
    setUpdatingPaymentStatus(true);
    try {
      await updateWorkerPaymentStatus(selectedWorker.workerId, nextStatus, paymentMonth);
      setSelectedWorker(null);
      if (typeof onRefresh === "function") {
        await onRefresh();
      }
    } catch (err) {
      window.alert(err.message || "No se pudo actualizar el estado de pago");
    } finally {
      setUpdatingPaymentStatus(false);
    }
  }

  function openPaymentModal(payoutWorker) {
    const workerDetail = workersById.get(payoutWorker.workerId) || {};
    setSelectedWorker({
      ...payoutWorker,
      paymentStatus: workerDetail.paymentStatus || "pending",
      paymentInfo: workerDetail.paymentInfo || null,
    });
  }

  const isInactivePayoutRow = !!selectedWorker?.deletedAt;

  if (isLoading) {
    return (
      <DataTable
        columns={[
          "Trabajador",
          "Subdominios asignados",
          "Impresiones",
          "Ingresos asignados",
          "%",
          "Ganancia",
          "Estado de pago",
          "Pagos",
        ]}
        rows={Array.from({ length: 4 })}
        renderRow={(_, idx) => (
          <TableRow key={`payout-skeleton-${idx}`}>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="h-4 w-44" /></TableCell>
            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell><Skeleton className="h-4 w-8" /></TableCell>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
          </TableRow>
        )}
      />
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
    <>
      <DataTable
        columns={[
          "Trabajador",
          "Subdominios asignados",
          "Impresiones",
          "Ingresos asignados",
          "%",
          "Ganancia",
          "Estado de pago",
          "Pagos",
        ]}
        rows={payoutsOrdered}
        renderRow={(w) => {
          const status = workersById.get(w.workerId)?.paymentStatus || "pending";
          return (
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
              <TableCell>
                {w.deletedAt ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  <StatusBadge
                    status={status === "paid" ? "paid" : "pending"}
                    label={status === "paid" ? "Pagado" : "Pendiente"}
                  />
                )}
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title={
                    w.deletedAt
                      ? `Ver información de pago de ${w.name}`
                      : `Gestionar estado de pago de ${w.name} (${paymentMonth})`
                  }
                  aria-label={
                    w.deletedAt
                      ? `Ver información de pago de ${w.name}`
                      : `Gestionar estado de pago de ${w.name} (${paymentMonth})`
                  }
                  onClick={() => openPaymentModal(w)}
                >
                  <HandCoins className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          );
        }}
        footer={() => (
          <TableRow>
            <TableCell colSpan={7} className="text-sm font-semibold text-muted-foreground">
              Ganancia total
            </TableCell>
            <TableCell className="tabular-nums font-semibold">${totalPayout.toFixed(2)}</TableCell>
          </TableRow>
        )}
      />

      {selectedWorker && (
        <Dialog open={!!selectedWorker} onOpenChange={(value) => (!value ? setSelectedWorker(null) : null)}>
          <DialogContent className="sm:max-w-xl border-border/60">
            <DialogHeader>
              <DialogTitle>
                {isInactivePayoutRow
                  ? `Información de pago · ${selectedWorker.name}`
                  : `Estado de pago de ${selectedWorker.name}`}
              </DialogTitle>
              <DialogDescription>
                Gestiona el estado y revisa los datos de pago del trabajador.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-medium">Pagando periodo: {paymentMonthLabel}</span>
                <Select value={paymentMonth} onValueChange={(value) => onPaymentMonthChange?.(value)}>
                  <SelectTrigger className="sm:w-56">
                    <SelectValue placeholder="Seleccionar mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMonthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isInactivePayoutRow && (
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                  Perfil <strong>Inactivo</strong>: puedes revisar método y datos de pago registrados.
                  El <strong>estado de pago</strong> (pagado/pendiente) no aplica ni se muestra.
                </div>
              )}

              {!isInactivePayoutRow && (
                <StatusBadge
                  status={selectedWorkerCurrentStatus === "paid" ? "paid" : "pending"}
                  label={selectedWorkerCurrentStatus === "paid" ? "Pagado" : "Pendiente de pago"}
                />
              )}

              {selectedWorker.paymentInfo ? (
                <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Método</p>
                    <p className="text-sm font-semibold">{selectedWorker.paymentInfo.methodType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Detalle</p>
                    <p className="text-sm font-semibold">{selectedWorker.paymentInfo.paymentDetails}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  El trabajador aún no ha registrado su método e información de pago.
                </div>
              )}

              {!isInactivePayoutRow && (
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setSelectedWorker(null)}>
                    Cancelar
                  </Button>
                  <Button type="button" onClick={handleTogglePaymentStatus} disabled={updatingPaymentStatus}>
                    {updatingPaymentStatus
                      ? "Actualizando…"
                      : selectedWorkerCurrentStatus === "paid"
                        ? "Marcar como pendiente"
                        : "Marcar como pagado"}
                  </Button>
                </DialogFooter>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function buildPaymentMonthOptions(total = 12, date = new Date()) {
  const options = [];
  const start = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  for (let i = 0; i < total; i += 1) {
    const monthDate = new Date(start.getFullYear(), start.getMonth() - i, 1);
    const value = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    options.push({ value, label: formatPaymentMonthLabel(value) });
  }
  return options;
}

function formatPaymentMonthLabel(paymentMonth) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(paymentMonth || ""));
  if (!m) return String(paymentMonth || "");
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  const date = new Date(year, monthIndex, 1);
  const label = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
