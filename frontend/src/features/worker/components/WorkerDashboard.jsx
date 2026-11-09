import { useEffect, useMemo, useState } from "react";
import { BarChart3, Globe, CreditCard, CircleDollarSign } from "lucide-react";
import { upsertWorkerPaymentInfo } from "../../../shared/api/worker";
import { toUserErrorMessage } from "../../../shared/lib/uiError";
import {
  buildAccumulatedPaymentMonthOptions,
  formatPaymentMonthLabel,
} from "../../../shared/lib/paymentMonthOptions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/MetricCard";
import SectionHeader from "@/components/SectionHeader";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";

const PERIODS = ["today", "yesterday", "last7Days", "currentMonth"];

const PERIOD_LABELS = {
  today: "Hoy",
  yesterday: "Ayer",
  last7Days: "Últimos 7 días",
  currentMonth: "Este mes",
};

const fmtCurrency = (n) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n ?? 0);

const fmtEcpm = (n) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n ?? 0);

const fmtImpressions = (n) => new Intl.NumberFormat("es-MX").format(n ?? 0);

function getMetricComparison(periodData, metric) {
  const percentage = periodData?.comparison?.[metric];
  if (percentage == null) return { direction: "neutral" };

  if (percentage > 100) {
    return { direction: "up", capped: true };
  }

  return {
    direction: percentage > 0 ? "up" : "down",
    value: `${Math.abs(percentage).toFixed(1)}%`,
  };
}

const WORKER_TAB_STORAGE_PREFIX = "workerDashboardActiveTab";

function getWorkerTabStorageKey(workerId) {
  return `${WORKER_TAB_STORAGE_PREFIX}:${workerId || "unknown"}`;
}

function SkeletonCards({ count = 4 }) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${count > 4 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-lg" />
      ))}
    </div>
  );
}

