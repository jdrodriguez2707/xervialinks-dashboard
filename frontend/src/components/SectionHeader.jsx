import React from "react";
import { cn } from "@/lib/utils";

export default function SectionHeader({ title, description, action, className }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? (
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          {action}
        </div>
      ) : null}
    </div>
  );
}
