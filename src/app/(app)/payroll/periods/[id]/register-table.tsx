"use client";

import { Fragment, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = {
  employeeId: number;
  campaignId: number;
  name: string;
  employeeNo: string;
  days: number;
  abs: number;
  ot: string;
  nsd: string;
  gross: string;
  ded: string;
  net: string;
};

export type RegisterGroup = {
  campaignId: number;
  name: string;
  n: number;
  gross: string;
  ded: string;
  net: string;
};

export function RegisterTable({
  rows,
  groups,
  footer,
  runId,
}: {
  rows: Row[];
  groups: RegisterGroup[];
  footer: { label: string; gross: string; ded: string; net: string } | null;
  runId: number;
}) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const byCampaign = new Map<number, Row[]>();
  for (const r of rows) {
    const list = byCampaign.get(r.campaignId);
    if (list) list.push(r);
    else byCampaign.set(r.campaignId, [r]);
  }
  const visible = groups.filter((g) => byCampaign.has(g.campaignId));

  return (
    <Table containerClassName="max-h-[70vh] overflow-y-auto rounded-lg border">
      <TableHeader className="sticky top-0 z-10">
        <TableRow className="hover:bg-transparent">
          <TableHead className="bg-background">Employee</TableHead>
          <TableHead className="bg-background text-right">Days</TableHead>
          <TableHead className="bg-background text-right">Abs</TableHead>
          <TableHead className="bg-background text-right">OT h</TableHead>
          <TableHead className="bg-background text-right">NSD h</TableHead>
          <TableHead className="bg-background text-right">Gross</TableHead>
          <TableHead className="bg-background text-right">Deductions</TableHead>
          <TableHead className="bg-background text-right">Net pay</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visible.map((g) => {
          const isCollapsed = collapsed.has(g.campaignId);
          const groupRows = byCampaign.get(g.campaignId) ?? [];
          return (
            <Fragment key={g.campaignId}>
              <TableRow
                onClick={() => toggle(g.campaignId)}
                className="cursor-pointer bg-muted/40 hover:bg-muted/60"
              >
                <TableCell colSpan={5} className="font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {isCollapsed ? (
                      <ChevronRightIcon className="size-3.5" />
                    ) : (
                      <ChevronDownIcon className="size-3.5" />
                    )}
                    {g.name}
                    <span className="font-normal text-muted-foreground">
                      · {g.n} employee{g.n === 1 ? "" : "s"}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{g.gross}</TableCell>
                <TableCell className="text-right tabular-nums">{g.ded}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{g.net}</TableCell>
              </TableRow>
              {isCollapsed
                ? null
                : groupRows.map((r) => (
                    <TableRow key={r.employeeId}>
                      <TableCell>
                        <a
                          href={`/payroll/payslips/${runId}/${r.employeeId}`}
                          className="hover:underline"
                        >
                          <span className="block font-medium">{r.name}</span>
                          <span className="block text-xs text-muted-foreground">{r.employeeNo}</span>
                        </a>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.days}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.abs}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.ot}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.nsd}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.gross}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.ded}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{r.net}</TableCell>
                    </TableRow>
                  ))}
            </Fragment>
          );
        })}
      </TableBody>
      {footer ? (
        <TableFooter className="sticky bottom-0 z-10 bg-muted">
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={5}>{footer.label}</TableCell>
            <TableCell className="text-right tabular-nums">{footer.gross}</TableCell>
            <TableCell className="text-right tabular-nums">{footer.ded}</TableCell>
            <TableCell className="text-right tabular-nums">{footer.net}</TableCell>
          </TableRow>
        </TableFooter>
      ) : null}
    </Table>
  );
}
