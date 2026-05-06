import React from "react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export default function DataTable({ columns, rows, renderRow, footer, className }) {
  return (
    <div className={cn("w-full overflow-x-auto rounded-lg border border-border bg-card", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col}>{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(renderRow)}
          {typeof footer === "function" ? footer() : null}
        </TableBody>
      </Table>
    </div>
  );
}
