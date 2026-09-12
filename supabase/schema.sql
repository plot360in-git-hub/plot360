-- =========================================================
-- Plot360 — Supabase schema
-- Run in Supabase SQL editor. Idempotent-ish (uses IF NOT EXISTS
-- where possible) so it's safe to re-run during development.
-- =========================================================

-- ---------- Enums ----------
do $$ begin
  create type property_type as enum ('residential','commercial','agricultural','industrial');
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  create type plot_shape as enum ('square','rectangular','irregular','l_shape');
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  create type verification_status as enum ('pending','verified','rejected');
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  create type document_type as enum ('title_deed','encumbrance_certificate','noc','approval_letter','owner_id','ownership_proof','ec_reference_copy');
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  create type task_status as enum ('not_done','in_progress','complete');
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  create type media_type as enum ('photo','video','document');
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  create type agent_document_type as enum ('driving_license','secondary_id');
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  create type agent_status as enum ('pending','verified','rejected');
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  create type monitoring_job_status as enum ('assigned','accepted','submitted','approved','rejected');
exception when duplicate_object or duplicate_table then null; end $$;

-- ---------- profiles (Customer Registration wireframes) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  first_name text not null,
  middle_name text,
  last_name text not null,
  date_of_birth date,
  gender text check (gender in ('male','female','other')),
  profile_picture_url text,
  email text not null,
  phone_country_code text,
  phone_number text,
  current_address jsonb default '{}'::jsonb,   -- {street,city,state,zip,country}
  permanent_address jsonb default '{}'::jsonb, -- same shape
  identity_proof_type text,                    -- passport / DL / aadhar / etc.
  identity_proof_url text,
  security_question_1 text,
  security_answer_1 text,
  security_question_2 text,
  security_answer_2 text,
  how_heard_about_us text,
  is_admin boolean not null default false,
  is_agent boolean not null default false,
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- properties (Plot Registration wireframes) ----------
create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  property_name text not null,
  property_type property_type not null,
  plot_size numeric,
  plot_size_unit text default 'yards',
  plot_shape plot_shape,
  description text,

  street_address text,
  local_area text,
  village_town text,
  mandal_taluka text,
  district text,
  state text,
  postal_code text,
  registration_office text,
  sro_name text,
  sro_code text,
  postal_code text,

  plot_gps_coordinate text,          -- single "40°42'45.9936''N, 74°0'21..." style entry
  google_map_lat double precision,
  google_map_lng double precision,
  near_by_landmark text,

  -- four-corner GPS box from the wireframe
  gps_corners jsonb default '{}'::jsonb,
  -- shape: { ne:{lat,lng}, se:{lat,lng}, nw:{lat,lng}, sw:{lat,lng} }

  status verification_status not null default 'pending',
  registration_date date,
  expiration_date date,
  next_monitoring_due_date date,   -- twice-yearly physical verification schedule

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table properties add column if not exists rejection_reason text;

create index if not exists idx_properties_owner on properties(owner_id);

-- ---------- property_ownership (Proofs of Ownership screen) ----------
create table if not exists property_ownership (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null unique references properties(id) on delete cascade,
  owner_full_name text,
  is_registered_user_owner boolean,     -- "Is this plot owned by you: yes/no"
  agent_entry_allowed boolean,          -- "Do you allow our agent to enter this property"
  noc_file_url text,                    -- required if owner differs from login user
  approval_letter_url text,
  owner_id_proof_url text,
  ownership_proof_url text,
  no_legal_case_declared boolean default false,
  agent_entry_terms_agreed boolean default false,
  other_terms_conditions text,
  ec_digital_copy_requested boolean,       -- "Do you want a Digital Signed Certified copy of EC?"
  ec_document_number text,
  ec_registration_year text,
  ec_registered_sro text,
  created_at timestamptz not null default now()
);

-- ---------- property_documents (generic doc table: title deed, EC, etc.) ----------
create table if not exists property_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  doc_type document_type not null,
  file_path text not null,              -- path inside 'property-documents' bucket
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_property_documents_property on property_documents(property_id);

-- Every doc_type is single-file (one row per property_id+doc_type) EXCEPT
-- title_deed, which allows multiple files (e.g. first page + last page of
-- a sale deed). A partial unique index achieves this: it only enforces
-- uniqueness for rows where doc_type isn't 'title_deed', and still works
-- correctly as an ON CONFLICT target for the other types' upserts.
do $$ begin
  alter table property_documents drop constraint if exists property_documents_property_doctype_key;
exception when undefined_object then null; end $$;
create unique index if not exists property_documents_property_doctype_uidx
  on property_documents(property_id, doc_type) where doc_type <> 'title_deed';

-- ---------- tasks (Task View / Task History) ----------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  task_name text not null,
  task_type text,                       -- e.g. property_inspection, secure_check, renewal
  status task_status not null default 'not_done',
  start_date date,
  completed_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_property on tasks(property_id);

