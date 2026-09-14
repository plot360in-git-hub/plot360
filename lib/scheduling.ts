// Business-day scheduling helpers for the customer app's "Schedule a
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

// A calendar day is selectable as a visit-window start when it's a weekday
// and at least EARLIEST_START_DAYS out from today.
export function isSelectable(date: Date, today: Date = new Date()): boolean {
  if (isWeekend(date)) return false;
  const earliest = atMidnight(today);
  earliest.setDate(earliest.getDate() + EARLIEST_START_DAYS);
  return atMidnight(date) >= earliest;
}

// Walks forward from `start`, counting only weekdays, and returns the date
// that completes a window of `lengthDays` working days (3, 5, or 7 per the
// design's window-length buttons). The start day itself counts as day 1.
export function endDate(start: Date, lengthDays: number): Date {
  const d = atMidnight(start);
  let counted = 1;
  while (counted < lengthDays) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) counted++;
  }
  return d;
}

export function toDateOnly(date: Date): string {
  return atMidnight(date).toISOString().slice(0, 10);
}

export function formatWindow(start: Date, end: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}
