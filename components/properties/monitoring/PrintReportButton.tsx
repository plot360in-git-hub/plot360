'use client';

export function PrintReportButton() {
  return (
    <button
      type="button"
      className="btn-primary"
      onClick={() => window.print()}
      style={{ marginBottom: 24 }}
    >
      Print / Save as PDF
    </button>
  );
}
