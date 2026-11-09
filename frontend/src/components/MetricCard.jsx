import React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  loading = false,
  active = false,
  gradientBorder = false,
  onClick,
  cornerBadge = null,
  comparison = null,
}) {
  const ComparisonIcon =
    comparison?.direction === "up"
      ? ArrowUpRight
      : comparison?.direction === "down"
        ? ArrowDownRight
        : Minus;
  const comparisonColor =
    comparison?.direction === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : comparison?.direction === "down"
        ? "text-rose-600 dark:text-rose-400"
        : "text-muted-foreground";
  const comparisonLabel = comparison?.capped
    ? ">100%"
    : comparison?.direction === "up"
      ? `+${comparison.value}`
      : comparison?.direction === "down"
        ? `−${comparison.value}`
        : "—";
  const comparisonAriaLabel = comparison?.capped
    ? "Aumentó más de 100% frente al periodo anterior"
    : comparison?.direction === "up"
      ? `Aumentó ${comparison.value} frente al periodo anterior`
      : comparison?.direction === "down"
        ? `Disminuyó ${comparison.value} frente al periodo anterior`
        : "Sin cambio o base de comparación disponible";

  return (
    <Card
      onClick={onClick}
      className={cn(
        "transition-all duration-200 cursor-pointer overflow-hidden relative group",
        cornerBadge && "pt-5",
        active || gradientBorder
          ? "metric-card-active shadow-lg shadow-primary/10"
          : "hover:border-primary/50",
        !onClick && "cursor-default",
      )}
    >
      {cornerBadge ? (
        <span className="absolute left-3 top-3 z-10 rounded-md bg-muted/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border border-border/60">
          {cornerBadge}
        </span>
      ) : null}
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && <Icon className={cn("w-4 h-4 text-muted-foreground", active && "text-primary")} />}
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-8 w-24 mb-2" />
            <Skeleton className="h-3 w-32" />
          </>
        ) : (
          <>
            <div
              className={cn(
                "text-2xl font-bold tabular-nums tracking-tight",
                active &&
                  "bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent",
              )}
            >
              {value}
            </div>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            {comparison && (
              <div
                className={cn("mt-2 flex items-center gap-1 text-xs font-medium", comparisonColor)}
                aria-label={comparisonAriaLabel}
              >
                <ComparisonIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{comparisonLabel}</span>
                {comparison.direction !== "neutral" && (
                  <span className="font-normal text-muted-foreground">vs. periodo anterior</span>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
