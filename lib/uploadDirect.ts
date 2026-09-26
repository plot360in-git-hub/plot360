'use client';

import { createClient } from './supabase/client';

// Redesign 2026-09 (follow-up) — Plot: agents got "This page couldn't
// load" in WhatsApp's in-app browser when uploading photos/video. Root
// cause: every upload in this app went through a Next.js Server Action,
// which on Vercel runs as a serverless function with a HARD 4.5MB request
// body limit — this is a platform limit enforced by Vercel itself, not
// something next.config.mjs's `serverActions.bodySizeLimit: '50mb'` can
// raise (that only changes Next's own internal limit). A single phone
// photo is often 3-8MB and video is essentially always bigger, so real
// uploads were getting cut off mid-request; on a weak signal that shows
// up as a broken page rather than a clean in-app error.
//
// Fix: upload the file bytes straight from the browser to Supabase
// Storage using a short-lived signed upload URL (obtained from a small,
// byte-free server action call) — the file never passes through our own
// server/Vercel function at all, so the 4.5MB ceiling doesn't apply.
// Every upload flow (agent visit media, task media, service-request
// attachments, property documents) uses this same helper — see
// ARCHITECTURE.md #60.
export type DirectUploadItem = { path: string; token: string; file: File };
export type DirectUploadResult = { index: number; ok: boolean; error?: string };

// Sequential (not parallel) on purpose — mobile/field connections are
// often weak, and racing several large uploads at once tends to make all
// of them time out rather than a few succeed cleanly.
export async function uploadFilesDirect(bucket: string, uploads: DirectUploadItem[]): Promise<DirectUploadResult[]> {
  const supabase = createClient();
  const results: DirectUploadResult[] = [];
  for (let i = 0; i < uploads.length; i++) {
    const u = uploads[i];
    try {
      const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(u.path, u.token, u.file);
      results.push({ index: i, ok: !error, error: error?.message });
    } catch (e: any) {
      results.push({ index: i, ok: false, error: e?.message ?? 'Network error during upload.' });
    }
  }
  return results;
}

export function mediaTypeOf(file: File): 'photo' | 'video' | 'document' {
  if (file.type.startsWith('video')) return 'video';
  if (file.type.startsWith('image')) return 'photo';
  return 'document';
}
