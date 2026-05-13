import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EmptyState from "@/components/EmptyState";
import DataTable from "@/components/DataTable";
import {
  upsertWorkerNetRevenueOverride,
  upsertWorkerDomainNetRevenueOverride,
  deleteWorkerDomainNetRevenueOverride,
} from "../../../shared/api/payouts";
import { toUserErrorMessage } from "../../../shared/lib/uiError";

const ADMIN_TABLE_DENSITY_CLASS =
  "text-xs sm:text-sm [&_th]:px-2.5 [&_td]:px-2.5 [&_th]:py-2 [&_td]:py-2.5 sm:[&_th]:px-4 sm:[&_td]:p-4";

function slotKey(domain, gamNetworkCode) {
  return `${String(domain || "")}|||${String(gamNetworkCode || "").trim()}`;
}

function previewPayout(net, percentage) {
  const n = Number(net);
  const p = Number(percentage) || 0;
  if (!Number.isFinite(n)) return "0.00";
  return ((n * p) / 100).toFixed(2);
}

/** Al refrescar datos con el modal abierto, conserva borradores por slot; solo rellena slots nuevos desde el servidor. */
function mergeModalDraftsPreserveUserInput(prev, breakdown) {
  const next = { ...prev };
  const validKeys = new Set();
  for (const row of breakdown || []) {
    const k = slotKey(row.domain, row.gamNetworkCode);
    validKeys.add(k);
    if (!(k in next)) {
      next[k] = String(Number(row.netEffective ?? 0).toFixed(2));
    }
  }
  for (const k of Object.keys(next)) {
    if (!validKeys.has(k)) delete next[k];
  }
  return next;
}

