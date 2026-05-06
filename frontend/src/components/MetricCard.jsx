import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function MetricCard({ title, value, subtitle, icon: Icon, loading = false, active = false, onClick }) {
  return (
    <Card 
      onClick={onClick}
      className={cn(
        "transition-all duration-200 cursor-pointer overflow-hidden relative group",
        active ? "border-primary ring-1 ring-primary shadow-lg shadow-primary/10" : "hover:border-primary/50",
        !onClick && "cursor-default"
      )}
    >
      {active && (
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary" />
      )}
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
            <div className={cn("text-2xl font-bold tabular-nums tracking-tight", active && "bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent")}>
              {value}
            </div>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
