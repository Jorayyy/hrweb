import "../env";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import {
  allowanceType,
  birTaxTable,
  holidayCalendar,
  hdmfSchedule,
  phicSchedule,
  premiumMatrix,
  sssSchedule,
} from "../src/db/schema";
import {
  ALLOWANCE_TYPES_2026,
  BIR_ANNUAL_2026,
  DOLE,
  HDMF_2026,
  HOLIDAYS_2026,
  PHIC_2026,
  PREMIUM_MATRIX_2026,
  PROCLAMATION_1006,
  SSS_2026,
} from "../src/lib/statutory/ph";

const EFFECTIVE = "2026-01-01";
const BIR_SOURCE = "NIRC §24 as amended by RA 10963 (TRAIN); BIR Rev. Reg. 11-2018";

async function main() {
  await db.delete(sssSchedule);
  await db.insert(sssSchedule).values({
    effectiveFrom: SSS_2026.effectiveFrom,
    totalRate: SSS_2026.totalRate,
    eeRate: SSS_2026.eeRate,
    erRate: SSS_2026.erRate,
    mscMin: SSS_2026.mscMin,
    mscMax: SSS_2026.mscMax,
    mscStep: SSS_2026.mscStep,
    wispThreshold: SSS_2026.wispThreshold,
    ecThreshold: SSS_2026.ecThreshold,
    ecAmountLow: SSS_2026.ecAmountLow,
    ecAmountHigh: SSS_2026.ecAmountHigh,
    sourceRef: SSS_2026.sourceRef,
  });

  await db.delete(phicSchedule).where(eq(phicSchedule.effectiveFrom, PHIC_2026.effectiveFrom));
  await db.insert(phicSchedule).values({
    effectiveFrom: PHIC_2026.effectiveFrom,
    premiumRate: PHIC_2026.premiumRate,
    baseFloor: PHIC_2026.baseFloor,
    baseCeiling: PHIC_2026.baseCeiling,
    eeShare: PHIC_2026.eeShare,
    erShare: PHIC_2026.erShare,
    sourceRef: PHIC_2026.sourceRef,
  });

  await db.delete(hdmfSchedule).where(eq(hdmfSchedule.effectiveFrom, HDMF_2026.effectiveFrom));
  await db.insert(hdmfSchedule).values({
    effectiveFrom: HDMF_2026.effectiveFrom,
    eeRate: HDMF_2026.eeRate,
    erRate: HDMF_2026.erRate,
    compCeiling: HDMF_2026.compCeiling,
    maxContribution: HDMF_2026.maxContribution,
    sourceRef: HDMF_2026.sourceRef,
  });

  await db.delete(birTaxTable).where(eq(birTaxTable.effectiveFrom, EFFECTIVE));
  await db.insert(birTaxTable).values(
    BIR_ANNUAL_2026.map((b) => ({
      effectiveFrom: EFFECTIVE,
      variant: "NON_MANAGERIAL" as const,
      bracketNo: b.bracketNo,
      bracketFrom: b.bracketFrom,
      bracketTo: b.bracketTo,
      baseTax: b.baseTax,
      marginalRate: b.marginalRate,
      overAmount: b.overAmount,
      sourceRef: BIR_SOURCE,
    })),
  );

  await db.delete(premiumMatrix).where(eq(premiumMatrix.effectiveFrom, EFFECTIVE));
  await db.insert(premiumMatrix).values(
    PREMIUM_MATRIX_2026.map((r) => ({
      effectiveFrom: EFFECTIVE,
      holidayKind: r.holidayKind,
      isRestDay: r.isRestDay,
      worked: r.worked,
      first8hMultiplier: r.first8hMultiplier,
      otHourMultiplier: r.otHourMultiplier,
      nsdApplies: r.nsdApplies,
      payWhenUnworked: r.payWhenUnworked,
      sourceRef: DOLE,
    })),
  );

  await db.delete(holidayCalendar).where(eq(holidayCalendar.effectiveYear, 2026));
  await db.insert(holidayCalendar).values(
    HOLIDAYS_2026.map((h) => ({
      holidayDate: h.date,
      kind: h.kind,
      name: h.name,
      proclamation: PROCLAMATION_1006,
      effectiveYear: 2026,
    })),
  );

  await db
    .delete(allowanceType)
    .where(inArray(allowanceType.code, ALLOWANCE_TYPES_2026.map((a) => a.code)));
  await db.insert(allowanceType).values([...ALLOWANCE_TYPES_2026]);

  console.log(
    [
      "seeded:",
      "sss_schedule=1",
      "phic_schedule=1",
      "hdmf_schedule=1",
      `bir_tax_table=${BIR_ANNUAL_2026.length}`,
      `premium_matrix=${PREMIUM_MATRIX_2026.length}`,
      `holiday_calendar=${HOLIDAYS_2026.length}`,
      `allowance_type=${ALLOWANCE_TYPES_2026.length}`,
    ].join(" "),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
