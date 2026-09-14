// Redesign 2026-09 — admin console. Small pure helpers shared by every
// queue screen: "how long has this been waiting" formatting, the
// 24-hour lateness rule the design uses to redden a row, search
// filtering, and 20-rows-per-page pagination. Kept framework-free so
// it's trivial to unit-test and reuse from server actions and
// components alike.

export const LATE_HOURS = 24;
export const PAGE_SIZE = 20;

export function hoursSince(iso: string | null | undefined, now: Date = new Date()): number {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, (now.getTime() - then) / (1000 * 60 * 60));
}

export function formatWait(hours: number): string {
  if (hours < 24) return `${Math.floor(hours)}h`;
  const days = Math.floor(hours / 24);
  const rem = Math.floor(hours % 24);
  return `${days}d ${rem}h`;
}

export function isLate(hours: number): boolean {
  return hours > LATE_HOURS;
}

export function matchesQuery(haystack: (string | null | undefined)[], query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const text = haystack.filter(Boolean).join(' ').toLowerCase();
  return text.includes(q);
}

export function paginate<T>(rows: T[], page: number, pageSize = PAGE_SIZE): { rows: T[]; total: number; page: number; pageCount: number } {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total, page: safePage, pageCount };
}
