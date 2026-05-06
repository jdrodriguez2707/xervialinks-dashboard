import { useEffect, useMemo, useState } from "react";
import { BarChart3, Globe, CreditCard, CircleDollarSign } from "lucide-react";
import { upsertWorkerPaymentInfo } from "../../../shared/api/worker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
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
import { MetricCard } from "@/components/MetricCard";
import SectionHeader from "@/components/SectionHeader";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";

const PERIODS = ["today", "yesterday", "last7Days", "currentMonth"];

const PERIOD_LABELS = {
  today:        "Hoy",
  yesterday:    "Ayer",
  last7Days:    "Últimos 7 días",
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

const fmtImpressions = (n) =>
  new Intl.NumberFormat("es-MX").format(n ?? 0);

const WORKER_TAB_STORAGE_PREFIX = "workerDashboardActiveTab";

function getWorkerTabStorageKey(workerId) {
  return `${WORKER_TAB_STORAGE_PREFIX}:${workerId || "unknown"}`;
}

function SkeletonCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {PERIODS.map((p) => (
        <Skeleton key={p} className="h-24 rounded-lg" />
      ))}
    </div>
  );
}

function MetricSection({ title, loading, data, getValue, format, highlight }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {loading ? (
        <SkeletonCards />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PERIODS.map((period) => (
            <MetricCard
              key={period}
              title={PERIOD_LABELS[period]}
              value={format(getValue(data, period))}
              active={period === "currentMonth" && highlight}
            />
          ))}
        </div>
      )}
    </section>
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
  syncStatusLabel,
  onContextRefresh,
  workerId,
  paymentMonth,
  onPaymentMonthChange,
  paymentHistoryMonth,
  onPaymentHistoryMonthChange,
}) {
  const [activeTab, setActiveTab] = useState("stats");
  const [selectedRange, setSelectedRange] = useState("today");
  const [paymentInfo, setPaymentInfo] = useState(
    () => workerContext?.paymentInfo ?? null
  );

  const mergedDashboard = useMemo(() => {
    if (!workerContext && !workerMetrics) return null;
    return {
      ...(workerMetrics || {}),
      properties: workerContext?.properties ?? [],
      paymentInfo: workerContext?.paymentInfo ?? null,
    };
  }, [workerContext, workerMetrics]);

  const tabs = useMemo(
    () => [
      { id: "stats", label: "Estadísticas", icon: BarChart3 },
      { id: "domains", label: "Subdominios", icon: Globe },
      { id: "payment", label: "Pago", icon: CreditCard },
      { id: "payment-history", label: "Historial de pagos", icon: CircleDollarSign },
    ],
    []
  );

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
  const domains = properties.filter((p) => p.type === "domain");
  const hasDomains = domains.length > 0;
  const paymentStatus = workerContext?.paymentStatus || "pending";
  const paymentStatusLabel =
    paymentStatus === "paid" ? "Pagado" : "Pendiente de pago";
  const paymentMonthOptions = useMemo(() => buildPaymentMonthOptions(), []);
  const paymentMonthLabel = formatPaymentMonthLabel(paymentMonth);
  const paymentHistoryMonthLabel = formatPaymentMonthLabel(paymentHistoryMonth);
  const paymentHistoryRows = workerPaymentHistory?.rows || [];
  const selectedDomainValue =
    selectedDomain && domains.some((d) => d.value === selectedDomain)
      ? selectedDomain
      : domains[0]?.value || "";
  const otherDomains = domains.filter((d) => d.value !== selectedDomainValue);
  const canSwitchDomain = otherDomains.length > 0;

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
      setPaymentError(err.message || "No se pudo guardar la información de pago");
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
          {syncStatusLabel ? (
            <div className="text-center text-xs text-muted-foreground">
              {syncStatusLabel}
            </div>
          ) : null}
          {hasDomains && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Select
                value={selectedDomainValue}
                onValueChange={handleDomainSwitch}
                disabled={!canSwitchDomain}
              >
                <SelectTrigger className="sm:w-72">
                  <SelectValue placeholder="Seleccionar subdominio" />
                </SelectTrigger>
                <SelectContent>
                  {domains.map((domain) => (
                    <SelectItem key={domain.id} value={domain.value}>
                      {domain.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!canSwitchDomain && (
                <p className="text-xs text-muted-foreground">Solo tienes un subdominio asignado.</p>
              )}
            </div>
          )}
          {metricsError && (
            <p className="status-msg error" role="alert">
              {metricsError}
            </p>
          )}
          <MetricSection
            title="Ingresos estimados"
            loading={metricsLoading}
            data={mergedDashboard}
            getValue={(d, period) => d?.[period]?.revenue}
            format={fmtCurrency}
            highlight
          />

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
              />
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold">Impresiones</h2>
            {metricsLoading ? (
              <Skeleton className="h-24 rounded-lg" />
            ) : (
              <MetricCard
                title={PERIOD_LABELS[selectedRange]}
                value={fmtImpressions(mergedDashboard?.[selectedRange]?.impressions)}
              />
            )}
          </section>
        </div>
      ) : null}

      {activeTab === "domains" && (
        <div className="space-y-4">
          <SectionHeader title="Subdominios asignados" />
          {domains.length === 0 ? (
            <EmptyState
              title="Sin subdominios asignados"
              description="Contacta al administrador para habilitar tu acceso."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {domains.map((domain) => (
                <Card key={domain.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Subdominio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-semibold">{domain.value}</p>
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
            title="Informacion de pago"
            description="Revisa tu estado y actualiza el metodo de pago."
            action={
              <Button type="button" onClick={openPaymentDialog}>
                {paymentInfo ? "Editar informacion" : "Agregar informacion"}
              </Button>
            }
          />

          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-medium">Periodo de pago: {paymentMonthLabel}</span>
                <Select value={paymentMonth} onValueChange={(value) => onPaymentMonthChange?.(value)}>
                  <SelectTrigger className="sm:w-56">
                    <SelectValue placeholder="Seleccionar periodo" />
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

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estado de pago</span>
                <StatusBadge
                  status={paymentStatus === "paid" ? "paid" : "pending"}
                  label={paymentStatusLabel}
                />
              </div>
            </CardContent>
          </Card>

          {paymentInfo ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Metodo registrado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Tipo de metodo</p>
                  <p className="text-sm font-semibold">{paymentInfo.methodType}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Informacion</p>
                  <p className="text-sm font-semibold">{paymentInfo.paymentDetails}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              title="Informacion de pago pendiente"
              description="Aun no has agregado tu metodo de pago. Completa esta informacion para facilitar la gestion de tus pagos."
              action={
                <Button type="button" onClick={openPaymentDialog}>
                  Agregar informacion de pago
                </Button>
              }
            />
          )}
        </div>
      )}

      {activeTab === "payment-history" && (
        <div className="space-y-4">
          <SectionHeader
            title="Historial de pagos"
            action={
              <Select value={paymentHistoryMonth} onValueChange={(value) => onPaymentHistoryMonthChange?.(value)}>
                <SelectTrigger className="sm:w-56">
                  <SelectValue placeholder="Seleccionar periodo" />
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
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Subdominio</p>
                      <p className="text-sm font-semibold">{row.domain}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Impresiones</p>
                      <p className="text-sm font-semibold tabular-nums">{fmtImpressions(row.impressions)}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Ganancias</p>
                      <p className="text-sm font-semibold tabular-nums">{fmtCurrency(row.payout)}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Estado de pago</p>
                      <StatusBadge
                        status={row.paymentStatus === "paid" ? "paid" : "pending"}
                        label={row.paymentStatus === "paid" ? "Pagado" : "Pendiente de pago"}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Card className="sm:col-span-2 lg:col-span-3">
                <CardContent className="flex items-center justify-between pt-6">
                  <p className="text-sm font-semibold text-muted-foreground">Ganancia total</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {fmtCurrency(paymentHistoryRows.reduce((sum, r) => sum + (r.payout || 0), 0))}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      <Dialog open={openPaymentModal} onOpenChange={(value) => (!value ? closePaymentDialog() : null)}>
        <DialogContent className="sm:max-w-lg border-border/60">
          <DialogHeader>
            <DialogTitle>Informacion de pago</DialogTitle>
            <DialogDescription>Agrega o actualiza tu metodo de pago.</DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleSavePaymentInfo}>
            <div className="space-y-2">
              <Label htmlFor="payment-method">Tipo de metodo de pago</Label>
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
              <Label htmlFor="payment-details">Informacion de pago</Label>
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

      {hasDomains && (
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
      )}
    </div>
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
