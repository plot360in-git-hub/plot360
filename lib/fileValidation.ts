// Redesign 2026-09 (follow-up, 2026-09-26) — Plot confirmed the project is
// on Supabase's free plan, which enforces a HARD 50MB-per-file limit at
// the storage layer itself — for every file type, not just images (see
// supabase.com/docs/guides/storage/uploads/file-limits: free plan default
// is 50MB, only raised on Pro/Team). The old findOversizedImages()
// deliberately skipped videos on the assumption "a 50MB video is normal,
// unlike a 50MB photo" — true in general, but on THIS project's actual
// (free-tier) limit, a video over 50MB was never going to upload at all:
// it would reach Supabase Storage via the direct-upload flow
// (lib/uploadDirect.ts) and get rejected there, surfacing to the agent as
// a generic "upload failed" with no indication of why. This checks every
// selected file against the real limit before attempting the upload, so
// the person sees an accurate, specific reason immediately instead of a
// confusing failure after the fact. If Plot360 ever moves off the free
// plan and raises Supabase's global file size limit, update
// MAX_FILE_SIZE_BYTES here to match (Dashboard → Storage → Settings).
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export function findOversizedFiles(files: File[], maxBytes: number = MAX_FILE_SIZE_BYTES): File[] {
  return files.filter((f) => f.size > maxBytes);
}

export function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function oversizedFilesMessage(oversized: File[], maxBytes: number = MAX_FILE_SIZE_BYTES): string {
  const maxLabel = formatFileSize(maxBytes);
  const list = oversized.map((f) => `${f.name} (${formatFileSize(f.size)})`).join(', ');
  const subject = oversized.length > 1 ? 'These files are' : 'This file is';
  const advice = oversized.length > 1 ? 'Please compress them or choose smaller ones.' : 'Please compress it or choose a smaller one.';
  return `${subject} too large (max ${maxLabel} each): ${list}. ${advice}`;
}
