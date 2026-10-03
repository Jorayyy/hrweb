import "../env";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "../src/db";
import { campaign, costCenter, department, employee, jobPosition, users } from "../src/db/schema";
import { hashPassword } from "../src/lib/password";

const DAY = 86400000;
const TODAY = "2026-10-04";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260104);
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const weighted = <T>(items: readonly (readonly [T, number])[]): T => {
  const total = items.reduce((sum, [, w]) => sum + w, 0);
  let roll = rand() * total;
  for (const [value, weight] of items) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return items[items.length - 1][0];
};

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (date: string, days: number) => iso(Date.parse(date) + days * DAY);
const randomDate = (from: string, to: string) =>
  iso(Date.parse(from) + Math.floor(rand() * ((Date.parse(to) - Date.parse(from)) / DAY + 1)) * DAY);
const clampDate = (date: string) => (date > TODAY ? TODAY : date);
const round500 = (value: number) => Math.round(value / 500) * 500;

const COST_CENTERS = [
  { code: "CC-OPS", name: "Operations" },
  { code: "CC-WFM", name: "Workforce Management" },
  { code: "CC-ADM", name: "Administration" },
  { code: "CC-TECH", name: "Technology" },
];

const CAMPAIGNS = [
  { code: "TELUS", name: "Telus Support", clientName: "Telus International", cc: "CC-OPS" },
  { code: "SPECTRUM", name: "Spectrum Retention", clientName: "Charter Communications", cc: "CC-OPS" },
  { code: "HSBC", name: "HSBC Card Services", clientName: "HSBC", cc: "CC-OPS" },
  { code: "GRAB", name: "Grab Driver Care", clientName: "Grab", cc: "CC-OPS" },
  { code: "SHOPEE", name: "Shopee Customer Care", clientName: "Shopee", cc: "CC-OPS" },
  { code: "CORP", name: "Corporate Functions", clientName: "Internal", cc: "CC-ADM" },
];

const POSITIONS = [
  { code: "CSR1", title: "Customer Service Associate", level: 1, managerial: false, min: 14000, max: 16500 },
  { code: "CSR2", title: "Senior Customer Service Associate", level: 2, managerial: false, min: 17000, max: 21000 },
  { code: "SME", title: "Subject Matter Expert", level: 2, managerial: false, min: 22000, max: 26000 },
  { code: "QA", title: "Quality Analyst", level: 2, managerial: false, min: 18000, max: 23000 },
  { code: "WFM", title: "Workforce Analyst", level: 2, managerial: false, min: 20000, max: 27000 },
  { code: "IT", title: "IT Support Specialist", level: 2, managerial: false, min: 22000, max: 30000 },
  { code: "HRA", title: "HR Associate", level: 2, managerial: false, min: 20000, max: 27000 },
  { code: "ACC", title: "Accounting Associate", level: 2, managerial: false, min: 21000, max: 28000 },
  { code: "TL", title: "Team Leader", level: 3, managerial: true, min: 32000, max: 39000 },
  { code: "OM", title: "Operations Manager", level: 4, managerial: true, min: 45000, max: 55000 },
  { code: "DIR", title: "Director", level: 5, managerial: true, min: 75000, max: 85000 },
];

const DEPARTMENTS = [
  { code: "SUP", name: "Customer Support", cc: "CC-OPS", headPos: "TL", staff: ["CSR1", "CSR2", "SME"], count: 42, ops: true },
  { code: "ESC", name: "Escalations", cc: "CC-OPS", headPos: "TL", staff: ["CSR2", "SME"], count: 20, ops: true },
  { code: "TS", name: "Technical Support", cc: "CC-OPS", headPos: "TL", staff: ["CSR1", "SME"], count: 20, ops: true },
  { code: "BO", name: "Back Office", cc: "CC-OPS", headPos: "TL", staff: ["CSR1", "CSR2"], count: 15, ops: true },
  { code: "WFM", name: "Workforce Management", cc: "CC-WFM", headPos: "OM", staff: ["WFM", "QA"], count: 8, ops: false },
  { code: "HR", name: "Human Resources", cc: "CC-ADM", headPos: "DIR", staff: ["HRA"], count: 7, ops: false },
  { code: "FIN", name: "Finance & Payroll", cc: "CC-ADM", headPos: "OM", staff: ["ACC"], count: 6, ops: false },
  { code: "INF", name: "Information Technology", cc: "CC-TECH", headPos: "OM", staff: ["IT"], count: 6, ops: false },
];

