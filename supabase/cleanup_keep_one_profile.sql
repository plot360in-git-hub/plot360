-- =========================================================
-- Plot360 — destructive cleanup: delete ALL data except the
-- profiles/auth.users row for plot360.in@gmail.com.
--
-- IRREVERSIBLE. Run only in the Supabase SQL editor, ideally after
-- taking a project backup/export. This wipes every property, task,
-- agent, monitoring job, payment, visit credit, service request,
-- WhatsApp log, admin-action log, ban record and enquiry in the
-- database — including any owned by plot360.in@gmail.com itself.
-- Only the single profile (and its auth.users row) survives.
--
-- Left untouched by design (business configuration, not user data,
-- not linked to any profile): subscription_plans, payment_settings.
-- Uncomment the two DELETEs near the bottom if you want those wiped
-- too (e.g. to reset plan pricing / UPI details back to defaults).
--
-- Order matters: child tables are deleted before the parents they
-- reference, specifically to satisfy two foreign keys that do NOT
-- cascade (agent_payouts.agent_id -> agent_profiles, and
-- agent_payouts.job_id / monitoring_jobs.agent_id -> agent_profiles).
-- Every other table cascades automatically once auth.users rows are
-- removed, but agent_payouts and monitoring_jobs must be cleared
-- explicitly first or the final delete will fail with a foreign-key
-- violation.
-- =========================================================

begin;

-- Safety guard: abort with a clear error instead of silently wiping
-- everyone if the email doesn't match any account (e.g. a typo).
do $$
begin
  if not exists (select 1 from auth.users where lower(email) = lower('plot360.in@gmail.com')) then
    raise exception 'Aborting: no auth.users row found for plot360.in@gmail.com — nothing was deleted.';
  end if;
end $$;

-- ---- Leaf tables first ----
delete from service_request_attachments;
delete from service_request_messages;
delete from service_requests;

delete from task_media;
delete from tasks;

delete from property_documents;
delete from property_ownership;

delete from monitoring_upload_tokens;
delete from monitoring_media;

-- Must go before monitoring_jobs and agent_profiles: agent_payouts has
-- no ON DELETE cascade on either agent_id or job_id.
delete from agent_payouts;

delete from visit_requests;

-- Must go before agent_profiles: monitoring_jobs.agent_id has no
-- ON DELETE cascade.
delete from monitoring_jobs;

delete from visit_credits;
delete from payments;
delete from renewal_requests;

delete from agent_documents;
delete from agent_profiles;

delete from properties;

-- ---- Standalone / log tables (no cascade path from profiles) ----
delete from whatsapp_messages;
delete from admin_actions;
delete from bans;
delete from enquiries;

-- ---- Root: everyone except the one account to keep ----
-- profiles.id references auth.users(id) on delete cascade, so this
-- also removes the matching profiles row for every deleted user.
-- By this point every table above is empty, so nothing is left to
-- violate the non-cascading FKs on agent_payouts / monitoring_jobs.
delete from auth.users where lower(email) <> lower('plot360.in@gmail.com');

-- ---- Left as-is by design — uncomment to also wipe business config ----
-- delete from subscription_plans;
-- delete from payment_settings;

commit;
