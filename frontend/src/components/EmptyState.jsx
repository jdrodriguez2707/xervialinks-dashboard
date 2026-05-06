import React from "react";
import { cn } from "@/lib/utils";

export default function EmptyState({ title, description, action, className }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border bg-card/40 p-6 text-center",
        className,
      )}
    >
      <p className="text-base font-semibold">{title}</p>
      {description ? <p className="text-sm text-muted-foreground mt-2">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
