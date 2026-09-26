'use server';

import { createClient } from '@/lib/supabase/server';
import { setPropertyStatus } from './admin.actions';
import { decideMonitoringJob } from './monitoring.actions';
import { logWhatsAppMessage } from './whatsapp-log.actions';
import { logAdminAction } from './timeline.actions';
import { flagPaymentMismatch } from '@/components/payments/payments.actions';
import { setAgentStatus } from './agents.actions';
import { isCurrentUserAdmin } from './admin.actions';
import {
  buildAdditionalInfoMessage,
  buildPaymentConfirmedMessage,
  buildPropertyVerifiedMessage,
  buildVisitReportReadyMessage,
  customerDisplayName,
} from './whatsapp';
import type { SubmissionAnswerOverrides } from './monitoring.actions';

// Redesign 2026-09 — admin console. Thin wrappers around the existing,
// untouched decision actions (setPropertyStatus, decideMonitoringJob,
// setAgentStatus, flagPaymentMismatch) that additionally write the
// WhatsApp outbox row and internal-timeline entry the design's right-
// hand panels show. Kept separate from those files so their own tested
// logic (email sending, ec_pending handling, revalidatePath timing)
// isn't touched — this is purely additive plumbing on top.
//
// Redesign 2026-09 (follow-up) — Plot: "check ... any other place where
// whatsapp is not opening and just logging internally in all the
// application and fix it." Every function below used to only call
// logWhatsAppMessage and stop — the message sat in the outbox, but
// nothing ever opened WhatsApp, so the customer/agent was never actually
// messaged (same bug already found and fixed for the agent "Request
// missing documents" button). Each one now also returns
// phoneCountryCode/phoneNumber/message when it logged something, so the
// calling UI can open the real wa.me link — either automatically
// (RejectionDialog's onSubmit → whatsappLink, for the three reject/flag
// flows) or via a "Send via WhatsApp" link shown after success (the
// three plain-button approve/confirm flows, same shape
// MonitoringDecision.tsx/AssignAgentForm.tsx already use).

function phoneOf(profile: any) {
  return profile ? `${profile.phone_country_code ?? ''}${profile.phone_number ?? ''}` : '';
}

// ---------- Property verification ----------

export async function verifyProperty(propertyId: string) {
  const result = await setPropertyStatus(propertyId, 'verified');
  if ('error' in result) return result;

  const supabase = await createClient();
  const { data: property } = await supabase
    .from('properties')
    .select('property_name, profiles(first_name, last_name, username, phone_country_code, phone_number)')
    .eq('id', propertyId)
    .single();
  const profile: any = (property as any)?.profiles;
  const phone = phoneOf(profile);
  const message = buildPropertyVerifiedMessage(customerDisplayName(profile), property?.property_name ?? 'your property');
  if (phone) {
    await logWhatsAppMessage({ relatedEntityType: 'property', relatedEntityId: propertyId, recipientPhone: phone, body: message });
  }
  await logAdminAction({ entityType: 'property', entityId: propertyId, action: 'Verified' });
  return phone
    ? { success: true as const, phoneCountryCode: profile.phone_country_code ?? null, phoneNumber: profile.phone_number as string, message }
    : { success: true as const };
}

export async function rejectPropertyVerification(propertyId: string, reasonText: string) {
  const result = await setPropertyStatus(propertyId, 'rejected', reasonText);
  if ('error' in result) return result;

  const supabase = await createClient();
  const { data: property } = await supabase
    .from('properties')
    .select('property_name, profiles(phone_country_code, phone_number)')
    .eq('id', propertyId)
    .single();
  const profile: any = (property as any)?.profiles;
  const phone = phoneOf(profile);
  const message = `Plot360: We could not complete verification for ${property?.property_name ?? 'your property'}. ${reasonText.trim()}. Reply here with the document and we will continue — your plan and visit credits are unaffected.`;
  if (phone) {
    await logWhatsAppMessage({ relatedEntityType: 'property', relatedEntityId: propertyId, recipientPhone: phone, body: message });
  }
  await logAdminAction({ entityType: 'property', entityId: propertyId, action: 'Rejected', note: reasonText.trim() });
  return phone
    ? { success: true as const, phoneCountryCode: profile.phone_country_code ?? null, phoneNumber: profile.phone_number as string, message }
    : { success: true as const };
}