const FIRST_NAMES = [
  "Mark", "John", "Christian", "Joshua", "Angelo", "Ryan", "Patrick", "Kevin", "Miguel", "Gabriel",
  "Nathaniel", "Carl", "Vincent", "Jerome", "Adrian", "Paolo", "Dennis", "Harold", "Ivan", "Louie",
  "Maria", "Janna", "Kristine", "Angelica", "Rose", "Lovely", "Mariel", "Stephanie", "Grace", "Maureen",
  "Divine", "Hazel", "Patricia", "Nicole", "Camille", "Danica", "Rhona", "Joan", "Maricel", "Analyn",
  "Kimberly", "Trisha", "Abbygail", "Sheila", "Cora", "Lorna", "Emanuel", "Rogelio", "Aileen", "Bless",
];

const LAST_NAMES = [
  "Dela Cruz", "Reyes", "Santos", "Garcia", "Mendoza", "Bautista", "Villanueva", "Aquino", "Ramos",
  "Flores", "Gonzales", "Panganiban", "Tolentino", "Mercado", "Salazar", "Domingo", "Cabrera",
  "Ignacio", "Padilla", "Manalo", "Ortega", "Rosales", "Castillo", "Lopez", "Diaz", "Fernandez",
  "Hernandez", "Sarmiento", "Robles", "Tabuena", "Chua", "Tan", "Ong", "Lim", "Sy", "Yu", "Go",
  "Ang", "Cheng", "Abadilla",
];

const REST_DAY_PATTERNS = [[0], [0], [0], [6], [6], [0, 6], [5], [0, 3], [1], [0, 4]];
const RDO_CODES = ["029", "030", "031", "040", "049", "050", "093", "123", "241", "264"];
const OPS_CAMPAIGNS = CAMPAIGNS.filter((c) => c.cc === "CC-OPS");
const TAIL_STATUSES = [
  "ON_LEAVE", "SUSPENDED", "TERMINATED", "ON_LEAVE", "SUSPENDED",
  "TERMINATED", "ON_LEAVE", "AWOL", "TERMINATED", "ON_LEAVE",
] as const;
const TOTAL_EMPLOYEES = DEPARTMENTS.reduce((sum, d) => sum + d.count, 0);
const TAIL_START = TOTAL_EMPLOYEES - TAIL_STATUSES.length;
const SEED_EMPLOYEE_NO = /^E-\d{4}$/;

function digits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += Math.floor(rand() * 10);
  return out;
}

function tin(): string {
  return [digits(3), digits(3), digits(3), digits(3)].join("-");
}

function randomPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

