// Supabase's free tier rejects any single file over 50MB regardless of
// what Next.js/Vercel allow — checking client-side before upload gives an
// immediate, clear error instead of a failed round-trip. Scoped to images
// only (photos are the common case here; videos are handled separately
// since a 50MB video is normal/expected, unlike a 50MB photo which
// usually signals something wrong, e.g. an unconverted RAW/HEIC file).
const MAX_IMAGE_SIZE_BYTES = 50 * 1024 * 1024;

export function findOversizedImages(files: File[]): File[] {
  return files.filter((f) => f.type.startsWith('image/') && f.size > MAX_IMAGE_SIZE_BYTES);
}

export function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
