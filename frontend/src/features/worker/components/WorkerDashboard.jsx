import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import EmptyState from "@/components/EmptyState";
import DataTable from "@/components/DataTable";
import { TableCell, TableRow } from "@/components/ui/table";

const PERIODS = ["today", "yesterday", "last7Days", "currentMonth"];

const PERIOD_LABELS = {
  today: "Hoy",
  yesterday: "Ayer",
  last7Days: "Últimos 7 días",
  currentMonth: "Este mes",
};

const COMPARISON_PERIOD_LABELS = {
  yesterday: "vs. mismo día de la semana pasada",
  last7Days: "vs. los 7 días anteriores",
  currentMonth: "vs. mismo periodo del mes pasado",
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

const formatDailyDate = (date) => {
  if (!date) return "";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
};

function getMetricComparison(periodData, metric) {
  const change = periodData?.comparison?.[metric];
  if (change == null) return { direction: "neutral" };

  if (change > 100) {
    return { direction: "up", capped: true };
  }

  return {
    direction: change > 0 ? "up" : "down",
    value: `${Math.abs(change).toFixed(1)}%`,
  };
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
  dailyStatsEnabled,
  workerMetrics,
  selectedDomain,
  onDomainChange,
  contextLoading,
  metricsLoading,
  metricsError,
  error,
}) {
  const [selectedRange, setSelectedRange] = useState("today");
  const [showDailyStats, setShowDailyStats] = useState(false);
  const [dailyStatsSortOrder, setDailyStatsSortOrder] = useState("desc");

  const mergedDashboard = useMemo(() => {
    if (!workerContext && !workerMetrics) return null;
    return {
      ...(workerMetrics || {}),
      properties: workerContext?.properties ?? [],
    };
  }, [workerContext, workerMetrics]);

  const sortedDailyStats = useMemo(() => {
    const rows = [...(mergedDashboard?.dailyStats || [])];
    return rows.sort((a, b) => {
      const dateOrder = String(a.date).localeCompare(String(b.date));
      return dailyStatsSortOrder === "asc" ? dateOrder : -dateOrder;
    });
  }, [mergedDashboard?.dailyStats, dailyStatsSortOrder]);

  useEffect(() => {
    if (!dailyStatsEnabled) setShowDailyStats(false);
  }, [dailyStatsEnabled]);

  const { properties = [] } = workerContext ?? {};
  const domainProps = properties.filter((p) => p.type === "domain");
  const uniqueDomainList = useMemo(
    () => [...new Set(domainProps.map((p) => String(p.value || "").trim()).filter(Boolean))],
    [domainProps],
  );
  const hasDomains = uniqueDomainList.length > 0;
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

  return (
    <div className="space-y-6 pb-16">
      <Dialog open={showDailyStats} onOpenChange={setShowDailyStats}>
        <DialogContent
          id="worker-daily-stats-table"
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="left-0 top-0 flex h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 px-[10px] py-0 duration-150 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 data-[state=open]:zoom-in-100 data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=closed]:zoom-out-100"
        >
          <DialogHeader className="shrink-0 border-b border-border px-0 py-6 sm:py-4">
            <DialogTitle>Este mes</DialogTitle>
            <DialogDescription>
              Estadísticas diarias desde el 1 de este mes hasta ayer.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {metricsLoading ? (
              <div className="p-4 sm:p-6">
                <Skeleton className="h-52 rounded-lg" />
              </div>
            ) : (
              <>
                <div className="flex justify-center gap-1 px-2 py-2" aria-label="Ordenar fechas">
                  <Button
                    type="button"
                    variant={dailyStatsSortOrder === "asc" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Orden ascendente: del día más antiguo al más reciente"
                    aria-pressed={dailyStatsSortOrder === "asc"}
                    title="Del día más antiguo al más reciente"
                    onClick={() => setDailyStatsSortOrder("asc")}
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant={dailyStatsSortOrder === "desc" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Orden descendente: del día más reciente al más antiguo"
                    aria-pressed={dailyStatsSortOrder === "desc"}
                    title="Del día más reciente al más antiguo"
                    onClick={() => setDailyStatsSortOrder("desc")}
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                </div>
                <DataTable
                  className="min-w-[360px] rounded-none border-x-0 border-b-0 text-xs sm:min-w-full sm:text-sm [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-card [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap [&_th]:px-1 [&_td]:px-1 [&_th]:py-2 [&_td]:py-2.5 [&_th:nth-child(1)]:w-[80px] [&_td:nth-child(1)]:w-[80px] [&_th:nth-child(2)]:w-[92px] [&_td:nth-child(2)]:w-[92px] [&_th:nth-child(3)]:w-[104px] [&_td:nth-child(3)]:w-[104px] [&_th:nth-child(4)]:w-[84px] [&_td:nth-child(4)]:w-[84px] sm:[&_th]:px-4 sm:[&_td]:p-4 sm:[&_th:nth-child(n)]:w-auto sm:[&_td:nth-child(n)]:w-auto"
                  columns={["Fecha", "Ingresos est.", "Impresiones", "eCPM"]}
                  rows={sortedDailyStats}
                  renderRow={(row) => (
                    <TableRow key={row.date}>
                      <TableCell className="font-medium">{formatDailyDate(row.date)}</TableCell>
                      <TableCell className="tabular-nums">
                        {fmtCurrency(row.revenue)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {fmtImpressions(row.impressions)}
                      </TableCell>
                      <TableCell className="tabular-nums">{fmtEcpm(row.ecpm)}</TableCell>
                    </TableRow>
                  )}
                />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {!hasDomains ? (
        <EmptyState
          title="Panel no disponible aun"
          description="Tu cuenta no tiene subdominios asignados. Una vez que el administrador configure tu acceso, aqui veras tus ingresos, eCPM e impresiones en tiempo real."
        />
      ) : (
        <div className="space-y-4">
          {hasDomains && (
            <div className="flex justify-start">
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
          {dailyStatsEnabled && (
            <div className="flex justify-start">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowDailyStats(true)}
                aria-expanded={showDailyStats}
                aria-controls="worker-daily-stats-table"
              >
                Mostrar más estadísticas
              </Button>
            </div>
          )}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Ingresos estimados</h2>
                <p className="text-xs text-muted-foreground">
                  Cifras estimadas; pueden ajustarse.
                </p>
              </div>
            </div>
            {metricsLoading ? (
              <SkeletonCards count={4} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                    comparisonPeriodLabel={COMPARISON_PERIOD_LABELS[period]}
                    active={period === "currentMonth"}
                    gradientBorder
                  />
                ))}
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
                comparisonPeriodLabel={COMPARISON_PERIOD_LABELS[selectedRange]}
                gradientBorder
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
