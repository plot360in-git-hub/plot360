'use client';

import { useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

// Redesign 2026-09 — admin console. Search box + sort segmented control
// shared by all six queue screens — pushes query/sort into the URL so
// the search stays server-rendered and shareable/bookmarkable, matching
// the "no bulk actions, every item is opened and reviewed" simplicity
// the design calls for.
export function QueueControls({
  searchPlaceholder,
  sorts,
}: {
  searchPlaceholder: string;
  sorts: { key: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const activeSort = searchParams.get('sort') ?? sorts[0]?.key ?? '';
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  function onSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushParams({ q: value }), 300);
  }

  return (
    <>
      <input
        className="input"
        style={{ minHeight: 36, width: 230, flex: 'none' }}
        placeholder={searchPlaceholder}
        defaultValue={query}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 16, border: '1px solid var(--color-divider)', width: 'max-content' }}>
        {sorts.map((s) => (
          <button
            key={s.key}
            type="button"
            style={{
              minHeight: 32,
              border: 0,
              borderRight: '1px solid var(--color-divider)',
              background: activeSort === s.key ? 'var(--color-text)' : 'transparent',
              color: activeSort === s.key ? 'var(--color-bg)' : 'var(--color-text)',
              fontSize: 11.5,
              padding: '0 13px',
              cursor: 'pointer',
            }}
            onClick={() => pushParams({ sort: s.key })}
          >
            {s.label}
          </button>
        ))}
      </div>
    </>
  );
}

export function QueuePager({ page, pageCount }: { page: number; pageCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(nextPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div style={{ display: 'flex', gap: 0, border: '1px solid var(--color-divider)' }}>
      <button type="button" className="btn" style={{ minHeight: 30, fontSize: 11.5, borderRight: '1px solid var(--color-divider)' }} disabled={page <= 1} onClick={() => go(page - 1)}>
        Previous
      </button>
      <button type="button" className="btn" style={{ minHeight: 30, fontSize: 11.5 }} disabled={page >= pageCount} onClick={() => go(page + 1)}>
        Next
      </button>
    </div>
  );
}