-- ---------- task_media (Task media grid: Pic1..Pic12, Video player) ----------
create table if not exists task_media (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  media_type media_type not null,
  file_path text not null,              -- path inside 'task-media' bucket
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_task_media_task on task_media(task_id);

-- ---------- agent_profiles (Agent Registration) ----------
-- 1:1 with profiles, same way property_ownership is 1:1 with properties.
-- Agents share the profiles table for name/phone/email/picture/home address
-- (current_address doubles as "home address" here) and this table holds
-- only what's agent-specific: verification status.
create table if not exists agent_profiles (
  id uuid primary key references profiles(id) on delete cascade,
  status agent_status not null default 'pending',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table agent_profiles add column if not exists sro_name text;
alter table agent_profiles add column if not exists sro_code text;

-- ---------- agent_documents (Driving License + second Govt ID) ----------
create table if not exists agent_documents (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agent_profiles(id) on delete cascade,
  doc_type agent_document_type not null,
  file_path text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_agent_documents_agent on agent_documents(agent_id);
do $$ begin
  alter table agent_documents add constraint agent_documents_agent_doctype_key unique (agent_id, doc_type);
exception when duplicate_object or duplicate_table then null; end $$;

-- ---------- monitoring_jobs (twice-yearly physical verification) ----------
create table if not exists monitoring_jobs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  agent_id uuid not null references agent_profiles(id),
  assigned_by uuid references profiles(id),
  status monitoring_job_status not null default 'assigned',
  observations text,          -- agent's notes submitted with the work
  admin_feedback text,        -- admin's question/reason if rejected
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  submitted_at timestamptz,
  decided_at timestamptz
);

create index if not exists idx_monitoring_jobs_property on monitoring_jobs(property_id);
create index if not exists idx_monitoring_jobs_agent on monitoring_jobs(agent_id);

-- ---------- monitoring_media (agent's uploaded photos/videos for a job) ----------
create table if not exists monitoring_media (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references monitoring_jobs(id) on delete cascade,
  media_type media_type not null,
  file_path text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_monitoring_media_job on monitoring_media(job_id);

-- ---------- monitoring_upload_tokens (passwordless magic-link uploads) ----------
-- A long random token lets an agent open a link on their phone (from a
-- WhatsApp message) and upload directly, with no login. Validity is
-- enforced by checking expires_at AND the job's current status — an
-- approved job's tokens are revoked immediately regardless of expiry.
create table if not exists monitoring_upload_tokens (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references monitoring_jobs(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_monitoring_upload_tokens_job on monitoring_upload_tokens(job_id);
create index if not exists idx_monitoring_upload_tokens_token on monitoring_upload_tokens(token);

-- ---------- renewal_requests (owner requests, admin decides) ----------
create table if not exists renewal_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  requested_by uuid not null references profiles(id),
  current_expiration_date date,
  requested_expiration_date date not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_expiration_date date,       -- what the admin actually set, if different from requested
  admin_notes text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists idx_renewal_requests_property on renewal_requests(property_id);

-- ---------- payments (gates the property's active validity period) ----------
-- A property becomes "active" with a real expiration_date only once a
-- payment is recorded as completed here. Covers both the initial
-- registration payment and each subsequent renewal payment.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  renewal_request_id uuid references renewal_requests(id) on delete set null,
  payment_type text not null default 'initial' check (payment_type in ('initial', 'renewal')),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  amount numeric,
  payment_method text,          -- e.g. cash, bank transfer, UPI, cheque
  transaction_reference text,
  notes text,
  paid_at date,                 -- date admin confirms payment was received
  valid_from date,              -- = paid_at
  valid_until date,             -- = paid_at + 1 year
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_property on payments(property_id);

-- =========================================================
-- Row-Level Security
-- =========================================================
alter table profiles enable row level security;
alter table properties enable row level security;
alter table property_ownership enable row level security;
alter table property_documents enable row level security;
alter table tasks enable row level security;
alter table task_media enable row level security;
alter table renewal_requests enable row level security;
alter table payments enable row level security;
alter table agent_profiles enable row level security;
alter table agent_documents enable row level security;
alter table monitoring_jobs enable row level security;
alter table monitoring_media enable row level security;
alter table monitoring_upload_tokens enable row level security;

-- Safe way to check admin status from within another table's RLS policy
-- (or even profiles' own policy) without triggering Postgres's "infinite
-- recursion detected in policy" guard. A SECURITY DEFINER function's
-- internal query runs with elevated privileges and bypasses RLS entirely,
-- breaking the self-reference cycle that a plain subquery would create.
create or replace function is_admin() returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- profiles: a user can only see/edit their own row
drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
drop policy if exists "profiles_select_admin" on profiles;
create policy "profiles_select_admin" on profiles for select
  using (is_admin());
drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- properties: owner-only
drop policy if exists "properties_select_own" on properties;
create policy "properties_select_own" on properties for select using (auth.uid() = owner_id);
drop policy if exists "properties_insert_own" on properties;
create policy "properties_insert_own" on properties for insert with check (auth.uid() = owner_id);
drop policy if exists "properties_update_own" on properties;
create policy "properties_update_own" on properties for update using (auth.uid() = owner_id);
drop policy if exists "properties_delete_own" on properties;
create policy "properties_delete_own" on properties for delete using (auth.uid() = owner_id);

-- admins: full read + status-update access across all properties/ownership/documents
drop policy if exists "properties_select_admin" on properties;
create policy "properties_select_admin" on properties for select
  using (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));
drop policy if exists "properties_update_admin" on properties;
create policy "properties_update_admin" on properties for update
  using (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));
drop policy if exists "properties_delete_admin" on properties;
create policy "properties_delete_admin" on properties for delete
  using (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));

-- property_ownership: via parent property's owner_id
drop policy if exists "ownership_select_own" on property_ownership;
create policy "ownership_select_own" on property_ownership for select
  using (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));
drop policy if exists "ownership_insert_own" on property_ownership;
create policy "ownership_insert_own" on property_ownership for insert
  with check (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));
drop policy if exists "ownership_update_own" on property_ownership;
create policy "ownership_update_own" on property_ownership for update
  using (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));

drop policy if exists "ownership_select_admin" on property_ownership;
create policy "ownership_select_admin" on property_ownership for select
  using (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));
drop policy if exists "ownership_insert_admin" on property_ownership;
create policy "ownership_insert_admin" on property_ownership for insert
  with check (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));
