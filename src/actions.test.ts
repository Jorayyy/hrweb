import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function actionFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return actionFiles(path);
    return entry.name === "actions.ts" ? [path] : [];
  });
}

describe("server actions", () => {
  it('every actions.ts declares "use server" at the top', () => {
    const files = actionFiles(join(process.cwd(), "src"));
    expect(files.length).toBeGreaterThan(0);

    const missing = files.filter((file) => {
      const first = readFileSync(file, "utf8").split("\n").find((line) => line.trim() !== "");
      return first?.trim() !== '"use server";';
    });

    expect(missing).toEqual([]);
  });
});