// Redesign 2026-09 (follow-up) — Plot asked for a way, right from the
// Property verification detail screen and before any approve/reject
// decision, to send the owner a WhatsApp saying more info/documents are
// needed and a team member will follow up. Same click-to-open-wa.me +
// log pattern as ResendWhatsAppButton (not the auto-logged-as-sent
// pattern verifyProperty/rejectPropertyVerification use above) since
// this is a message the admin is choosing to send right now, not a side
// effect of a status change — the admin still taps Send inside WhatsApp.
export async function sendAdditionalInfoRequest(propertyId: string) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const supabase = await createClient();
  const { data: property } = await supabase
    .from('properties')
    .select('property_name, profiles(first_name, last_name, username, phone_country_code, phone_number)')
    .eq('id', propertyId)
    .single();
  if (!property) return { error: 'Property not found.' };

  const owner: any = property.profiles;
  if (!owner?.phone_number) return { error: 'No phone number on file for this customer.' };

  const message = buildAdditionalInfoMessage(customerDisplayName(owner));

  await logWhatsAppMessage({
    relatedEntityType: 'property',
    relatedEntityId: propertyId,
    recipientPhone: phoneOf(owner),
    body: message,
  });
  await logAdminAction({ entityType: 'property', entityId: propertyId, action: 'Requested additional information' });

  return {
    success: true as const,
    phoneCountryCode: owner.phone_country_code ?? null,
    phoneNumber: owner.phone_number as string,
    message,
  };
}

// ---------- Agent submissions ----------