drop policy if exists "ownership_update_admin" on property_ownership;
create policy "ownership_update_admin" on property_ownership for update
  using (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));
drop policy if exists "ownership_insert_admin" on property_ownership;
create policy "ownership_insert_admin" on property_ownership for insert
  with check (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));
drop policy if exists "ownership_update_admin" on property_ownership;
create policy "ownership_update_admin" on property_ownership for update
  using (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));

-- property_documents: via parent property's owner_id
drop policy if exists "docs_select_own" on property_documents;
create policy "docs_select_own" on property_documents for select
  using (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));
drop policy if exists "docs_insert_own" on property_documents;
create policy "docs_insert_own" on property_documents for insert
  with check (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));
drop policy if exists "docs_delete_own" on property_documents;
create policy "docs_delete_own" on property_documents for delete
  using (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));
drop policy if exists "docs_update_own" on property_documents;
create policy "docs_update_own" on property_documents for update
  using (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));

drop policy if exists "docs_select_admin" on property_documents;
create policy "docs_select_admin" on property_documents for select
  using (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));
drop policy if exists "docs_insert_admin" on property_documents;
create policy "docs_insert_admin" on property_documents for insert
  with check (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));
drop policy if exists "docs_delete_admin" on property_documents;
create policy "docs_delete_admin" on property_documents for delete
  using (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));
drop policy if exists "docs_update_admin" on property_documents;
create policy "docs_update_admin" on property_documents for update
  using (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));

-- tasks: owners can only VIEW their property's tasks. Creating, updating,
-- or deleting a task is admin-only (see admin policies below) — customers
-- get read-only visibility into progress/status, matching the product
-- decision that task scheduling is an admin/agent responsibility.
drop policy if exists "tasks_select_own" on tasks;
create policy "tasks_select_own" on tasks for select
  using (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));

-- admins: can create/view/update tasks on any property (e.g. scheduling an inspection)
drop policy if exists "tasks_select_admin" on tasks;
create policy "tasks_select_admin" on tasks for select
  using (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));
drop policy if exists "tasks_insert_admin" on tasks;
create policy "tasks_insert_admin" on tasks for insert
  with check (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));
drop policy if exists "tasks_update_admin" on tasks;
create policy "tasks_update_admin" on tasks for update
  using (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));
drop policy if exists "tasks_delete_admin" on tasks;
create policy "tasks_delete_admin" on tasks for delete
  using (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));

-- task_media: owners can VIEW media (part of "read-only progress"), but
-- uploading or deleting media is admin-only, matching the task-mutation rule.
drop policy if exists "task_media_select_own" on task_media;
create policy "task_media_select_own" on task_media for select
  using (exists (
    select 1 from tasks t join properties p on p.id = t.property_id
    where t.id = task_id and p.owner_id = auth.uid()
  ));
drop policy if exists "task_media_select_admin" on task_media;
create policy "task_media_select_admin" on task_media for select
  using (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));
drop policy if exists "task_media_insert_admin" on task_media;
create policy "task_media_insert_admin" on task_media for insert
  with check (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));
