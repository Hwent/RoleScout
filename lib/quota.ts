type WindowName = "minute" | "day" | "week" | "month";
type WindowCounter = { startsAt: number; count: number };

const limits: Record<WindowName, { max: number; durationMs: number }> = {
  minute: { max: 25, durationMs: 60_000 },
  day: { max: 250, durationMs: 24 * 60 * 60_000 },
  week: { max: 1000, durationMs: 7 * 24 * 60 * 60_000 },
  month: { max: 2500, durationMs: 30 * 24 * 60 * 60_000 },
};

const counters = new Map<WindowName, WindowCounter>();

export class ApiLimitError extends Error {
  constructor(message: string, readonly retryAfterSeconds: number) {
    super(message);
    this.name = "ApiLimitError";
  }
}

/** Process-local guard for the first, single-instance deployment. */
export function reserveAdzunaRequest(now = Date.now()) {
  const current: Partial<Record<WindowName, WindowCounter>> = {};
  for (const name of Object.keys(limits) as WindowName[]) {
    const setting = limits[name];
    const old = counters.get(name);
    current[name] = !old || now - old.startsAt >= setting.durationMs ? { startsAt: now, count: 0 } : old;
    if (current[name]!.count >= setting.max) {
      const remainingMs = setting.durationMs - (now - current[name]!.startsAt);
      throw new ApiLimitError("Search quota is temporarily used up. Please try again later.", Math.max(1, Math.ceil(remainingMs / 1000)));
    }
  }
  for (const name of Object.keys(limits) as WindowName[]) {
    const value = current[name]!;
    counters.set(name, { ...value, count: value.count + 1 });
  }
}
