'use client';

import { useRouter } from 'next/navigation';

export function BackButton({ label = '← Back' }: { label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="btn-primary"
      style={{ marginBottom: 16 }}
    >
      {label}
    </button>
  );
}