drop policy if exists "task_media_delete_admin" on task_media;
create policy "task_media_delete_admin" on task_media for delete
  using (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));

-- renewal_requests: owner can create/view requests for their own property;
-- admin can view and decide (approve/reject/modify) any request.
drop policy if exists "renewals_select_own" on renewal_requests;
create policy "renewals_select_own" on renewal_requests for select
  using (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));
drop policy if exists "renewals_insert_own" on renewal_requests;
create policy "renewals_insert_own" on renewal_requests for insert
  with check (
    requested_by = auth.uid()
    and exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid())
  );
drop policy if exists "renewals_select_admin" on renewal_requests;
create policy "renewals_select_admin" on renewal_requests for select
  using (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));
drop policy if exists "renewals_update_admin" on renewal_requests;
create policy "renewals_update_admin" on renewal_requests for update
  using (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin));

-- payments: owner can view (read-only) their own property's payment
-- history; only admin can create or update payment records.
drop policy if exists "payments_select_own" on payments;
create policy "payments_select_own" on payments for select
  using (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));
drop policy if exists "payments_select_admin" on payments;
create policy "payments_select_admin" on payments for select
  using (is_admin());
drop policy if exists "payments_insert_admin" on payments;
create policy "payments_insert_admin" on payments for insert
  with check (is_admin());
drop policy if exists "payments_update_admin" on payments;
create policy "payments_update_admin" on payments for update
  using (is_admin());

-- Lets the property owner submit their own subscription payment proof
-- (plan, method, transaction ID, screenshot) — but the "with check"
-- constrains every such write to STAY status='pending', so a customer
-- can never set their own payment to 'completed' or otherwise grant
-- themselves validity; only payments_update_admin above can do that.
drop policy if exists "payments_update_own" on payments;
create policy "payments_update_own" on payments for update
  using (
    status = 'pending'
    and exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid())
  )
  with check (
    status = 'pending'
    and exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid())
  );
drop policy if exists "payments_insert_own" on payments;
create policy "payments_insert_own" on payments for insert
  with check (
    status = 'pending'
    and exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid())
  );

-- helper: is the current user the agent (via profiles.id) on this job?
-- Used repeatedly below instead of repeating the join.
create or replace function is_my_agent_job(job_agent_id uuid) returns boolean
language sql stable as $$
  select job_agent_id = auth.uid();
$$;

-- agent_profiles: an agent can see/update their own row; admin sees/updates all.
drop policy if exists "agent_profiles_select_own" on agent_profiles;
create policy "agent_profiles_select_own" on agent_profiles for select using (auth.uid() = id);
drop policy if exists "agent_profiles_insert_own" on agent_profiles;
create policy "agent_profiles_insert_own" on agent_profiles for insert with check (auth.uid() = id);
drop policy if exists "agent_profiles_update_own" on agent_profiles;
create policy "agent_profiles_update_own" on agent_profiles for update using (auth.uid() = id);
drop policy if exists "agent_profiles_select_admin" on agent_profiles;
create policy "agent_profiles_select_admin" on agent_profiles for select using (is_admin());
drop policy if exists "agent_profiles_update_admin" on agent_profiles;
create policy "agent_profiles_update_admin" on agent_profiles for update using (is_admin());

-- agent_documents: owner agent can manage their own; admin can view all.
drop policy if exists "agent_documents_select_own" on agent_documents;
create policy "agent_documents_select_own" on agent_documents for select
  using (agent_id = auth.uid());
drop policy if exists "agent_documents_insert_own" on agent_documents;
create policy "agent_documents_insert_own" on agent_documents for insert
  with check (agent_id = auth.uid());
drop policy if exists "agent_documents_update_own" on agent_documents;
create policy "agent_documents_update_own" on agent_documents for update
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());
drop policy if exists "agent_documents_select_admin" on agent_documents;
create policy "agent_documents_select_admin" on agent_documents for select using (is_admin());

-- monitoring_jobs: the assigned agent can see/update their own jobs;
-- the property owner (customer) can view read-only; admin has full access.
drop policy if exists "monitoring_jobs_select_agent" on monitoring_jobs;
create policy "monitoring_jobs_select_agent" on monitoring_jobs for select
  using (is_my_agent_job(agent_id));
drop policy if exists "monitoring_jobs_update_agent" on monitoring_jobs;
create policy "monitoring_jobs_update_agent" on monitoring_jobs for update
  using (is_my_agent_job(agent_id));
drop policy if exists "monitoring_jobs_select_owner" on monitoring_jobs;
create policy "monitoring_jobs_select_owner" on monitoring_jobs for select
  using (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));
