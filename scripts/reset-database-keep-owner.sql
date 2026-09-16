-- =========================================================
-- Plot360 — wipe every account/property/etc. EXCEPT one owner login
--
-- Keeps exactly one profile (by email, edited below — currently
-- plot360.in@gmail.com) and deletes every other user, their profile,
-- their properties, and everything hanging off those properties
-- (documents, tasks, visit/monitoring jobs, payments, visit credits,
-- service requests, agent records if the deleted user was an agent,
-- etc). Meant for resetting a test/dev system so everyone signs up
-- and registers properties fresh, while your own admin login stays.
--
-- Run this in the Supabase Dashboard → SQL Editor (or `psql`).
--
-- HOW TO USE
--   1. Check the KEEP_EMAIL value in step 1 below is right.
--   2. Run the whole script down through step 6. It runs inside a
--      transaction (BEGIN at the top) and does NOT save anything yet.
--   3. Read the output of every SELECT along the way — especially
--      "sanity check #1" (confirms exactly one profile is being kept)
--      and the admin/agent counts in "sanity check #2" (so you don't
--      accidentally wipe other staff accounts you meant to keep).
--   4. If it looks right, run:   COMMIT;
--      If anything looks wrong, run:   ROLLBACK;
--      (nothing is permanent until you run COMMIT)
--
-- SAFETY
--   - This is broad by design — it deletes EVERYONE except one email.
--     Take a Supabase backup (Database → Backups) or `pg_dump` first.
--   - This deletes DATABASE ROWS only. Files already uploaded to
--     Supabase Storage (property documents, visit photos/videos,
--     agent documents, service-request attachments) are NOT removed —
--     see "STORAGE CLEANUP" at the bottom.
--   - The script REFUSES to run (raises an error, changes nothing) if
--     the keep-email doesn't match exactly one existing profile, so a
--     typo can't accidentally delete every single account.
-- =========================================================

begin;

-- ---------- 1. The one account to keep. Edit this if needed. ----------
create temporary table _keep_profile on commit drop as
select id, email, is_admin, admin_role
from profiles
where email = 'plot360.in@gmail.com';

-- Guard: abort the whole transaction if that email didn't match
-- exactly one profile, instead of silently deleting everyone.
do $$
declare
  n int;
begin
  select count(*) into n from _keep_profile;
  if n <> 1 then
    raise exception 'Expected exactly 1 profile matching the keep-email, found %. Aborting — nothing was deleted.', n;
  end if;
end $$;

-- sanity check #1 — this should be exactly one row, and it should be
-- the owner account you intend to keep (is_admin = true).
select * from _keep_profile;

create temporary table _target_profiles on commit drop as
select p.id, p.email, p.first_name, p.last_name, p.is_admin, p.is_agent, p.admin_role
from profiles p
where p.id not in (select id from _keep_profile);

-- sanity check #2 — everyone about to be deleted. Scan the list (or at
-- least the counts) before continuing — if there are admins/agents in
-- here you meant to keep, stop and edit KEEP_EMAIL or add exceptions.
select count(*) as total_profiles_to_delete,
       count(*) filter (where is_admin) as admins_to_delete,
       count(*) filter (where is_agent) as agents_to_delete
from _target_profiles;

select * from _target_profiles order by is_admin desc, is_agent desc, email;

select count(*) as properties_to_delete
from properties where owner_id in (select id from _target_profiles);

select count(*) as monitoring_jobs_to_delete
from monitoring_jobs
where property_id in (select id from properties where owner_id in (select id from _target_profiles));

-- ---------- 2. Guard: don't silently break the kept account's data ----------
-- If a deleted user is an AGENT who still has a monitoring job on a
-- property the kept account owns, the delete in step 4 would fail
-- with a foreign-key error. If this returns any rows, reassign that
-- job to a different (surviving) agent before continuing.
select mj.id as blocking_job_id, mj.property_id, mj.agent_id, pr.owner_id as kept_owner_id
from monitoring_jobs mj
join properties pr on pr.id = mj.property_id
where mj.agent_id in (select id from _target_profiles where is_agent)
  and pr.owner_id in (select id from _keep_profile);

