import { useEffect, useMemo, useState } from "react";
import { HandCoins } from "lucide-react";
import { updateWorkerPaymentStatus } from "../../../shared/api/workers";
import { toUserErrorMessage } from "../../../shared/lib/uiError";
import {
  buildAccumulatedPaymentMonthOptions,
  formatPaymentMonthLabel,
} from "../../../shared/lib/paymentMonthOptions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
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
import StatusBadge from "@/components/StatusBadge";
import DataTable from "@/components/DataTable";
import SectionHeader from "@/components/SectionHeader";

const PANEL_TABLE_DENSITY_CLASS =
  "text-xs sm:text-sm [&_th]:px-2.5 [&_td]:px-2.5 [&_th]:py-2 [&_td]:py-2.5 sm:[&_th]:px-4 sm:[&_td]:p-4";

/**
 * Estado de pago por mes (independiente del rango de fechas de la tabla de ganancias).
 *
 * @param {{
 *   payouts: Array<{ workerId: number, name: string, email?: string, deletedAt?: string | null }>,
 *   workers?: Array<{
 *     id: number, paymentStatus?: string, paymentInfo?: { methodType: string, paymentDetails: string } | null
 *   }>,
 *   paymentMonth: string,
 *   onPaymentMonthChange?: (value: string) => void,
 *   onRefresh?: () => void,
 *   isLoading?: boolean,
 *   paymentMonthOptionsTick?: string,
 * }} props
 */
export default function AdminEarningsPaymentStatusPanel({
  payouts = [],
  workers = [],
  paymentMonth,
  onPaymentMonthChange,
  onRefresh,
  isLoading = false,
  paymentMonthOptionsTick = "",
}) {
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [updatingPaymentStatus, setUpdatingPaymentStatus] = useState(false);
  const [modalError, setModalError] = useState("");

  const workersById = useMemo(
    () => new Map(workers.map((worker) => [worker.id, worker])),
    [workers],
  );

  const payoutRowsOrdered = useMemo(() => {
    return [...payouts].sort((a, b) => {
      const aInactive = !!a.deletedAt;
      const bInactive = !!b.deletedAt;
      if (aInactive !== bInactive) return aInactive ? 1 : -1;
      return String(a.name || "").localeCompare(String(b.name || ""), "es");
    });
  }, [payouts]);

  const paymentMonthOptions = useMemo(
    () => buildAccumulatedPaymentMonthOptions(new Date()),
    [paymentMonthOptionsTick],
  );
  const latestAllowedMonth = paymentMonthOptions[0]?.value;

  useEffect(() => {
    if (!latestAllowedMonth || !onPaymentMonthChange) return;
    const allowed = new Set(paymentMonthOptions.map((o) => o.value));
    if (!paymentMonth || !allowed.has(paymentMonth)) {
      onPaymentMonthChange(latestAllowedMonth);
    }
  }, [paymentMonthOptions, paymentMonth, latestAllowedMonth, onPaymentMonthChange]);

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
    setModalError("");
    try {
      await updateWorkerPaymentStatus(selectedWorker.workerId, nextStatus, paymentMonth);
      setSelectedWorker(null);
      if (typeof onRefresh === "function") {
        await onRefresh();
      }
    } catch (err) {
      setModalError(toUserErrorMessage(err, "No se pudo actualizar el estado de pago."));
    } finally {
      setUpdatingPaymentStatus(false);
    }
  }

  function openPaymentModal(payoutWorker) {
    const workerDetail = workersById.get(payoutWorker.workerId) || {};
    setModalError("");
    setSelectedWorker({
      ...payoutWorker,
      paymentStatus: workerDetail.paymentStatus || "pending",
      paymentInfo: workerDetail.paymentInfo || null,
    });
  }

  const isInactivePayoutRow = !!selectedWorker?.deletedAt;

  return (
    <div className="space-y-3 pt-6 border-t border-border/60">
      <SectionHeader
        title="Pagos por periodo"
        description="El periodo aquí no cambia al seleccionar hoy, ayer u otros rangos de la tabla superior. Usa el mes para marcar pagado o pendiente."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-muted-foreground">
          Periodo de pago: <span className="font-medium text-foreground">{paymentMonthLabel}</span>
        </span>
        <Select value={paymentMonth} onValueChange={(value) => onPaymentMonthChange?.(value)}>
          <SelectTrigger className="w-full sm:w-64" aria-label="Mes de pago acumulado">
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

      <div className="admin-table-shell">
        {isLoading ? (
          <DataTable
            className={PANEL_TABLE_DENSITY_CLASS}
            columns={["Trabajador", "Estado de pago", "Pagos"]}
            rows={Array.from({ length: 4 })}
            renderRow={(_, idx) => (
              <TableRow key={`pay-panel-skel-${idx}`}>
                <TableCell>
                  <Skeleton className="h-4 w-36" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-8 rounded-md" />
                </TableCell>
              </TableRow>
            )}
          />
        ) : payoutRowsOrdered.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1 py-4">
            No hay trabajadores en la tabla de ganancias para este rango. Cuando haya filas arriba,
            podrás gestionar el estado de pago por mes aquí.
          </p>
        ) : (
          <DataTable
            className={PANEL_TABLE_DENSITY_CLASS}
            columns={["Trabajador", "Estado de pago", "Pagos"]}
            rows={payoutRowsOrdered}
            renderRow={(w) => {
              const status = workersById.get(w.workerId)?.paymentStatus || "pending";
              return (
                <TableRow key={`pay-status-${w.workerId}`}>
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
          />
        )}
      </div>

      {selectedWorker && (
        <Dialog
          open={!!selectedWorker}
          onOpenChange={(value) => (!value ? setSelectedWorker(null) : null)}
        >
          <DialogContent className="sm:max-w-xl border-border/60">
            <DialogHeader>
              <DialogTitle>
                {isInactivePayoutRow
                  ? `Información de pago · ${selectedWorker.name}`
                  : `Estado de pago de ${selectedWorker.name}`}
              </DialogTitle>
              <DialogDescription>
                Periodo: <strong>{paymentMonthLabel}</strong>. Revisa método y datos registrados por
                el trabajador.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {isInactivePayoutRow && (
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                  Perfil <strong>Inactivo</strong>: puedes revisar método y datos de pago
                  registrados. El <strong>estado de pago</strong> (pagado/pendiente) no aplica ni se
                  muestra.
                </div>
              )}

              {!isInactivePayoutRow && (
                <StatusBadge
                  status={selectedWorkerCurrentStatus === "paid" ? "paid" : "pending"}
                  label={selectedWorkerCurrentStatus === "paid" ? "Pagado" : "Pendiente de pago"}
                />
              )}

              {modalError ? <p className="text-sm font-medium text-danger">{modalError}</p> : null}

              {selectedWorker.paymentInfo ? (
                <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Método</p>
                    <p className="text-sm font-semibold">{selectedWorker.paymentInfo.methodType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Detalle</p>
                    <p className="text-sm font-semibold">
                      {selectedWorker.paymentInfo.paymentDetails}
                    </p>
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
                  <Button
                    type="button"
                    onClick={handleTogglePaymentStatus}
                    disabled={updatingPaymentStatus}
                  >
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
    </div>
  );
}
