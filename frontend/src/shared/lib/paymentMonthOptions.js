import { getReportCalendarTimeZone } from "./reportCalendar";

function ymdPartsInTimeZone(date, timeZone) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = f.formatToParts(date);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  return { y, m, d };
}

/** Mes calendario en curso (YYYY-MM) en la zona de informes del cliente. */
export function getCalendarMonthKeyInReportTZ(date = new Date()) {
  const tz = getReportCalendarTimeZone();
  const { y, m } = ymdPartsInTimeZone(date, tz);
  return `${y}-${String(m).padStart(2, "0")}`;
}

/**
 * Mes de pago por defecto (corte el día 23): del 1 al 23 es el mes calendario anterior;
 * del 24 en adelante es el mes calendario en curso.
 */
export function getDefaultPaymentMonthKey(date = new Date()) {
  const tz = getReportCalendarTimeZone();
  const { y, m, d } = ymdPartsInTimeZone(date, tz);
  if (d <= 23) {
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    return `${py}-${String(pm).padStart(2, "0")}`;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

function parseMonthKey(key) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(key || ""));
  if (!m) return { y: 1970, mo: 1 };
  return { y: Number(m[1]), mo: Number(m[2]) };
}

function compareMonthKeys(a, b) {
  return String(a).localeCompare(String(b));
}

function buildMonthOptionsFromStartToEnd(endKey) {
  const { y: endY, mo: endMo } = parseMonthKey(endKey);
  const endSeq = endY * 12 + endMo;
  let startSeq = endY * 12 + 3;
  if (startSeq > endSeq) {
    startSeq = (endY - 1) * 12 + 3;
  }

  const options = [];
  for (let seq = startSeq; seq <= endSeq; seq += 1) {
    const yy = Math.floor((seq - 1) / 12);
    const mm = ((seq - 1) % 12) + 1;
    const value = `${yy}-${String(mm).padStart(2, "0")}`;
    options.push({ value, label: formatPaymentMonthLabel(value) });
  }
  options.reverse();
  return options;
}

/**
 * Meses acumulativos para pagos: desde el bloque de marzo hasta el mes de pago por defecto (regla del 23).
 * El más reciente aparece primero.
 */
export function buildAccumulatedPaymentMonthOptions(date = new Date()) {
  return buildMonthOptionsFromStartToEnd(getDefaultPaymentMonthKey(date));
}

/**
 * Igual que pagos pero el rango llega al mayor entre el mes de pago por defecto y el mes calendario actual
 * (para que el mes en curso aparezca aunque aún no sea el periodo de liquidación).
 */
export function buildEarningsPeriodMonthOptions(date = new Date()) {
  const payEnd = getDefaultPaymentMonthKey(date);
  const calEnd = getCalendarMonthKeyInReportTZ(date);
  const endKey = compareMonthKeys(calEnd, payEnd) >= 0 ? calEnd : payEnd;
  return buildMonthOptionsFromStartToEnd(endKey);
}

export function formatPaymentMonthLabel(paymentMonth) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(paymentMonth || ""));
  if (!m) return String(paymentMonth || "");
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  const dt = new Date(year, monthIndex, 1);
  const label = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(dt);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