async function main() {
  const seededNo = (await db
    .select({ employeeNo: employee.employeeNo, email: employee.email })
    .from(employee))
    .filter((r) => SEED_EMPLOYEE_NO.test(r.employeeNo) && r.email?.endsWith("@hrweb.test"))
    .map((r) => r.employeeNo);

  if (seededNo.length > 0) {
    await db.update(employee).set({ reportsToId: null }).where(inArray(employee.employeeNo, seededNo));
    await db.delete(employee).where(inArray(employee.employeeNo, seededNo));
  }

  await db.insert(costCenter).values(COST_CENTERS).onConflictDoNothing();
  const ccId = new Map((await db.select().from(costCenter)).map((r) => [r.code, r.id]));

  await db
    .insert(campaign)
    .values(
      CAMPAIGNS.map((c) => ({
        code: c.code,
        name: c.name,
        clientName: c.clientName,
        costCenterId: ccId.get(c.cc) as number,
      })),
    )
    .onConflictDoNothing();
  const campaignId = new Map((await db.select().from(campaign)).map((r) => [r.code, r.id]));

  await db
    .insert(department)
    .values(DEPARTMENTS.map((d) => ({ code: d.code, name: d.name, costCenterId: ccId.get(d.cc) as number })))
    .onConflictDoNothing();
  const departmentId = new Map((await db.select().from(department)).map((r) => [r.code, r.id]));

  await db
    .insert(jobPosition)
    .values(POSITIONS.map((p) => ({ code: p.code, title: p.title, jobLevel: p.level, isManagerial: p.managerial })))
    .onConflictDoNothing();
  const positionId = new Map((await db.select().from(jobPosition)).map((r) => [r.code, r.id]));
  const positionPay = new Map(POSITIONS.map((p) => [p.code, p]));

  const usedEmails = new Set<string>();
  const rows: (typeof employee.$inferInsert)[] = [];
  const departmentHeads = new Map<string, string>();
  let seq = 0;

  for (const dept of DEPARTMENTS) {
    for (let i = 0; i < dept.count; i++) {
      seq += 1;
      const isHead = i === 0;
      const posCode = isHead ? dept.headPos : pick(dept.staff);
      const pos = positionPay.get(posCode) as (typeof POSITIONS)[number];
      const salary = round500(between(pos.min, pos.max)) * 100;

      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const slug = `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, "");
      let email = `${slug}@hrweb.test`;
      let suffix = 1;
      while (usedEmails.has(email)) {
        suffix += 1;
        email = `${slug}${suffix}@hrweb.test`;
      }
      usedEmails.add(email);

      const employeeNo = `E-${String(seq).padStart(4, "0")}`;
      const status = (seq > TAIL_START
        ? TAIL_STATUSES[seq - TAIL_START - 1]
        : "ACTIVE") as (typeof employee.$inferInsert)["status"] & string;
      const isSeparated = status === "TERMINATED" || status === "AWOL";
      const dateHired = isSeparated
        ? randomDate("2019-01-01", "2026-01-01")
        : randomDate("2019-01-01", "2026-09-01");
      const employmentType =
        (Date.now() - Date.parse(dateHired)) / DAY < 180
          ? ("PROBATIONARY" as const)
          : weighted([
              ["REGULAR", 8],
              ["PROJECT", 1],
              ["AGENCY", 1],
            ] as const);

      rows.push({
        employeeNo,
        externalCode: String(100001 + seq),
        firstName,
        lastName,
        email,
        dateHired,
        dateRegularized:
          employmentType === "REGULAR" && dateHired <= "2026-04-01" ? addDays(dateHired, 180) : null,
        dateSeparated: isSeparated ? clampDate(addDays(dateHired, between(90, 1100))) : null,
        status,
        employmentType,
        payFrequency: weighted([
          ["SEMI_MONTHLY", 8],
          ["MONTHLY", 2],
          ["WEEKLY", 1],
        ] as const),
        campaignId: campaignId.get(dept.ops ? pick(OPS_CAMPAIGNS).code : "CORP") as number,
        departmentId: departmentId.get(dept.code) as number,
        costCenterId: ccId.get(dept.cc) as number,
        positionId: positionId.get(posCode) as number,
        baseSalaryMonthly: salary,
        tinNo: tin(),
        sssNo: digits(12),
        philhealthNo: digits(12),
        pagibigNo: digits(12),
        rdoCode: pick(RDO_CODES),
        isMinimumWageExempt: salary < 1600000,
        isManagerialTaxTbl: pos.managerial,
        weeklyRestDays: pick(REST_DAY_PATTERNS),
      });

      if (isHead) departmentHeads.set(dept.code, employeeNo);
    }
  }

  await db.insert(employee).values(rows).onConflictDoNothing();

  const byNo = new Map((await db.select().from(employee)).map((r) => [r.employeeNo, r]));
  const directorNo = departmentHeads.get("HR") as string;
  const director = byNo.get(directorNo);

  for (const headNo of departmentHeads.values()) {
    const head = byNo.get(headNo);
    if (!head) continue;
    const isDirector = headNo === directorNo;
    await db
      .update(employee)
      .set({ reportsToId: isDirector ? null : director?.id ?? null })
      .where(eq(employee.id, head.id));
    await db
      .update(employee)
      .set({ reportsToId: head.id })
      .where(and(eq(employee.departmentId, head.departmentId), ne(employee.id, head.id)));
  }

  const SEED_USERS = [
    { email: "hr@hrweb.local", name: "Rica Villanueva", role: "HR" as const },
    { email: "payroll@hrweb.local", name: "Lester Navarro", role: "PAYROLL" as const },
    { email: "agent@hrweb.local", name: "Joshua Bautista", role: "EMPLOYEE" as const },
  ];

  const existing = new Set((await db.select({ email: users.email }).from(users)).map((u) => u.email));
  const credentials: string[] = [];

  for (const u of SEED_USERS) {
    if (existing.has(u.email)) continue;
    const password = randomPassword();
    await db
      .insert(users)
      .values({ email: u.email, name: u.name, role: u.role, passwordHash: await hashPassword(password) })
      .onConflictDoNothing();
    credentials.push(`${u.email}  ${password}`);
  }

  console.log(
    [
      "seeded org:",
      `cost_center=${COST_CENTERS.length}`,
      `campaign=${CAMPAIGNS.length}`,
      `department=${DEPARTMENTS.length}`,
      `job_position=${POSITIONS.length}`,
      `employee=${rows.length}`,
      `users_created=${credentials.length}`,
    ].join(" "),
  );
  if (credentials.length > 0) {
    console.log("\nnew logins (passwords shown once):");
    for (const line of credentials) console.log(`  ${line}`);
    console.log("  admin@hrweb.local  (unchanged)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
