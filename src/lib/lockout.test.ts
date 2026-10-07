import { describe, expect, it, vi } from "vitest";
import { nextFailureState } from "@/lib/lockout";

vi.mock("@/db", () => ({ db: {} }));

const NOW = Date.parse("2026-10-07T08:00:00Z");

describe("nextFailureState", () => {
  it("counts up and locks once the attempt limit is reached", () => {
    expect(nextFailureState(null, NOW, 3, 15)).toEqual({
      failedCount: 1,
      lockedUntil: null,
    });
    expect(nextFailureState({ failedCount: 1, lockedUntil: null }, NOW, 3, 15)).toEqual({
      failedCount: 2,
      lockedUntil: null,
    });
    const locked = nextFailureState({ failedCount: 2, lockedUntil: null }, NOW, 3, 15);
    expect(locked.failedCount).toBe(3);
    expect(locked.lockedUntil?.getTime()).toBe(NOW + 15 * 60_000);
  });

  it("starts a fresh window once an old lock has expired", () => {
    const expired = new Date(NOW - 1000);
    expect(nextFailureState({ failedCount: 9, lockedUntil: expired }, NOW, 3, 15)).toEqual({
      failedCount: 1,
      lockedUntil: null,
    });
  });

  it("keeps an active lock while the count is still climbing", () => {
    const locked = new Date(NOW + 60_000);
    const next = nextFailureState({ failedCount: 3, lockedUntil: locked }, NOW, 5, 15);
    expect(next.failedCount).toBe(4);
    expect(next.lockedUntil).toBe(locked);
  });
});
