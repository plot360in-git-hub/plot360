import type { MetadataRoute } from 'next';

// Web app manifest (served at /manifest.webmanifest). Used by the Android
// app (TWA, package in.plot360.app) for its name/colours, and by Chrome's
// "Add to home screen". start_url is the customer-only app entry point —
// see app/app-launch/route.ts.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Plot360',
    short_name: 'Plot360',
    description: 'Register, verify, and track your properties.',
    id: '/app-launch',
    start_url: '/app-launch',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f3f2f2',
    theme_color: '#1e3a5f',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
