import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import DataTable from "@/components/DataTable";

export default function PaymentHistoryTable({ rows = [], isLoading = false }) {
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => monthStart(new Date()));
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftEndDate, setDraftEndDate] = useState("");
  const popoverRef = useRef(null);

  const orderedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime(),
      ),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const startMs = appliedStartDate ? Date.parse(`${appliedStartDate}T00:00:00`) : null;
    const endMs = appliedEndDate ? Date.parse(`${appliedEndDate}T23:59:59.999`) : null;
    return orderedRows.filter((row) => {
      const paidAtMs = parsePaidAtMs(row.paidAt);
      if (!Number.isFinite(paidAtMs)) return false;
      if (startMs != null && paidAtMs < startMs) return false;
      if (endMs != null && paidAtMs > endMs) return false;
      return true;
    });
  }, [orderedRows, appliedStartDate, appliedEndDate]);

  const hasRangeFilter = !!appliedStartDate || !!appliedEndDate;
  const normalizedDraftRange = normalizeRange(draftStartDate, draftEndDate);
  const calendarDays = useMemo(() => buildCalendarDays(viewMonth), [viewMonth]);

  function openPicker() {
    setDraftStartDate(appliedStartDate);
    setDraftEndDate(appliedEndDate);
    const focusDate = appliedStartDate ? parseISODate(appliedStartDate) : new Date();
    setViewMonth(monthStart(focusDate));
    setPickerOpen(true);
  }

  function handleDatePick(isoDate) {
    if (!draftStartDate || draftEndDate) {
      setDraftStartDate(isoDate);
      setDraftEndDate("");
      return;
    }
    if (isoDate < draftStartDate) {
      setDraftStartDate(isoDate);
      setDraftEndDate("");
      return;
    }
    setDraftEndDate(isoDate);
  }

  function applyRange() {
    const normalized = normalizeRange(draftStartDate, draftEndDate);
    setAppliedStartDate(normalized.start);
    setAppliedEndDate(normalized.end);
    setPickerOpen(false);
  }

  function closePickerDiscardDraft() {
    setDraftStartDate(appliedStartDate);
    setDraftEndDate(appliedEndDate);
    setPickerOpen(false);
  }

  function clearRange() {
    setDraftStartDate("");
    setDraftEndDate("");
    setAppliedStartDate("");
    setAppliedEndDate("");
    setPickerOpen(false);
  }

  useEffect(() => {
    if (!isPickerOpen) return undefined;
    function handleOutsideClick(event) {
      if (!popoverRef.current) return;
      if (popoverRef.current.contains(event.target)) return;
      closePickerDiscardDraft();
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isPickerOpen, appliedStartDate, appliedEndDate]);

  return (
    <>
      {isLoading ? (
        <DataTable
          columns={["Fecha de pago", "Estado", "Trabajador", "Método de pago", "Cantidad"]}
          rows={Array.from({ length: 4 })}
          renderRow={(_, idx) => (
            <TableRow key={`history-skeleton-${idx}`}>
              <TableCell><Skeleton className="h-4 w-28" /></TableCell>
              <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-28" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            </TableRow>
          )}
        />
      ) : null}

      {!isLoading && orderedRows.length === 0 ? (
        <EmptyState
          title="Sin historial de pagos"
          description="Aún no hay pagos registrados. Cuando marques trabajadores como pagados aparecerán aquí."
        />
      ) : !isLoading ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" onClick={openPicker}>
              {hasRangeFilter
                ? `${formatCompactDate(appliedStartDate)} - ${formatCompactDate(appliedEndDate)}`
                : "Seleccionar rango de fechas"}
            </Button>
            {hasRangeFilter && (
              <Button type="button" variant="secondary" onClick={clearRange}>
                Limpiar filtros
              </Button>
            )}
          </div>

          {isPickerOpen && (
            <div
              className="mt-4 w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-lg"
              ref={popoverRef}
            >
              <div className="flex items-center justify-between mb-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Mes anterior"
                  onClick={() => setViewMonth(addMonths(viewMonth, -1))}
                >
                  ‹
                </Button>
                <strong className="text-sm">{formatMonthYear(viewMonth)}</strong>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Mes siguiente"
                  onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                >
                  ›
                </Button>
              </div>
              <div className="grid grid-cols-7 text-xs text-muted-foreground mb-2">
                {["D", "L", "M", "M", "J", "V", "S"].map((d, idx) => (
                  <span key={`${d}-${idx}`} className="text-center">
                    {d}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  if (!day) return <span key={`blank-${idx}`} />;
                  const iso = toISODate(day);
                  const inRange =
                    normalizedDraftRange.start &&
                    normalizedDraftRange.end &&
                    iso >= normalizedDraftRange.start &&
                    iso <= normalizedDraftRange.end;
                  const isStart = normalizedDraftRange.start === iso;
                  const isEnd = normalizedDraftRange.end === iso;
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => handleDatePick(iso)}
                      className={[
                        "h-8 w-8 rounded-md text-xs transition-colors",
                        inRange ? "bg-primary/15 text-primary" : "hover:bg-accent",
                        isStart || isEnd ? "bg-primary" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={closePickerDiscardDraft}>
                  Cancelar
                </Button>
                <Button type="button" onClick={applyRange}>
                  Aplicar
                </Button>
              </div>
            </div>
          )}

          {filteredRows.length === 0 ? (
            <EmptyState
              title="Sin pagos en este rango"
              description={
                hasRangeFilter
                  ? "No existen pagos realizados en el rango de fechas seleccionado. Ajusta el filtro para consultar otros periodos."
                  : "No hay pagos para mostrar en este momento."
              }
            />
          ) : (
            <DataTable
              columns={["Fecha de pago", "Estado", "Trabajador", "Método de pago", "Cantidad"]}
              rows={filteredRows}
              renderRow={(row, idx) => (
                <TableRow
                  key={`${row.workerName}-${row.paymentMonth}-${row.paidAt}-${idx}`}
                  className="transition-colors hover:bg-muted/20"
                >
                  <TableCell>{formatPaidAt(row.paidAt)}</TableCell>
                  <TableCell>
                    <StatusBadge status="paid" label={row.statusLabel || "Pago realizado"} />
                  </TableCell>
                  <TableCell>{row.workerName}</TableCell>
                  <TableCell>{row.methodType || "-"}</TableCell>
                  <TableCell className="tabular-nums font-semibold">
                    {new Intl.NumberFormat("es-ES", {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(row.amount || 0)}
                  </TableCell>
                </TableRow>
              )}
            />
          )}
        </>
      ) : null}
    </>
  );
}

function formatPaidAt(raw) {
  if (!raw) return "-";
  const normalized = String(raw).includes("T") ? String(raw) : String(raw).replace(" ", "T") + "Z";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(raw);
  return new Intl.DateTimeFormat("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function parsePaidAtMs(raw) {
  if (!raw) return NaN;
  const normalized = String(raw).includes("T") ? String(raw) : String(raw).replace(" ", "T") + "Z";
  return Date.parse(normalized);
}

function parseISODate(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function buildCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstWeekday = firstDay.getDay();
  const days = [];
  for (let i = 0; i < firstWeekday; i += 1) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d += 1) {
    days.push(new Date(year, month, d));
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function normalizeRange(start, end) {
  if (!start && !end) return { start: "", end: "" };
  if (start && !end) return { start, end: start };
  if (!start && end) return { start: end, end };
  if (start <= end) return { start, end };
  return { start: end, end: start };
}

function formatMonthYear(date) {
  const label = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatCompactDate(iso) {
  if (!iso) return "";
  const d = parseISODate(iso);
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}