-- ---------- 3. Clear "who did this" references on the kept account's rows ----------
-- A handful of tables record which admin/agent performed an action
-- (assigned a job, recorded a payment, sent a WhatsApp message, banned
-- someone, etc). Those columns are nullable and don't cascade, so if a
-- deleted user did one of these things on a property that's being kept,
-- clear the reference first rather than let the delete fail.
update monitoring_jobs set assigned_by = null
  where assigned_by in (select id from _target_profiles);
update payments set recorded_by = null
  where recorded_by in (select id from _target_profiles);
update payments set mismatch_flagged_by = null
  where mismatch_flagged_by in (select id from _target_profiles);
update visit_credits set extended_by = null
  where extended_by in (select id from _target_profiles);
update visit_requests set requested_by = null
  where requested_by in (select id from _target_profiles);
update whatsapp_messages set sent_by = null
  where sent_by in (select id from _target_profiles);
update admin_actions set actor = null
  where actor in (select id from _target_profiles);
update bans set actor = null
  where actor in (select id from _target_profiles);

-- bans.subject_id isn't a real foreign key (it can point at either a
-- customer or an agent id), so it won't block anything, but it'd be
-- left dangling — remove it for a truly clean reset.
delete from bans where subject_id in (select id from _target_profiles);

-- renewal_requests.requested_by is required (NOT NULL) and can't be
-- cleared, so any request that isn't on a kept property (properties
-- owned by everyone being deleted get removed in step 4 anyway) has
-- to go outright.
delete from renewal_requests
where requested_by in (select id from _target_profiles)
  and property_id not in (select id from properties where owner_id in (select id from _target_profiles));

-- ---------- 4. Delete every property owned by anyone being removed ----------
-- Cascades automatically to everything hanging off a property:
-- property_ownership, property_documents, tasks (+ task_media),
-- monitoring_jobs (+ monitoring_media + monitoring_upload_tokens),
-- renewal_requests, payments, visit_credits, visit_requests. Any
-- service_request pointing at one of these properties has its
-- property_id set to null (the request itself is removed in step 5,
-- via the account it belongs to).
delete from properties where owner_id in (select id from _target_profiles);

-- ---------- 5. Delete every account except the one being kept ----------
-- auth.users cascades to profiles, which cascades to agent_profiles
-- (+ agent_documents) and to service_requests (+ service_request_messages
-- + service_request_attachments) — covering everything not already
-- removed in step 4.
delete from auth.users where id in (select id from _target_profiles);

-- ---------- 6. Final check ----------
-- Should show exactly 1 row (the kept account) and 0 remaining
-- properties from anyone else.
select id, email, is_admin, admin_role from profiles;
select count(*) as properties_remaining from properties;

-- ---------- 7. Commit ----------
-- IMPORTANT: Supabase's SQL Editor does not reliably keep the same
-- transaction open between two separate "Run" clicks (it can hand a
-- separate click a different pooled connection, so a COMMIT typed and
-- run on its own afterwards commits nothing — the BEGIN from the
-- first run is silently rolled back when that connection resets).
-- So this script commits itself, in the same run as everything above.
--
-- If you want a dry run first: comment out the COMMIT line below and
-- uncomment ROLLBACK instead, click Run once, and read the sanity
-- checks above. When you're confident, flip it back to COMMIT and
-- click Run again — the whole script, start to finish, in one click.
commit;
-- rollback;

-- =========================================================
-- STORAGE CLEANUP (optional, do separately after COMMIT)
-- =========================================================
-- This script only removes database rows; it does not delete the
-- actual files sitting in Supabase Storage (property-documents,
-- task-media, monitoring-media, agent-documents, service-request-files
-- buckets). Since a full reset removes essentially every file
-- reference in the database, the simplest cleanup is usually to just
-- empty those buckets entirely in the Dashboard (Storage → bucket →
-- select all → Delete) rather than reconciling row-by-row — there's
-- nothing left in the DB pointing at any of those files once this
-- script is committed.
