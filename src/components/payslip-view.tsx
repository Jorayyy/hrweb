import type { payrollRun, payrollRunItem } from "@/db/schema";
import { formatPhp } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Row = ({ label, value, muted }: { label: string; value: string; muted?: boolean }) => (
  <TableRow>
    <TableCell className={muted ? "text-muted-foreground" : undefined}>{label}</TableCell>
    <TableCell className="text-right tabular-nums">{value}</TableCell>
  </TableRow>
);

export type PayslipPerson = {
  employeeNo: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  positionTitle: string;
  campaignName: string;
  payFrequency: string;
  baseSalaryMonthly: number;
  tinNo: string | null;
  sssNo: string | null;
  philhealthNo: string | null;
  pagibigNo: string | null;
};

export function PayslipView({
  item,
  run,
  person,
}: {
  item: typeof payrollRunItem.$inferSelect;
  run: typeof payrollRun.$inferSelect;
  person: PayslipPerson;
}) {
  const otHours = item.hoursOtOrd + item.hoursOtRd + item.hoursOtSpecl + item.hoursOtRh + item.hoursOtRhRd;
  const employerTotal = item.sssEr + item.sssWispEr + item.phicEr + item.hdmfEr;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Employee</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="grid grid-cols-2 gap-y-2">
              <span className="text-muted-foreground">Employee no.</span>
              <span className="text-right">{person.employeeNo}</span>
              <span className="text-muted-foreground">Name</span>
              <span className="text-right">
                {person.lastName}, {person.firstName} {person.middleName ?? ""}
              </span>
              <span className="text-muted-foreground">Position</span>
              <span className="text-right">{person.positionTitle}</span>
              <span className="text-muted-foreground">Campaign</span>
              <span className="text-right">{person.campaignName}</span>
              <span className="text-muted-foreground">Pay frequency</span>
              <span className="text-right">{person.payFrequency}</span>
              <span className="text-muted-foreground">Monthly basic</span>
              <span className="text-right tabular-nums">{formatPhp(person.baseSalaryMonthly)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statutory numbers</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="grid grid-cols-2 gap-y-2">
              <span className="text-muted-foreground">SSS</span>
              <span className="text-right tabular-nums">{person.sssNo ?? "—"}</span>
              <span className="text-muted-foreground">PhilHealth</span>
              <span className="text-right tabular-nums">{person.philhealthNo ?? "—"}</span>
              <span className="text-muted-foreground">Pag-IBIG</span>
              <span className="text-right tabular-nums">{person.pagibigNo ?? "—"}</span>
              <span className="text-muted-foreground">TIN</span>
              <span className="text-right tabular-nums">{person.tinNo ?? "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <Row label="Basic pay" value={formatPhp(item.basicPay)} />
                <Row label="Holiday pay" value={formatPhp(item.holidayPay)} />
                <Row label="Rest-day pay" value={formatPhp(item.restDayPay)} />
                <Row label={`Overtime (${otHours.toFixed(2)} h)`} value={formatPhp(item.otPay)} />
                <Row
                  label={`Night differential (${item.hoursNsd.toFixed(2)} h)`}
                  value={formatPhp(item.nsdPay)}
                />
                <Row label="Allowances / other" value={formatPhp(item.otherEarnings)} />
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Gross pay</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPhp(item.grossPay)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deductions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <Row label="SSS (EE)" value={formatPhp(item.sssEe)} />
                <Row label="SSS WISP (EE)" value={formatPhp(item.sssWispEe)} />
                <Row label="PhilHealth (EE)" value={formatPhp(item.phicEe)} />
                <Row label="Pag-IBIG (EE)" value={formatPhp(item.hdmfEe)} />
                <Row label="Withholding tax" value={formatPhp(item.birTax)} />
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total deductions</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPhp(item.totalDeductions)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex flex-col items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-4 sm:flex-row">
        <span className="text-sm font-medium">Net pay</span>
        <span className="text-2xl font-semibold tabular-nums">{formatPhp(item.netPay)}</span>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Employer contributions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <Row label="SSS (ER)" value={formatPhp(item.sssEr)} muted />
              <Row label="SSS WISP (ER)" value={formatPhp(item.sssWispEr)} muted />
              <Row label="PhilHealth (ER)" value={formatPhp(item.phicEr)} muted />
              <Row label="Pag-IBIG (ER)" value={formatPhp(item.hdmfEr)} muted />
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total employer</TableCell>
                <TableCell className="text-right tabular-nums">{formatPhp(employerTotal)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Engine {item.calcEngineVer} · {item.calcAt.toISOString().slice(0, 16).replace("T", " ")}{" "}
        UTC · payrule {run.payruleVersion} · taxable pay {formatPhp(item.taxablePay)}
      </p>
    </>
  );
}