/**
 * @param {{
 *   payouts: Array<{
 *     workerId: number, name: string, email?: string, percentage: number,
 *     assignedDomains: string[], assignedRevenue: number,
 *     assignedRevenueGam?: number,
 *     hasRevenueOverride?: boolean,
 *     hasDomainRevenueOverrides?: boolean,
 *     aggregateOverrideOnly?: boolean,
 *     domainBreakdown?: Array<{
 *       domain: string,
 *       gamNetworkCode: string,
 *       impressions: number,
 *       netGam: number,
 *       netEffective: number,
 *       hasDomainOverride?: boolean,
 *       payoutPreview: number,
 *     }>,
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
  const [modalWorkerId, setModalWorkerId] = useState(null);
  const [modalDrafts, setModalDrafts] = useState({});
  const [modalError, setModalError] = useState("");
  const [savingSlotKey, setSavingSlotKey] = useState(null);
  const modalScrollAreaRef = useRef(null);

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
        .map((p) => {
          const bd = (p.domainBreakdown || []).length;
          const hd = p.hasDomainRevenueOverrides ? 1 : 0;
          return `${p.workerId}:${p.assignedRevenue}:${p.payout}:${p.hasRevenueOverride ? 1 : 0}:${hd}:${bd}`;
        })
        .join("|"),
    [payouts],
  );

  useEffect(() => {
    setDraftNetByWorker({});
    setRowError(null);
  }, [payoutSignature, earningsDateRange.startDate, earningsDateRange.endDate, networkCode]);

  const modalWorker = useMemo(
    () => (modalWorkerId == null ? null : payouts.find((p) => p.workerId === modalWorkerId) || null),
    [payouts, modalWorkerId],
  );

  useEffect(() => {
    if (modalWorkerId == null || !modalWorker) return;
    setModalDrafts((prev) =>
      mergeModalDraftsPreserveUserInput(prev, modalWorker.domainBreakdown || []),
    );
  }, [payoutSignature, modalWorkerId, modalWorker]);

  function openDomainModal(w) {
    setModalError("");
    setModalWorkerId(w.workerId);
    const breakdown = w.domainBreakdown || [];
    const next = {};
    for (const row of breakdown) {
      next[slotKey(row.domain, row.gamNetworkCode)] = String(
        Number(row.netEffective ?? 0).toFixed(2),
      );
    }
    setModalDrafts(next);
  }

  function closeDomainModal() {
    setModalWorkerId(null);
    setModalDrafts({});
    setModalError("");
    setSavingSlotKey(null);
  }

  function captureModalScrollTop() {
    return modalScrollAreaRef.current?.scrollTop ?? 0;
  }

  function restoreModalScrollTop(scrollTop) {
    requestAnimationFrame(() => {
      const el = modalScrollAreaRef.current;
      if (el) el.scrollTop = scrollTop;
    });
  }

  function netInputValue(w) {
    const d = draftNetByWorker[w.workerId];
    if (d !== undefined && d !== "") return d;
    return String(Number(w.assignedRevenue ?? 0).toFixed(2));
  }

  async function handleRecalculate(w) {
    if (w.hasDomainRevenueOverrides) {
      setRowError(
        "Hay ajustes por subdominio activos en este periodo; elimínalos antes de poder usar el neto agregado.",
      );
      return;
    }
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

  async function handleSaveDomainRow(domain, gamNetworkCode) {
    if (!modalWorker || !networkCode || !earningsDateRange.startDate || !earningsDateRange.endDate) {
      return;
    }
    const k = slotKey(domain, gamNetworkCode);
    const raw = modalDrafts[k];
    const net = parseFloat(String(raw ?? "").replace(",", "."));
    if (!Number.isFinite(net) || net < 0) {
      setModalError("Introduce un neto válido (≥ 0) para cada fila.");
      return;
    }
    setModalError("");
    setSavingSlotKey(k);
    const scrollTop = captureModalScrollTop();
    try {
      await upsertWorkerDomainNetRevenueOverride({
        workerId: modalWorker.workerId,
        gamNetworkCode: networkCode,
        domain,
        periodStart: earningsDateRange.startDate,
        periodEnd: earningsDateRange.endDate,
        netRevenue: net,
      });
      await onNetOverrideSaved?.();
      restoreModalScrollTop(scrollTop);
    } catch (err) {
      setModalError(toUserErrorMessage(err, "No se pudo guardar el ajuste del subdominio."));
    } finally {
      setSavingSlotKey(null);
    }
  }

  async function handleResetDomainRow(domain, gamNetworkCode) {
    if (!modalWorker || !networkCode || !earningsDateRange.startDate || !earningsDateRange.endDate) {
      return;
    }
    const k = slotKey(domain, gamNetworkCode);
    setModalError("");
    setSavingSlotKey(k);
    const scrollTop = captureModalScrollTop();
    try {
      await deleteWorkerDomainNetRevenueOverride({
        workerId: modalWorker.workerId,
        gamNetworkCode: networkCode,
        domain,
        periodStart: earningsDateRange.startDate,
        periodEnd: earningsDateRange.endDate,
      });
      await onNetOverrideSaved?.();
      restoreModalScrollTop(scrollTop);
    } catch (err) {
      setModalError(toUserErrorMessage(err, "No se pudo restablecer el subdominio."));
    } finally {
      setSavingSlotKey(null);
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

  const modalBreakdown = modalWorker?.domainBreakdown || [];
  const modalTotalNet = modalBreakdown.reduce((s, r) => {
    const k = slotKey(r.domain, r.gamNetworkCode);
    const v = parseFloat(String(modalDrafts[k] ?? "").replace(",", "."));
    return s + (Number.isFinite(v) ? v : Number(r.netEffective ?? 0));
  }, 0);
  const modalTotalPayoutPreview = modalWorker
    ? previewPayout(modalTotalNet, modalWorker.percentage)
    : "0.00";

  return (
    <div className="admin-table-shell space-y-2">
      <p className="text-xs text-muted-foreground max-w-3xl">
        Los ingresos netos provienen de Ad Manager salvo ajustes. Puedes fijar un <strong>neto total</strong>{" "}
        por trabajador y red (Recalcular) o, si tiene <strong>varios subdominios</strong>, un{" "}
        <strong>neto por subdominio</strong> en el modal.
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
        renderRow={(w) => {
          const aggregateLocked = !!w.hasDomainRevenueOverrides;
          const domainCount = w.assignedDomains.length;
          const multipleDomains = domainCount > 1;
          const recalculateLabel =
            savingWorkerId === w.workerId
              ? "Guardando…"
              : multipleDomains
                ? "Recalcular ganancia (total)"
                : "Recalcular ganancia";
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
              <TableCell className="align-top min-w-[9rem] max-w-[14rem]">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-xs shrink-0">$</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="h-8 text-xs tabular-nums"
                      disabled={
                        !!w.deletedAt ||
                        w.assignedDomains.length === 0 ||
                        aggregateLocked
                      }
                      readOnly={aggregateLocked}
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
                      aggregateLocked ||
                      savingWorkerId === w.workerId
                    }
                    onClick={() => handleRecalculate(w)}
                  >
                    {recalculateLabel}
                  </Button>
                  {multipleDomains ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs w-full"
                      disabled={!!w.deletedAt || domainCount === 0 || !networkCode}
                      onClick={() => openDomainModal(w)}
                    >
                      Por subdominio…
                    </Button>
                  ) : null}
                  {w.hasDomainRevenueOverrides ? (
                    <span className="text-[10px] text-muted-foreground">Ajuste por subdominio activo</span>
                  ) : w.hasRevenueOverride ? (
                    <span className="text-[10px] text-muted-foreground">Ajuste total manual</span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="tabular-nums">{w.percentage}%</TableCell>
              <TableCell className="tabular-nums font-semibold">${w.payout.toFixed(2)}</TableCell>
            </TableRow>
          );
        }}
        footer={() => (
          <TableRow>
            <TableCell colSpan={5} className="text-sm font-semibold text-muted-foreground">
              Ganancia total
            </TableCell>
            <TableCell className="tabular-nums font-semibold">${totalPayout.toFixed(2)}</TableCell>
          </TableRow>
        )}
      />

      <Dialog open={modalWorkerId != null} onOpenChange={(open) => !open && closeDomainModal()}>
        <DialogContent
          className="flex max-h-[min(90vh,920px)] w-[calc(100vw-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden border-border/60 p-0 sm:w-full sm:p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="shrink-0 space-y-2 border-b border-border/60 px-6 pb-4 pt-6 sm:px-8 sm:pt-8">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-xl sm:text-2xl">
                Ingresos netos por subdominio
                {modalWorker ? ` · ${modalWorker.name}` : ""}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                Edita el neto de cada subdominio y guarda fila a fila. La ganancia se calcula con el{" "}
                {modalWorker ? `${modalWorker.percentage}%` : ""} del trabajador. «Restablecer» vuelve
                al dato de Ad Manager para esa fila.
              </DialogDescription>
            </DialogHeader>
            {modalError ? (
              <p className="text-sm font-medium text-destructive">{modalError}</p>
            ) : null}
          </div>

          <div
            ref={modalScrollAreaRef}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 sm:px-8 sm:py-6"
          >
            {modalWorker && modalBreakdown.length > 0 ? (
              <div className="space-y-5">
                <div className="overflow-x-auto rounded-lg border border-border shadow-sm">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50 text-left">
                        <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-5 sm:py-4">
                          Subdominio
                        </th>
                        <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-5 sm:py-4">
                          Impresiones
                        </th>
                        <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-5 sm:py-4">
                          Neto GAM
                        </th>
                        <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-5 sm:py-4">
                          Neto
                        </th>
                        <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-5 sm:py-4">
                          Ganancia
                        </th>
                        <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-5 sm:py-4">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalBreakdown.map((row) => {
                        const k = slotKey(row.domain, row.gamNetworkCode);
                        const raw = modalDrafts[k];
                        const net = parseFloat(String(raw ?? "").replace(",", "."));
                        const netForPreview = Number.isFinite(net)
                          ? net
                          : Number(row.netEffective ?? 0);
                        return (
                          <tr key={k} className="border-b border-border/60 last:border-0">
                            <td className="px-4 py-4 align-middle sm:px-5 sm:py-4">
                              <span className="font-medium leading-snug break-all">{row.domain}</span>
                            </td>
                            <td className="px-4 py-4 align-middle tabular-nums sm:px-5">
                              {Number(row.impressions || 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-4 align-middle tabular-nums sm:px-5">
                              ${Number(row.netGam ?? 0).toFixed(2)}
                            </td>
                            <td className="min-w-[8.5rem] px-4 py-4 align-middle sm:px-5">
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground text-sm">$</span>
                                <Input
                                  className="h-9 min-w-[6rem] text-sm tabular-nums"
                                  value={raw ?? ""}
                                  onChange={(e) =>
                                    setModalDrafts((prev) => ({ ...prev, [k]: e.target.value }))
                                  }
                                  disabled={savingSlotKey === k}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-4 align-middle tabular-nums text-sm font-medium sm:px-5">
                              ${previewPayout(netForPreview, modalWorker.percentage)}
                            </td>
                            <td className="px-4 py-4 align-middle sm:px-5">
                              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  className="h-9 shrink-0 text-sm"
                                  disabled={savingSlotKey === k}
                                  onClick={() => handleSaveDomainRow(row.domain, row.gamNetworkCode)}
                                >
                                  {savingSlotKey === k ? "Guardando…" : "Guardar"}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-9 shrink-0 text-sm"
                                  disabled={savingSlotKey === k || !row.hasDomainOverride}
                                  onClick={() => handleResetDomainRow(row.domain, row.gamNetworkCode)}
                                >
                                  Restablecer
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-muted/40 px-5 py-4 text-sm sm:px-6">
                  <span className="text-muted-foreground">
                    Total neto (vista previa):{" "}
                    <strong className="text-foreground tabular-nums">${modalTotalNet.toFixed(2)}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Ganancia total (vista previa):{" "}
                    <strong className="text-foreground tabular-nums">${modalTotalPayoutPreview}</strong>
                  </span>
                </div>
              </div>
            ) : modalWorker ? (
              <p className="text-sm text-muted-foreground">
                No hay subdominios en esta red para desglosar.
              </p>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 border-t border-border/60 bg-muted/20 px-6 py-4 sm:px-8 sm:py-5">
            <Button type="button" variant="secondary" onClick={closeDomainModal}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