export default function WorkerDashboard({
  workerContext,
  workerMetrics,
  workerPaymentHistory,
  selectedDomain,
  onDomainChange,
  contextLoading,
  metricsLoading,
  metricsError,
  error,
  onContextRefresh,
  workerId,
  paymentMonth,
  onPaymentMonthChange,
  paymentHistoryMonth,
  onPaymentHistoryMonthChange,
  /** Cambia cuando avanza el calendario (p. ej. label de fecha en App) para recalcular la lista de meses. */
  paymentMonthOptionsTick = "",
}) {
  const [activeTab, setActiveTab] = useState("stats");
  const [selectedRange, setSelectedRange] = useState("today");
  const [paymentInfo, setPaymentInfo] = useState(() => workerContext?.paymentInfo ?? null);

  const mergedDashboard = useMemo(() => {
    if (!workerContext && !workerMetrics) return null;
    return {
      ...(workerMetrics || {}),
      properties: workerContext?.properties ?? [],
      paymentInfo: workerContext?.paymentInfo ?? null,
    };
  }, [workerContext, workerMetrics]);

  // const tabs = useMemo(
  //   () => [
  //     { id: "stats", label: "Estadísticas", icon: BarChart3 },
  //     // { id: "domains", label: "Subdominios", icon: Globe },
  //     // { id: "payment", label: "Pago", icon: CreditCard },
  //     // { id: "payment-history", label: "Historial de pagos", icon: CircleDollarSign },
  //   ],
  //   [],
  // );

  const [openPaymentModal, setOpenPaymentModal] = useState(false);
  const [paymentMethodType, setPaymentMethodType] = useState("");
  const [paymentDetails, setPaymentDetails] = useState("");
  const [savingPaymentInfo, setSavingPaymentInfo] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  useEffect(() => {
    setPaymentInfo((prev) => workerContext?.paymentInfo ?? prev ?? null);
  }, [workerContext?.paymentInfo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!workerId) {
      setActiveTab("stats");
      return;
    }
    const saved = window.sessionStorage.getItem(getWorkerTabStorageKey(workerId));
    setActiveTab(saved || "stats");
  }, [workerId]);

  function handleTabChange(nextTab) {
    setActiveTab(nextTab);
    if (typeof window === "undefined" || !workerId) return;
    window.sessionStorage.setItem(getWorkerTabStorageKey(workerId), nextTab);
  }

  const { properties = [] } = workerContext ?? {};
  const domainProps = properties.filter((p) => p.type === "domain");
  const uniqueDomainList = useMemo(
    () => [...new Set(domainProps.map((p) => String(p.value || "").trim()).filter(Boolean))],
    [domainProps],
  );
  const hasDomains = uniqueDomainList.length > 0;
  const paymentStatus = workerContext?.paymentStatus || "pending";
  const paymentStatusLabel = paymentStatus === "paid" ? "Pagado" : "Pendiente de pago";
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

  useEffect(() => {
    if (!latestAllowedMonth || !onPaymentHistoryMonthChange) return;
    const allowed = new Set(paymentMonthOptions.map((o) => o.value));
    if (!paymentHistoryMonth || !allowed.has(paymentHistoryMonth)) {
      onPaymentHistoryMonthChange(latestAllowedMonth);
    }
  }, [paymentMonthOptions, paymentHistoryMonth, latestAllowedMonth, onPaymentHistoryMonthChange]);

  const paymentMonthLabel = formatPaymentMonthLabel(paymentMonth);
  const paymentHistoryMonthLabel = formatPaymentMonthLabel(paymentHistoryMonth);
  const paymentHistoryRows = workerPaymentHistory?.rows || [];
  const paymentHistoryTotalPayout =
    workerPaymentHistory?.totalPayout != null &&
    !Number.isNaN(Number(workerPaymentHistory.totalPayout))
      ? Number(workerPaymentHistory.totalPayout)
      : paymentHistoryRows.reduce((sum, r) => sum + (r.payout || 0), 0);
  const selectedDomainValue =
    selectedDomain && uniqueDomainList.includes(selectedDomain)
      ? selectedDomain
      : uniqueDomainList[0] || "";
  const canSwitchDomain = uniqueDomainList.length > 1;

  if (error) {
    return <p className="status-msg error">Error al cargar los ingresos.</p>;
  }

  if (contextLoading && !workerContext) {
    return <p className="status-msg">Cargando tu perfil…</p>;
  }

  async function handleDomainSwitch(nextDomain) {
    if (!nextDomain || nextDomain === selectedDomainValue) return;
    if (typeof onDomainChange === "function") {
      await onDomainChange(nextDomain);
    }
  }

  function openPaymentDialog() {
    setPaymentMethodType(paymentInfo?.methodType || "");
    setPaymentDetails(paymentInfo?.paymentDetails || "");
    setPaymentError(null);
    setOpenPaymentModal(true);
  }

  function closePaymentDialog() {
    setOpenPaymentModal(false);
    setPaymentError(null);
  }

  async function handleSavePaymentInfo(e) {
    e.preventDefault();
    setPaymentError(null);
    setSavingPaymentInfo(true);
    try {
      const saved = await upsertWorkerPaymentInfo({
        methodType: paymentMethodType,
        paymentDetails,
      });
      setPaymentInfo(saved);
      if (typeof onContextRefresh === "function") {
        await onContextRefresh();
      }
      closePaymentDialog();
    } catch (err) {
      setPaymentError(toUserErrorMessage(err, "No se pudo guardar la información de pago."));
    } finally {
      setSavingPaymentInfo(false);
    }
  }

  return (
    <div className="space-y-6 pb-16">
      {!hasDomains ? (
        <EmptyState
          title="Panel no disponible aun"
          description="Tu cuenta no tiene subdominios asignados. Una vez que el administrador configure tu acceso, aqui veras tus ingresos, eCPM e impresiones en tiempo real."
        />
      ) : activeTab === "stats" ? (
        <div className="space-y-4">
          {hasDomains && (
            <div className="flex justify-center">
              <Select
                value={selectedDomainValue}
                onValueChange={handleDomainSwitch}
                disabled={!canSwitchDomain}
              >
                <SelectTrigger className="w-full max-w-md sm:w-72">
                  <SelectValue placeholder="Seleccionar subdominio" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueDomainList.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {metricsError && (
            <p className="status-msg error" role="alert">
              {metricsError}
            </p>
          )}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Ingresos estimados</h2>
              </div>
              {workerContext?.percentage != null ? (
                <Badge className="bg-primary/15 text-primary tabular-nums shrink-0">
                  {Number(workerContext.percentage)}%
                </Badge>
              ) : null}
            </div>
            {metricsLoading ? (
              <SkeletonCards count={5} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {PERIODS.map((period) => (
                  <MetricCard
                    key={period}
                    title={PERIOD_LABELS[period]}
                    value={fmtCurrency(mergedDashboard?.[period]?.revenue)}
                    comparison={
                      period === "today"
                        ? null
                        : getMetricComparison(mergedDashboard?.[period], "revenue")
                    }
                    active={period === "currentMonth"}
                    gradientBorder
                  />
                ))}
                <MetricCard
                  title="Este mes (bruto)"
                  subtitle="Sin aplicar tu porcentaje"
                  value={fmtCurrency(mergedDashboard?.currentMonth?.grossRevenue)}
                  comparison={getMetricComparison(mergedDashboard?.currentMonth, "grossRevenue")}
                  gradientBorder
                />
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">eCPM promedio</h2>
              <Select value={selectedRange} onValueChange={setSelectedRange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Seleccionar rango" />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((period) => (
                    <SelectItem key={period} value={period}>
                      {PERIOD_LABELS[period]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {metricsLoading ? (
              <Skeleton className="h-24 rounded-lg" />
            ) : (
              <MetricCard
                title={PERIOD_LABELS[selectedRange]}
                value={fmtEcpm(mergedDashboard?.[selectedRange]?.ecpm)}
                gradientBorder
              />
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold">Impresiones</h2>
            </div>
            {metricsLoading ? (
              <Skeleton className="h-24 rounded-lg" />
            ) : (
              <MetricCard
                title={PERIOD_LABELS[selectedRange]}
                value={fmtImpressions(mergedDashboard?.[selectedRange]?.impressions)}
                comparison={
                  selectedRange === "today"
                    ? null
                    : getMetricComparison(mergedDashboard?.[selectedRange], "impressions")
                }
                gradientBorder
              />
            )}
          </section>
        </div>
      ) : null}

      {activeTab === "domains" && (
        <div className="space-y-4">
          <SectionHeader title="Subdominios asignados" />
          {uniqueDomainList.length === 0 ? (
            <EmptyState
              title="Sin subdominios asignados"
              description="Contacta al administrador para habilitar tu acceso."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {uniqueDomainList.map((d) => (
                <Card key={d}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Subdominio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-semibold leading-snug break-words [overflow-wrap:anywhere]">
                      {d}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "payment" && (
        <div className="space-y-4">
          <SectionHeader
            title="Información de pago"
            description="Revisa tu estado y actualiza el método de pago."
            action={
              <Button type="button" onClick={openPaymentDialog}>
                {paymentInfo ? "Editar información" : "Agregar información"}
              </Button>
            }
          />

          {paymentInfo ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Método registrado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Tipo de método</p>
                  <p className="text-sm font-semibold">{paymentInfo.methodType}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Información</p>
                  <p className="text-sm font-semibold">{paymentInfo.paymentDetails}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              title="Información de pago pendiente"
              description="Aun no has agregado tu método de pago. Completa esta información para facilitar la gestión de tus pagos."
            />
          )}
        </div>
      )}

      {/* {activeTab === "payment-history" && (
        <div className="space-y-4">
          <SectionHeader
            title="Historial de pagos"
            description={`Período: ${paymentHistoryMonthLabel}`}
            action={
              <Select
                value={paymentHistoryMonth}
                onValueChange={(value) => onPaymentHistoryMonthChange?.(value)}
              >
                <SelectTrigger className="sm:w-56">
                  <SelectValue placeholder="Seleccionar período" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMonthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />

          {paymentHistoryRows.length === 0 ? (
            <EmptyState
              title="Sin pagos en este periodo"
              description="Cuando el administrador asigne subdominios o marque pagos, aparecera el historial aqui."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paymentHistoryRows.map((row) => (
                <Card key={`${row.domain}-${paymentHistoryMonth}`}>
                  <CardContent className="space-y-3 pt-6">
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Subdominio</p>
                      <p className="text-sm font-semibold leading-snug break-words [overflow-wrap:anywhere]">
                        {row.domain}
                      </p>
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <p className="shrink-0 text-xs text-muted-foreground">Impresiones</p>
                      <p className="min-w-0 text-right text-sm font-semibold tabular-nums">
                        {fmtImpressions(row.impressions)}
                      </p>
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <p className="shrink-0 text-xs text-muted-foreground">Ganancias</p>
                      <p className="min-w-0 text-right text-sm font-semibold tabular-nums">
                        {fmtCurrency(row.payout)}
                      </p>
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <p className="shrink-0 text-xs text-muted-foreground">Estado de pago</p>
                      <div className="min-w-0 shrink-0">
                        <StatusBadge
                          status={row.paymentStatus === "paid" ? "paid" : "pending"}
                          label={row.paymentStatus === "paid" ? "Pagado" : "Pendiente de pago"}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Card className="sm:col-span-2 lg:col-span-3">
                <CardContent className="space-y-3 pt-6 border-b border-purple-600 rounded">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-muted-foreground">Ganancia total</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {fmtCurrency(paymentHistoryTotalPayout)}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Espera a que Xervia te contacte via WhatsApp con los resultados totales del mes y te envie los pagos correspondientes.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )} */}

      <Dialog
        open={openPaymentModal}
        onOpenChange={(value) => (!value ? closePaymentDialog() : null)}
      >
        <DialogContent className="sm:max-w-lg border-border/60">
          <DialogHeader>
            <DialogTitle>Información de pago</DialogTitle>
            <DialogDescription>Agrega o actualiza tu método de pago.</DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleSavePaymentInfo}>
            <div className="space-y-2">
              <Label htmlFor="payment-method">Tipo de método de pago</Label>
              <Input
                id="payment-method"
                type="text"
                placeholder="Ej: PayPal, Nequi, Banco"
                value={paymentMethodType}
                onChange={(e) => setPaymentMethodType(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-details">Información de pago</Label>
              <Input
                id="payment-details"
                type="text"
                placeholder="Ej: correo, numero o cuenta"
                value={paymentDetails}
                onChange={(e) => setPaymentDetails(e.target.value)}
                required
              />
            </div>

            {paymentError && <p className="text-sm font-medium text-danger">{paymentError}</p>}

            <DialogFooter className="pt-2">
              <Button type="button" variant="secondary" onClick={closePaymentDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingPaymentInfo}>
                {savingPaymentInfo ? "Guardando…" : "Confirmar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* {hasDomains && (
        <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-2 shadow-xl backdrop-blur-xl supports-[backdrop-filter]:bg-card/70">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
                className={
                  "h-11 w-11 rounded-full flex items-center justify-center transition-colors " +
                  (isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground")
                }
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
                <span className="sr-only">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      )} */}
    </div>
  );
}
