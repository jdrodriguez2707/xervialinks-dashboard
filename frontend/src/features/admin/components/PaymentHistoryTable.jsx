import { useEffect, useMemo, useRef, useState } from "react";

export default function PaymentHistoryTable({ rows = [] }) {
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
        (a, b) =>
          new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime()
      ),
    [rows]
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
      {orderedRows.length === 0 ? (
        <p className="empty-state">
          Aún no hay pagos registrados. Cuando marques trabajadores como pagados aparecerán aquí.
        </p>
      ) : (
        <>
      <div className="payment-history-filter">
        <button
          type="button"
          className="form-select admin-range-select payment-history-filter-trigger"
          onClick={openPicker}
        >
          {hasRangeFilter
            ? `${formatCompactDate(appliedStartDate)} - ${formatCompactDate(appliedEndDate)}`
            : "Seleccionar rango de fechas"}
        </button>
        {hasRangeFilter && (
          <button type="button" className="btn btn-secondary" onClick={clearRange}>
            Limpiar filtros
          </button>
        )}
      </div>

      {isPickerOpen && (
        <div className="payment-history-calendar-popover" ref={popoverRef}>
          <div className="payment-history-calendar-head">
            <button
              type="button"
              className="btn-icon"
              aria-label="Mes anterior"
              onClick={() => setViewMonth(addMonths(viewMonth, -1))}
            >
              ‹
            </button>
            <strong>{formatMonthYear(viewMonth)}</strong>
            <button
              type="button"
              className="btn-icon"
              aria-label="Mes siguiente"
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            >
              ›
            </button>
          </div>
          <div className="payment-history-calendar-weekdays">
            {["D", "L", "M", "M", "J", "V", "S"].map((d, idx) => (
              <span key={`${d}-${idx}`}>{d}</span>
            ))}
          </div>
          <div className="payment-history-calendar-grid">
            {calendarDays.map((day, idx) => {
              if (!day) return <span key={`blank-${idx}`} className="payment-history-day-empty" />;
              const iso = toISODate(day);
              const inRange =
                normalizedDraftRange.start &&
                normalizedDraftRange.end &&
                iso >= normalizedDraftRange.start &&
                iso <= normalizedDraftRange.end;
              const isStart = normalizedDraftRange.start === iso;
              const isEnd = normalizedDraftRange.end === iso;
              const className = [
                "payment-history-day",
                inRange ? "is-in-range" : "",
                isStart ? "is-range-start" : "",
                isEnd ? "is-range-end" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button key={iso} type="button" className={className} onClick={() => handleDatePick(iso)}>
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          <div className="payment-history-calendar-actions">
            <button type="button" className="btn btn-secondary" onClick={closePickerDiscardDraft}>
              Cancelar
            </button>
            <button type="button" className="btn" onClick={applyRange}>
              Aplicar
            </button>
          </div>
        </div>
      )}

      {filteredRows.length === 0 ? (
        <p className="empty-state">
          {hasRangeFilter
            ? "No existen pagos realizados en el rango de fechas seleccionado. Ajusta el filtro para consultar otros periodos."
            : "No hay pagos para mostrar en este momento."}
        </p>
      ) : (
        <div className="table-wrapper">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Fecha de pago</th>
                <th>Estado</th>
                <th>Trabajador</th>
                <th>Método de pago</th>
                <th>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => (
                <tr key={`${row.workerName}-${row.paymentMonth}-${row.paidAt}-${idx}`}>
                  <td>{formatPaidAt(row.paidAt)}</td>
                  <td>
                    <span className="payment-status-badge is-paid">{row.statusLabel || "Pago realizado"}</span>
                  </td>
                  <td>{row.workerName}</td>
                  <td>{row.methodType || "-"}</td>
                  <td>
                    <span className="payout-amount">
                      {new Intl.NumberFormat("es-ES", {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(row.amount || 0)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}
    </>
  );
}

function formatPaidAt(raw) {
  if (!raw) return "-";
  const normalized = String(raw).includes("T")
    ? String(raw)
    : String(raw).replace(" ", "T") + "Z";
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
  const normalized = String(raw).includes("T")
    ? String(raw)
    : String(raw).replace(" ", "T") + "Z";
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
