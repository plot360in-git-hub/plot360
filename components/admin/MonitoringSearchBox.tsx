'use client';

import { useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

// Redesign 2026-09 (follow-up, 2026-09-26) — search box for the Monitoring
// overview page (Plot: "admin should have an option to query and search
// for any customer or any property"). Same push-to-URL/debounce pattern
// as QueueControls.tsx's search field, kept as its own small component
// rather than reusing QueueControls directly since this page has no sort
// control — just one search box that filters across every section
// (Upcoming/Active/Completed) regardless of status.
export function MonitoringSearchBox({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set('q', value);
      else params.delete('q');
      router.push(`${pathname}?${params.toString()}`);
    }, 300);
  }

  return (
    <input
      className="input"
      style={{ minHeight: 36, width: 300, flex: 'none' }}
      placeholder={placeholder}
      defaultValue={query}
      onChange={(e) => onSearchChange(e.target.value)}
    />
  );
}