drop policy if exists "monitoring_jobs_select_admin" on monitoring_jobs;
create policy "monitoring_jobs_select_admin" on monitoring_jobs for select using (is_admin());
drop policy if exists "monitoring_jobs_insert_admin" on monitoring_jobs;
create policy "monitoring_jobs_insert_admin" on monitoring_jobs for insert with check (is_admin());
drop policy if exists "monitoring_jobs_update_admin" on monitoring_jobs;
create policy "monitoring_jobs_update_admin" on monitoring_jobs for update using (is_admin());

-- monitoring_media: agent can view/upload for their own job; owner can view
-- read-only (once available); admin has full access.
drop policy if exists "monitoring_media_select_agent" on monitoring_media;
create policy "monitoring_media_select_agent" on monitoring_media for select
  using (exists (select 1 from monitoring_jobs j where j.id = job_id and is_my_agent_job(j.agent_id)));
drop policy if exists "monitoring_media_insert_agent" on monitoring_media;
create policy "monitoring_media_insert_agent" on monitoring_media for insert
  with check (exists (select 1 from monitoring_jobs j where j.id = job_id and is_my_agent_job(j.agent_id)));
drop policy if exists "monitoring_media_delete_agent" on monitoring_media;
create policy "monitoring_media_delete_agent" on monitoring_media for delete
  using (exists (select 1 from monitoring_jobs j where j.id = job_id and is_my_agent_job(j.agent_id)));
drop policy if exists "monitoring_media_select_owner" on monitoring_media;
create policy "monitoring_media_select_owner" on monitoring_media for select
  using (exists (
    select 1 from monitoring_jobs j join properties p on p.id = j.property_id
    where j.id = job_id and p.owner_id = auth.uid()
  ));
drop policy if exists "monitoring_media_select_admin" on monitoring_media;
create policy "monitoring_media_select_admin" on monitoring_media for select using (is_admin());

-- monitoring_upload_tokens: only relevant for admin access through the
-- normal authenticated app. The public /m/[token] magic-link page never
-- goes through this RLS at all — it uses a service-role client (see
-- lib/supabase/admin.ts) specifically because an anonymous visitor with
-- just a token can't satisfy any auth.uid()-based policy.
drop policy if exists "monitoring_upload_tokens_select_admin" on monitoring_upload_tokens;
create policy "monitoring_upload_tokens_select_admin" on monitoring_upload_tokens for select using (is_admin());
drop policy if exists "monitoring_upload_tokens_insert_admin" on monitoring_upload_tokens;
create policy "monitoring_upload_tokens_insert_admin" on monitoring_upload_tokens for insert with check (is_admin());
drop policy if exists "monitoring_upload_tokens_delete_admin" on monitoring_upload_tokens;
create policy "monitoring_upload_tokens_delete_admin" on monitoring_upload_tokens for delete using (is_admin());

-- properties: give an agent row-level SELECT only on properties they have
-- a monitoring job for. Uses a SECURITY DEFINER function rather than a
-- plain subquery — a plain subquery here would query monitoring_jobs,
-- whose own RLS policy queries properties right back, and Postgres
-- detects that as infinite recursion (42P17) the moment ANY query touches
-- storage.objects (since another bucket's policy also joins properties).
-- The function's internal query bypasses RLS, breaking the cycle.
-- NOTE this is row-level, not column-level — the app queries only fetch
-- property_name/address/GPS for the agent UI, but a crafted API call
-- could technically read the full row via this policy. Acceptable for
-- this app's scale/threat model; tighten with a dedicated view if that
-- ever matters.
create or replace function is_assigned_agent_for_property(p_id uuid) returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from monitoring_jobs j where j.property_id = p_id and j.agent_id = auth.uid()
  );
$$;

drop policy if exists "properties_select_assigned_agent" on properties;
create policy "properties_select_assigned_agent" on properties for select
  using (is_assigned_agent_for_property(id));

-- =========================================================
-- Storage buckets (run once) + policies
-- =========================================================
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('identity-proofs', 'identity-proofs', false),
  ('property-documents', 'property-documents', false),
  ('property-photos', 'property-photos', false),
  ('task-media', 'task-media', false),
  ('agent-documents', 'agent-documents', false),
  ('monitoring-media', 'monitoring-media', false)
on conflict (id) do nothing;

