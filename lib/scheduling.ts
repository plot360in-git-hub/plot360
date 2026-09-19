// Business-week scheduling helpers for the customer app's "Schedule a
// visit" screen (design_handoff_plot360_redesign, "Plot360 Customer.dc.html").
// The design's own prototype hardcoded a September 2026 example month
// (`dow(d) => (new Date(2026,8,d).getDay()+6)%7`) — these are the same
// rules generalized to work off the real current date, so the calendar is
// correct whenever a customer actually opens the screen.

// "earliest start 3 days out" — today and the next 2 days are never
// selectable, matching the design's fixed lead time for lining up an agent.
export const EARLIEST_START_DAYS = 3;

export function isWeekend(date: Date): boolean {
  const day = date.getDay(); // 0 = Sunday .. 6 = Saturday
  return day === 0 || day === 6;
}

function atMidnight(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDateOnly(date: Date): string {
  return atMidnight(date).toISOString().slice(0, 10);
}

export function formatWindow(start: Date, end: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

// Monday on or after `date` (Monday itself if `date` already is one).
function mondayOnOrAfter(date: Date): Date {
  const d = atMidnight(date);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const daysToMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  d.setDate(d.getDate() + daysToMonday);
  return d;
}

// Monday of the calendar week containing `date` (on or BEFORE it) — used
// to lay out the calendar grid's leading "too soon" row, which always
// starts on the Monday of today's own week regardless of the lead time.
export function mondayOfWeekContaining(date: Date): Date {
  const d = atMidnight(date);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export type VisitWeek = { start: Date; end: Date; label: string };

// Redesign 2026-09 (follow-up, round 27) — Plot: replace the old "pick any
// weekday, then a 3/5/7-day window length" flow with a real calendar the
// customer picks a whole week from ("1st week", "2nd week", ...) instead of
// a free date range. The first week offered is the earliest whole calendar
// week that starts at or after the same EARLIEST_START_DAYS lead time the
// old day-picker enforced. That's a small, deliberate simplification
// versus the old per-day picker: if today's lead time lands mid-week (e.g.
// the 3-day minimum falls on a Thursday), the remaining Thu/Fri of that
// week is no longer offered on its own — the customer picks the next full
// week instead. Nothing downstream (requestVisit,
// monitoring_jobs.requested_window_start/end, the admin Job assignment
// queue, the agent app, the visit-report PDF) cares how a start/end date
// pair was chosen, only what the two dates are, so this is a UI-only
// change.
//
// Redesign 2026-09 (follow-up, round 28) — Plot: give the agent the whole
// week rather than stopping the window at Friday — "some agents may want
// to complete the job on Sat or Sun ... it also makes a week[']s time
// given for agent." The actual visit is still expected to typically happen
// on a weekday (isWeekend/the calendar's own weekend styling elsewhere
// still treat Mon–Fri as the primary days), but the saved window itself
// now runs the full Monday through Sunday of the chosen week, not just
// Monday through Friday, so an agent finishing late in the week has the
// weekend too before the job counts as overdue.
export function getSelectableWeeks(today: Date = new Date(), count = 4): VisitWeek[] {
  const earliest = atMidnight(today);
  earliest.setDate(earliest.getDate() + EARLIEST_START_DAYS);
  const firstMonday = mondayOnOrAfter(earliest);

  const weeks: VisitWeek[] = [];
  for (let i = 0; i < count; i++) {
    const start = new Date(firstMonday);
    start.setDate(start.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6); // Sunday of the same week
    weeks.push({ start, end, label: `Week ${i + 1}` });
  }
  return weeks;
}
