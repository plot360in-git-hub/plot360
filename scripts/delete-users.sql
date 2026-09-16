-- =========================================================
-- Plot360 — delete specific users and all their data
--
-- Run this in the Supabase Dashboard → SQL Editor (or `psql`
-- connected to your project's database). It deletes one or more
-- accounts by email, plus every property, document, visit/monitoring
-- job, payment, service request, etc. that belongs to them.
--
-- HOW TO USE
--   1. Edit the email list in step 1 below.
--   2. Run the whole script down through step 6. It runs inside a
--      transaction (BEGIN ... at the top) and does NOT save anything
--      yet — the SELECTs along the way let you check what's about to
--      be deleted.
--   3. Read the output of each "sanity check" / "final check" SELECT.
--   4. If it looks right, run:   COMMIT;
--      If anything looks wrong, run:   ROLLBACK;
--      (nothing is permanent until you run COMMIT)
--
-- SAFETY
--   - Take a Supabase backup (Database → Backups) or run
--     `pg_dump` before doing this on anything you care about.
--     This is not reversible once committed.
--   - This deletes DATABASE ROWS only. Files already uploaded to
--     Supabase Storage (property documents, task/monitoring photos
--     and videos, agent documents, service-request attachments,
--     profile/identity pictures) are NOT removed by this script —
--     see "STORAGE CLEANUP" at the very bottom for how to find and
--     remove those separately.
--   - Deleting a user this way (raw SQL against auth.users) removes
--     the account and all app data. If you'd rather use Supabase's
--     own admin API (which also tidies up auth sessions/tokens),
--     skip step 5 here and instead call `supabase.auth.admin
--     .deleteUser(id)` for each id printed in step 1 — everything
--     else in this script still applies.
-- =========================================================

begin;

-- ---------- 1. Who are we deleting? Edit this list. ----------
create temporary table _target_emails (email text) on commit drop;
insert into _target_emails (email) values
  ('test1@example.com'),
  ('test2@example.com');
  -- add or remove rows as needed — one email per line

create temporary table _target_profiles on commit drop as
select p.id, p.email, p.first_name, p.last_name, p.is_admin, p.is_agent
from profiles p
join _target_emails t on t.email = p.email;

-- sanity check #1 — every email above should have a matched_profile_id.
-- A NULL here usually means a typo, or the account doesn't exist.
select t.email as requested_email, tp.id as matched_profile_id
from _target_emails t
left join _target_profiles tp on tp.email = t.email;

-- sanity check #2 — who/what you're about to delete
select * from _target_profiles;

select count(*) as properties_to_delete
from properties where owner_id in (select id from _target_profiles);

select count(*) as monitoring_jobs_to_delete
from monitoring_jobs
where property_id in (select id from properties where owner_id in (select id from _target_profiles));

-- ---------- 2. Guard: don't silently touch other customers' data ----------
-- If any target user is an AGENT who still has monitoring jobs assigned
-- on a property belonging to someone else (not in the list above), the
-- delete in step 4 will fail with a foreign-key error rather than
-- silently deleting another customer's visit history. If this returns
-- any rows, reassign those jobs to a different agent (or decide you're
-- OK deleting them) before continuing.
select mj.id as blocking_job_id, mj.property_id, mj.agent_id, pr.owner_id as other_owner_id
from monitoring_jobs mj
join properties pr on pr.id = mj.property_id
where mj.agent_id in (select id from _target_profiles where is_agent)
  and pr.owner_id not in (select id from _target_profiles);

-- ---------- 3. Clear "who did this" references on OTHER rows ----------
-- A handful of tables record which admin/agent performed an action
-- (assigned a job, recorded a payment, sent a WhatsApp message, banned
-- someone, etc). Those columns are nullable and not cascading, so if a
-- target user did one of these things on a property that ISN'T being
-- deleted, clear the reference first rather than let the delete fail.
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

-- bans.subject_id isn't a foreign key (it can point at either a
-- customer or an agent id), so it won't block anything, but it would
-- be left as a dangling reference — remove it for a truly clean DB.
delete from bans where subject_id in (select id from _target_profiles);

-- renewal_requests.requested_by is required (NOT NULL) and can't be
-- cleared, so any request that isn't on one of these users' own
-- properties (which get deleted in step 4 anyway) has to be removed
-- outright. This only matters if a target user requested a renewal on
-- someone else's property, which shouldn't normally happen.
delete from renewal_requests
where requested_by in (select id from _target_profiles)
  and property_id not in (select id from properties where owner_id in (select id from _target_profiles));

-- ---------- 4. Delete their properties ----------
-- Cascades automatically to everything hanging off a property:
-- property_ownership, property_documents, tasks (+ task_media),
-- monitoring_jobs (+ monitoring_media + monitoring_upload_tokens),
-- renewal_requests, payments, visit_credits, visit_requests. Any
-- service_request pointing at one of these properties has its
-- property_id set to null (it still gets deleted in step 5, via the
-- account itself).
delete from properties where owner_id in (select id from _target_profiles);

-- ---------- 5. Delete the accounts themselves ----------
-- auth.users cascades to profiles, which cascades to agent_profiles
-- (+ agent_documents) and to service_requests (+ service_request_messages
-- + service_request_attachments) — covering everything not already
-- removed in step 4.
delete from auth.users where id in (select id from _target_profiles);

-- ---------- 6. Final check — every one of these should return 0 rows ----------
select * from profiles where id in (select id from _target_profiles);
select * from properties where owner_id in (select id from _target_profiles);

-- Nothing is permanent yet. Review everything printed above, then run
-- exactly one of:
--
--   COMMIT;      -- keep the deletion
--   ROLLBACK;    -- undo everything this script did

-- =========================================================
-- STORAGE CLEANUP (optional, do this separately after COMMIT)
-- =========================================================
-- This script only removes database rows; it does not delete the
-- actual files sitting in Supabase Storage. Since the property/agent
-- rows are already gone by the time you'd run this, capture the file
-- paths BEFORE step 4/5 above if you want to clean storage too — e.g.
-- run this once near the top of the script (inside the same
-- transaction, before step 4) and save the output:
--
--   select 'property-documents' as bucket, file_path from property_documents
--     where property_id in (select id from properties where owner_id in (select id from _target_profiles))
--   union all
--   select 'task-media', file_path from task_media
--     where task_id in (select id from tasks where property_id in
--       (select id from properties where owner_id in (select id from _target_profiles)))
--   union all
--   select 'monitoring-media', file_path from monitoring_media
--     where job_id in (select id from monitoring_jobs where property_id in
--       (select id from properties where owner_id in (select id from _target_profiles)))
--   union all
--   select 'agent-documents', file_path from agent_documents
--     where agent_id in (select id from _target_profiles where is_agent);
--
-- Then remove those objects either in the Dashboard (Storage → bucket
-- → select files → Delete) or with the JS admin client:
--   await supabase.storage.from('<bucket>').remove([<file_path>, ...]);
