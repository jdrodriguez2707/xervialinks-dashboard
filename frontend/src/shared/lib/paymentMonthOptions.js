/**
 * Meses de pago acumulativos: desde marzo (del año que corresponda) hasta el mes calendario
 * anterior a hoy. Ej.: en mayo → marzo y abril; en junio → marzo, abril y mayo.
 *
 * Si el mes anterior es enero o febrero, el bloque de marzo empieza en marzo del año anterior.
 */
export function buildAccumulatedPaymentMonthOptions(date = new Date()) {
  const now = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const endY = end.getFullYear();
  let start = new Date(endY, 2, 1);
  if (start > end) {
    start = new Date(endY - 1, 2, 1);
  }

  const options = [];
  for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const value = `${y}-${String(m).padStart(2, "0")}`;
    options.push({ value, label: formatPaymentMonthLabel(value) });
  }
  options.reverse();
  return options;
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