export async function approveSubmission(
  jobId: string,
  propertyId: string,
  adminRemarks: string,
  overrides?: SubmissionAnswerOverrides
) {
  const result = await decideMonitoringJob(jobId, propertyId, 'approved', undefined, adminRemarks, overrides);
  if ('error' in result) return result;

  const supabase = await createClient();
  const [{ data: property }, { data: ownership }] = await Promise.all([
    supabase
      .from('properties')
      .select('property_name, profiles(first_name, last_name, username, phone_country_code, phone_number)')
      .eq('id', propertyId)
      .single(),
    supabase.from('property_ownership').select('ec_digital_copy_requested').eq('property_id', propertyId).maybeSingle(),
  ]);
  const profile: any = (property as any)?.profiles;
  const phone = phoneOf(profile);
  const propertyName = property?.property_name ?? 'your property';
  // Redesign 2026-09 (follow-up, 2026-09-26) — Plot: the WhatsApp saying the
  // report is ready should also carry a direct link to it, so the customer
  // doesn't have to log in and hunt for it. Same pattern rejectSubmission
  // below already uses for its upload link.
  const reportUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/properties/${propertyId}/visit-report/${jobId}/pdf`;
  const message = buildVisitReportReadyMessage({
    customerName: customerDisplayName(profile),
    propertyName,
    reportUrl,
    includesEcCopy: !!ownership?.ec_digital_copy_requested && !result.ecPending,
  });
  if (phone) {
    await logWhatsAppMessage({ relatedEntityType: 'monitoring_job', relatedEntityId: jobId, recipientPhone: phone, body: message });
  }
  await logAdminAction({ entityType: 'monitoring_job', entityId: jobId, action: result.ecPending ? 'Approved — EC copy pending' : 'Approved, report sent' });
  return phone
    ? { ...result, phoneCountryCode: profile.phone_country_code ?? null, phoneNumber: profile.phone_number as string, message }
    : result;
}

export async function rejectSubmission(
  jobId: string,
  propertyId: string,
  reasonText: string,
  overrides?: SubmissionAnswerOverrides
) {
  const result = await decideMonitoringJob(jobId, propertyId, 'rejected', reasonText, undefined, overrides);
  if ('error' in result) return result;

  const supabase = await createClient();
  const { data: job } = await supabase
    .from('monitoring_jobs')
    .select('properties(property_name), agent_profiles(profiles(phone_country_code, phone_number))')
    .eq('id', jobId)
    .single();
  const propertyName = (job as any)?.properties?.property_name ?? 'this property';
  const profile: any = (job as any)?.agent_profiles?.profiles;
  const phone = phoneOf(profile);

  const { getOrCreateUploadToken } = await import('@/components/agent/magic-link.actions');
  const tokenResult = await getOrCreateUploadToken(jobId);
  const uploadLink = 'error' in tokenResult ? '' : `${process.env.NEXT_PUBLIC_SITE_URL}/m/${tokenResult.token}`;
  const message = `Plot360: Your visit submission for ${propertyName} needs rework. ${reasonText.trim()} New upload link: ${uploadLink} (valid 7 days). The job stays with you.`;

  if (phone) {
    await logWhatsAppMessage({ relatedEntityType: 'monitoring_job', relatedEntityId: jobId, recipientPhone: phone, body: message });
  }
  await logAdminAction({ entityType: 'monitoring_job', entityId: jobId, action: 'Rejected, sent back to agent', note: reasonText.trim() });
  return phone
    ? { success: true as const, phoneCountryCode: profile.phone_country_code ?? null, phoneNumber: profile.phone_number as string, message }
    : { success: true as const };
}

// ---------- Agent verification ----------

export async function verifyAgent(agentId: string) {
  const result = await setAgentStatus(agentId, 'verified');
  if ('error' in result) return result;
  await logAdminAction({ entityType: 'agent_profile', entityId: agentId, action: 'Verified' });
  return { success: true };
}

// ---------- Payments ----------

export async function confirmPaymentWithLog(paymentId: string, propertyId: string, formData: FormData) {
  const { recordPayment } = await import('@/components/payments/payments.actions');
  const result = await recordPayment(paymentId, propertyId, formData);
  if ('error' in result) return result;

  const supabase = await createClient();
  const { data: property } = await supabase
    .from('properties')
    .select('property_name, profiles(first_name, last_name, username, phone_country_code, phone_number)')
    .eq('id', propertyId)
    .single();
  const profile: any = (property as any)?.profiles;
  const phone = phoneOf(profile);
  const message = buildPaymentConfirmedMessage({
    customerName: customerDisplayName(profile),
    propertyName: property?.property_name ?? 'your property',
    amount: result.amount ?? 0,
    visitQuantity: result.visitQuantity ?? null,
    validUntil: result.validUntil,
  });
  if (phone) {
    await logWhatsAppMessage({ relatedEntityType: 'payment', relatedEntityId: paymentId, recipientPhone: phone, body: message });
  }
  await logAdminAction({ entityType: 'payment', entityId: paymentId, action: 'Confirmed, credits released' });
  return phone ? { ...result, phoneCountryCode: profile.phone_country_code ?? null, phoneNumber: profile.phone_number as string, message } : result;
}

export async function flagPaymentMismatchWithLog(paymentId: string, reasonText: string) {
  const result = await flagPaymentMismatch(paymentId, reasonText);
  if ('error' in result) return result;

  const supabase = await createClient();
  const { data: payment } = await supabase
    .from('payments')
    .select('properties(property_name, profiles(phone_country_code, phone_number))')
    .eq('id', paymentId)
    .single();
  const propertyName = (payment as any)?.properties?.property_name ?? 'your property';
  const profile: any = (payment as any)?.properties?.profiles;
  const phone = phoneOf(profile);
  const message = `Plot360: We have a question about your bank transfer for ${propertyName}. ${reasonText.trim()} Reply here with the transfer receipt and we will release your visit credits.`;
  if (phone) {
    await logWhatsAppMessage({ relatedEntityType: 'payment', relatedEntityId: paymentId, recipientPhone: phone, body: message });
  }
  await logAdminAction({ entityType: 'payment', entityId: paymentId, action: 'Flagged a mismatch', note: reasonText.trim() });
  return phone
    ? { success: true as const, phoneCountryCode: profile.phone_country_code ?? null, phoneNumber: profile.phone_number as string, message }
    : { success: true as const };
}
