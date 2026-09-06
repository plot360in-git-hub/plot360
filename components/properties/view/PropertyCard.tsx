import Link from 'next/link';
import type { Property } from '@/types/database.types';

export function PropertyCard({ property, thumbnailUrl }: { property: Property; thumbnailUrl?: string }) {
  return (
    <Link
      href={`/properties/${property.id}`}
      className="card"
      style={{ display: 'block', textDecoration: 'none', color: 'inherit', padding: 0, overflow: 'hidden' }}
    >
      <div style={{ aspectRatio: '4 / 3', background: 'var(--color-bg-alt)' }}>
        {thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt={property.property_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
      <div style={{ padding: 20 }}>
        <h4 style={{ marginBottom: 6 }}>{property.property_name}</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 10 }}>
          {property.property_type} · {property.plot_size} {property.plot_size_unit}
        </p>
        <span className={`status-pill ${property.status}`}>
          {property.status === 'verified' ? 'Verified' : property.status === 'rejected' ? 'Rejected' : 'Not Verified'}
        </span>
      </div>
    </Link>
  );
}