-- avatars / identity-proofs: path is {user_id}/filename -> first path segment = auth.uid()
drop policy if exists "avatars_owner_rw" on storage.objects;
create policy "avatars_owner_rw" on storage.objects for all
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "identity_proofs_owner_rw" on storage.objects;
create policy "identity_proofs_owner_rw" on storage.objects for all
  using (bucket_id = 'identity-proofs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'identity-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

-- property-documents / property-photos / task-media: path is {property_id or task_id}/filename
-- these need the join checks below rather than a plain foldername match
drop policy if exists "property_documents_owner_rw" on storage.objects;
create policy "property_documents_owner_rw" on storage.objects for all
  using (
    bucket_id = 'property-documents'
    and exists (
      select 1 from properties p
      where p.id::text = (storage.foldername(name))[1] and p.owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'property-documents'
    and exists (
      select 1 from properties p
      where p.id::text = (storage.foldername(name))[1] and p.owner_id = auth.uid()
    )
  );

drop policy if exists "property_photos_owner_rw" on storage.objects;
create policy "property_photos_owner_rw" on storage.objects for all
  using (
    bucket_id = 'property-photos'
    and exists (
      select 1 from properties p
      where p.id::text = (storage.foldername(name))[1] and p.owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'property-photos'
    and exists (
      select 1 from properties p
      where p.id::text = (storage.foldername(name))[1] and p.owner_id = auth.uid()
    )
  );

drop policy if exists "task_media_owner_rw" on storage.objects;
create policy "task_media_owner_rw" on storage.objects for all
  using (
    bucket_id = 'task-media'
    and exists (
      select 1 from tasks t join properties p on p.id = t.property_id
      where t.id::text = (storage.foldername(name))[1] and p.owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'task-media'
    and exists (
      select 1 from tasks t join properties p on p.id = t.property_id
      where t.id::text = (storage.foldername(name))[1] and p.owner_id = auth.uid()
    )
  );

-- agent-documents: path is {agent_id}/filename -> agent owns their own folder; admin reads all
drop policy if exists "agent_documents_owner_rw" on storage.objects;
create policy "agent_documents_owner_rw" on storage.objects for all
  using (bucket_id = 'agent-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'agent-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "agent_documents_admin_read" on storage.objects;
create policy "agent_documents_admin_read" on storage.objects for select
  using (bucket_id = 'agent-documents' and is_admin());

-- monitoring-media: path is {job_id}/filename -> only the assigned agent can write; agent/owner/admin can read
drop policy if exists "monitoring_media_agent_rw" on storage.objects;
create policy "monitoring_media_agent_rw" on storage.objects for all
  using (
    bucket_id = 'monitoring-media'
    and exists (
      select 1 from monitoring_jobs j
      where j.id::text = (storage.foldername(name))[1] and j.agent_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'monitoring-media'
    and exists (
      select 1 from monitoring_jobs j
      where j.id::text = (storage.foldername(name))[1] and j.agent_id = auth.uid()
    )
  );

drop policy if exists "monitoring_media_owner_read" on storage.objects;
create policy "monitoring_media_owner_read" on storage.objects for select
  using (
    bucket_id = 'monitoring-media'
    and exists (
      select 1 from monitoring_jobs j join properties p on p.id = j.property_id
      where j.id::text = (storage.foldername(name))[1] and p.owner_id = auth.uid()
    )
  );

-- Needed so a customer deleting their whole property (see
-- deletePropertyPermanently) can also clean up monitoring media files —
-- previously the owner could only read this bucket, not delete from it.
drop policy if exists "monitoring_media_owner_delete" on storage.objects;
create policy "monitoring_media_owner_delete" on storage.objects for delete
  using (
    bucket_id = 'monitoring-media'
    and exists (
      select 1 from monitoring_jobs j join properties p on p.id = j.property_id
      where j.id::text = (storage.foldername(name))[1] and p.owner_id = auth.uid()
    )
  );

drop policy if exists "monitoring_media_admin_read" on storage.objects;
create policy "monitoring_media_admin_read" on storage.objects for select
  using (bucket_id = 'monitoring-media' and is_admin());

-- =========================================================
-- Auto-create a minimal profile row on signup
-- =========================================================
-- Without this, properties.owner_id (FK -> profiles.id) fails until the
-- user completes the /onboarding KYC form. This trigger creates a stub
-- profiles row the moment someone signs up in Supabase Auth; the
-- onboarding form's `upsert` call later fills in the rest.
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (new.id, new.email, '', '')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

drop policy if exists "property_documents_admin_read" on storage.objects;
create policy "property_documents_admin_read" on storage.objects for select
  using (
    bucket_id = 'property-documents'
    and exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin)
  );

drop policy if exists "property_documents_admin_write" on storage.objects;
create policy "property_documents_admin_write" on storage.objects for insert
  with check (
    bucket_id = 'property-documents'
    and exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin)
  );

-- =========================================================
-- updated_at auto-touch trigger (shared by a few tables)
-- =========================================================
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_touch on profiles;
create trigger trg_profiles_touch before update on profiles
  for each row execute function touch_updated_at();

drop trigger if exists trg_properties_touch on properties;
create trigger trg_properties_touch before update on properties
  for each row execute function touch_updated_at();

drop trigger if exists trg_tasks_touch on tasks;
create trigger trg_tasks_touch before update on tasks
  for each row execute function touch_updated_at();

drop trigger if exists trg_payments_touch on payments;
create trigger trg_payments_touch before update on payments
  for each row execute function touch_updated_at();

drop trigger if exists trg_agent_profiles_touch on agent_profiles;
create trigger trg_agent_profiles_touch before update on agent_profiles
  for each row execute function touch_updated_at();

-- ---------- service_requests (customer support ticketing) ----------
do $$ begin
  create type service_request_status as enum ('open', 'closed');
exception when duplicate_object or duplicate_table then null; end $$;

create table if not exists service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  subject text not null,
  status service_request_status not null default 'open',
  closed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

-- First row per request holds the original description; every reply
-- (from either side) is just another row here, keeping the model simple.
create table if not exists service_request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  sender_role text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- Attachments hang off a message (not the request directly) so both the
-- original submission and any follow-up reply can carry files, following
-- the multi-file-per-field rule: file_path always includes a unique
-- suffix, and no single-file unique constraint exists here.
create table if not exists service_request_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references service_request_messages(id) on delete cascade,
  file_path text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_service_requests_customer on service_requests(customer_id);
create index if not exists idx_service_request_messages_request on service_request_messages(request_id);
create index if not exists idx_service_request_attachments_message on service_request_attachments(message_id);

alter table service_requests enable row level security;
alter table service_request_messages enable row level security;
alter table service_request_attachments enable row level security;

drop policy if exists "service_requests_select_own" on service_requests;
create policy "service_requests_select_own" on service_requests for select using (customer_id = auth.uid());
drop policy if exists "service_requests_select_admin" on service_requests;
create policy "service_requests_select_admin" on service_requests for select using (is_admin());
drop policy if exists "service_requests_insert_own" on service_requests;
create policy "service_requests_insert_own" on service_requests for insert with check (customer_id = auth.uid());
drop policy if exists "service_requests_update_own" on service_requests;
create policy "service_requests_update_own" on service_requests for update using (customer_id = auth.uid());
drop policy if exists "service_requests_update_admin" on service_requests;
create policy "service_requests_update_admin" on service_requests for update using (is_admin());

drop policy if exists "service_request_messages_select_own" on service_request_messages;
create policy "service_request_messages_select_own" on service_request_messages for select
  using (exists (select 1 from service_requests r where r.id = request_id and r.customer_id = auth.uid()));
drop policy if exists "service_request_messages_select_admin" on service_request_messages;
create policy "service_request_messages_select_admin" on service_request_messages for select using (is_admin());
drop policy if exists "service_request_messages_insert_own" on service_request_messages;
create policy "service_request_messages_insert_own" on service_request_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (select 1 from service_requests r where r.id = request_id and r.customer_id = auth.uid())
  );
drop policy if exists "service_request_messages_insert_admin" on service_request_messages;
create policy "service_request_messages_insert_admin" on service_request_messages for insert
  with check (sender_id = auth.uid() and is_admin());

drop policy if exists "service_request_attachments_select_own" on service_request_attachments;
create policy "service_request_attachments_select_own" on service_request_attachments for select
  using (exists (
    select 1 from service_request_messages m join service_requests r on r.id = m.request_id
    where m.id = message_id and r.customer_id = auth.uid()
  ));
drop policy if exists "service_request_attachments_select_admin" on service_request_attachments;
create policy "service_request_attachments_select_admin" on service_request_attachments for select using (is_admin());
drop policy if exists "service_request_attachments_insert_own" on service_request_attachments;
create policy "service_request_attachments_insert_own" on service_request_attachments for insert
  with check (exists (
    select 1 from service_request_messages m join service_requests r on r.id = m.request_id
    where m.id = message_id and r.customer_id = auth.uid()
  ));
drop policy if exists "service_request_attachments_insert_admin" on service_request_attachments;
create policy "service_request_attachments_insert_admin" on service_request_attachments for insert with check (is_admin());

insert into storage.buckets (id, name, public) values ('service-request-files', 'service-request-files', false)
on conflict (id) do nothing;

drop policy if exists "service_files_select_own" on storage.objects;
create policy "service_files_select_own" on storage.objects for select
  using (bucket_id = 'service-request-files' and exists (
    select 1 from service_requests r where r.id::text = (storage.foldername(name))[1] and r.customer_id = auth.uid()
  ));
drop policy if exists "service_files_select_admin" on storage.objects;
create policy "service_files_select_admin" on storage.objects for select
  using (bucket_id = 'service-request-files' and is_admin());
drop policy if exists "service_files_insert_own" on storage.objects;
create policy "service_files_insert_own" on storage.objects for insert
  with check (bucket_id = 'service-request-files' and exists (
    select 1 from service_requests r where r.id::text = (storage.foldername(name))[1] and r.customer_id = auth.uid()
  ));
drop policy if exists "service_files_insert_admin" on storage.objects;
create policy "service_files_insert_admin" on storage.objects for insert
  with check (bucket_id = 'service-request-files' and is_admin());

-- ---------- subscription_plans + payment_settings + payment proof fields ----------
create table if not exists subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric not null,
  validity_months integer not null default 12,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Singleton row: admin-configurable UPI/bank/QR shown on the customer
-- subscribe page.
create table if not exists payment_settings (
  id uuid primary key default gen_random_uuid(),
  upi_id text,
  bank_account_name text,
  bank_account_number text,
  bank_ifsc text,
  bank_name text,
  qr_code_image_path text,
  updated_at timestamptz not null default now()
);

alter table payments add column if not exists plan_id uuid references subscription_plans(id);
alter table payments add column if not exists screenshot_path text;

do $$ begin
  if not exists (select 1 from subscription_plans) then
    insert into subscription_plans (name, price, validity_months, display_order) values
      ('6-Month Plan', 999, 6, 1),
      ('1-Year Plan', 1799, 12, 2);
  end if;
end $$;

alter table subscription_plans enable row level security;
alter table payment_settings enable row level security;

drop policy if exists "subscription_plans_select_all" on subscription_plans;
create policy "subscription_plans_select_all" on subscription_plans for select using (true);
drop policy if exists "subscription_plans_write_admin" on subscription_plans;
create policy "subscription_plans_write_admin" on subscription_plans for all using (is_admin()) with check (is_admin());

drop policy if exists "payment_settings_select_all" on payment_settings;
create policy "payment_settings_select_all" on payment_settings for select using (true);
drop policy if exists "payment_settings_write_admin" on payment_settings;
create policy "payment_settings_write_admin" on payment_settings for all using (is_admin()) with check (is_admin());

insert into storage.buckets (id, name, public) values ('payment-info', 'payment-info', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('payment-proofs', 'payment-proofs', false) on conflict (id) do nothing;

drop policy if exists "payment_info_admin_write" on storage.objects;
create policy "payment_info_admin_write" on storage.objects for all
  using (bucket_id = 'payment-info' and is_admin()) with check (bucket_id = 'payment-info' and is_admin());

drop policy if exists "payment_proofs_owner_insert" on storage.objects;
create policy "payment_proofs_owner_insert" on storage.objects for insert
  with check (bucket_id = 'payment-proofs' and exists (
    select 1 from payments pay join properties p on p.id = pay.property_id
    where pay.id::text = (storage.foldername(name))[1] and p.owner_id = auth.uid()
  ));
drop policy if exists "payment_proofs_select" on storage.objects;
create policy "payment_proofs_select" on storage.objects for select
  using (bucket_id = 'payment-proofs' and (
    is_admin() or exists (
      select 1 from payments pay join properties p on p.id = pay.property_id
      where pay.id::text = (storage.foldername(name))[1] and p.owner_id = auth.uid()
    )
  ));

-- ---------- subscription_plans pricing: base price + discount, tracked separately ----------
-- price stays as the stored "current effective price for a first-time
-- purchase" (kept in sync by upsertPlan whenever base_price/discount
-- change), so any older code reading plan.price directly still works.
-- base_price + discount_percent are the source of truth for display
-- (struck-through base + badge + final) and are what admin actually
-- edits; renewal_discount_percent is optional and only overrides the
-- discount at renewal time — null means "same discount as first purchase".
alter table subscription_plans add column if not exists base_price numeric;
alter table subscription_plans add column if not exists discount_percent numeric not null default 0;
alter table subscription_plans add column if not exists renewal_discount_percent numeric;

-- Backfill any existing plans with no base_price yet: treat their current
-- price as the base with 0% discount, so nothing changes in the UI until
-- an admin actually sets a discount via the redesigned Plans page.
update subscription_plans set base_price = price where base_price is null;

-- ---------- reassign agent + EC-gated job completion ----------
do $$ begin
  alter type monitoring_job_status add value if not exists 'ec_pending';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type document_type add value if not exists 'ec_digital_copy';
exception when duplicate_object then null; end $$;

-- ---------- structured visit-report questions on monitoring_jobs ----------
alter table monitoring_jobs add column if not exists q_boundary_intact boolean;
alter table monitoring_jobs add column if not exists q_encroachment boolean;
alter table monitoring_jobs add column if not exists q_illegal_dumping boolean;
alter table monitoring_jobs add column if not exists q_vacant_as_expected boolean;
alter table monitoring_jobs add column if not exists q_unauthorized_construction boolean;
alter table monitoring_jobs add column if not exists q_boundary_markers_visible boolean;
alter table monitoring_jobs add column if not exists q_govt_notice_posted boolean;
alter table monitoring_jobs add column if not exists q_water_logging boolean;
alter table monitoring_jobs add column if not exists q_overall_condition text;
alter table monitoring_jobs add column if not exists q_attention_needed text;

-- ---------- admin remarks on monitoring jobs (visible on customer visit report) ----------
alter table monitoring_jobs add column if not exists admin_remarks text;
