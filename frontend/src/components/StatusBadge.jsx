import React from "react";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  paid: "bg-success/15 text-success",
  pending: "bg-warning/15 text-warning",
  inactive: "bg-muted text-muted-foreground",
};

export default function StatusBadge({ status = "pending", label, className }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        style,
        className,
      )}
    >
      {label}
    </span>
  );
}
