# Plot360 — Component Architecture & Data Model

Source material: 10 hand-drawn wireframes (Home, Signup, Customer Registration x2,
Customer Dashboard, Plot Registration x3, Property View, Task View) mapped against
`project-instructions.md` (Next.js + Supabase, $0-cost, ~100 users / ~200 properties).

> Note: the uploaded `Plot360_Project_Documentation_and_Project_Plan.docx` did not
> actually attach to this conversation (only the 10 JPEG wireframes came through) — this
> build is based on the wireframes + project instructions. Re-upload the docx if it has
> requirements not visible on paper, and I'll fold in any gaps.

## 0. Design constraint — customer-facing screens are mobile-first

Everything under the customer app (`/dashboard`, `/properties/*`,
`/service-requests/*`, `/auth/*`) is used mostly on mobile browsers by
real customers, not desktop. This matters for two different reasons at
once: the design mock itself (`design_handoff_plot360_redesign/design/
Plot360 Customer.dc.html`) is drawn as a phone-width canvas, so its
markup often has no desktop layout considerations built in at all (see
section 19 — a row that's "full width" on a 375px canvas is not the
same as "full width" on a 1400px browser window); and any new layout
work should be checked at phone width first, with desktop as the
secondary case, not the other way around. When adapting a mock element
that assumes phone width (edge-to-edge rows, single-column stacks, no
hover states) for real desktop-browser use, prefer constraining it to
match the page's existing centered column rather than letting it run
full-bleed — see section 19 for a concrete example of getting this
wrong and fixing it.

## 1. Design principle: independent components, shared contracts

Each screen in the wireframes becomes a **self-contained feature module**:
its own DB table(s), its own storage bucket path, its own React components,
and its own server actions. Modules never reach into each other's tables directly —
they only share:

- **`profiles.id`** (= `auth.users.id`) as the universal owner key
- **`properties.id`** as the key that ties ownership docs, tasks, and media together
- A common `lib/supabase` client and a common `types/database.types.ts`

This means you can rebuild/redesign the Task module without touching Property
Registration, or swap the Dashboard's summary logic without touching Auth.

```
Home (public)
 └─ Signup ──────────────┐
 └─ Login                │
                          ▼
                 Customer Registration (KYC, one-time)
                          │
                          ▼
                 Customer Dashboard ◄────────────┐
                    │        │                   │
                    ▼        ▼                   │
         Plot Registration  Property View ───────┤
          (multi-step)      (read-only + map)     │
                    │                             │
                    ▼                             │
              Task List / Task History / Media ───┘
```

## 2. Component inventory (maps 1:1 to wireframes)

| # | Wireframe | Module folder | Table(s) owned | Storage bucket |
|---|-----------|---------------|-----------------|-----------------|
| 1 | Home page | `components/marketing` | — | — |
| 2 | Signup | `components/auth` | `auth.users` (Supabase managed) | — |
| 3 | Customer Registration 1 & 2 | `components/onboarding` | `profiles` | `avatars`, `identity-proofs` |
| 4 | Customer Dashboard | `components/dashboard` | reads `profiles`, `properties`, `tasks` | — |
| 5 | Plot Registration 1–3 | `components/properties/registration` | `properties`, `property_documents` | `property-documents` |
| 6 | Property View | `components/properties/view` | reads `properties` | `property-photos` |
| 7 | Task View / History / Media | `components/tasks` | `tasks`, `task_media` | `task-media` |

## 3. Database schema (Supabase Postgres)

See `supabase/schema.sql` for the runnable migration. Summary of tables:

### `profiles`
1:1 with `auth.users`. Holds everything from the two Customer Registration
wireframes: name parts, DOB, gender, phone (country code + number), current
vs. permanent address (kept as `jsonb` since it's a small fixed shape and avoids
8 extra columns), identity proof upload, security question/answer pair, "how did
you hear about us", terms/privacy acceptance timestamps.

### `properties`
One row per plot, matches the 3 "Plot Registration" pages: name, type
(residential/commercial/agricultural/industrial), size, shape, description,
full address block (street/local area/village/mandal/district/state +
registration office/village/area), a single "Plot GPS Coordinate" field, the
4-corner GPS box (`ne/se/nw/sw` lat+lng as `jsonb`), Google Map pin
(`lat`,`lng`), nearby landmark, `status` (`pending` / `verified` / `rejected`),
`registration_date`, `expiration_date` (drives the dashboard's "renew" flow).

### `property_ownership`
The "Proofs of ownership" screen: owner name, whether the registering user is
the plot owner, whether they authorize the field agent to enter/photograph,
and the legal declarations (no legal/criminal case, agent-entry consent, free-text
"other terms"). Kept separate from `properties` because it's filled once and
rarely edited, and because NOC/approval-letter uploads only apply to the
"owner is someone else" branch.

### `property_documents`
Generic document table (`doc_type` enum: `title_deed`, `encumbrance_certificate`,
`noc`, `approval_letter`, `owner_id`, `ownership_proof`) — one row per uploaded
file, pointing at a path in the `property-documents` bucket. Generic table
instead of one column per doc type so new document types don't need schema
migrations.

### `tasks` / `task_media`
Matches "Task View": task name/type, status (`not_done` / `in_progress` /
`complete`), start/completed dates, free-text notes; `task_media` is one row
per photo/video with `media_type`.

## 4. Storage buckets & RLS

| Bucket | Path convention | Access rule |
|---|---|---|
| `avatars` | `{user_id}/profile.jpg` | owner read/write only |
| `identity-proofs` | `{user_id}/{doc}.pdf` | owner read/write only |
| `property-documents` | `{property_id}/{doc_type}.pdf` | owner (via `properties.owner_id`) read/write |
| `property-photos` | `{property_id}/{filename}` | owner read/write; public read optional per-property |
| `task-media` | `{task_id}/{filename}` | owner (via `tasks → properties.owner_id`) read/write |

Every table has RLS enabled with a policy of the shape
`auth.uid() = owner_id` (or a join to `properties.owner_id` for `tasks`,
`task_media`, `property_documents`, `property_ownership`). Full policies are in
`supabase/schema.sql`.

## 5. Integration pattern (used identically by every module)

Each feature folder follows the same 3-file shape so any one module can be
regenerated independently:

```
components/<module>/
  <Module>Form.tsx      -- client component, controlled inputs, calls action
  <module>.actions.ts   -- 'use server' functions: insert/update/delete via supabase server client
  <module>.types.ts     -- narrows database.types.ts to just this module's shape
```

Data flow: `Form` (client) → `actions.ts` (server action, validates + calls
Supabase) → Postgres (RLS-checked) → `revalidatePath()` → UI refresh. No API
routes needed for CRUD — Next.js server actions talk to Supabase directly,
keeping the stack to exactly what's in the project instructions (no extra
backend layer).

## 6. Free-tier flags

- All file uploads should be compressed client-side (images) before upload —
  200 properties × a handful of documents each will stay well within Supabase's
  1GB free storage, but **task videos are the one item to watch**; if a
  property owner uploads raw phone video, offload to Cloudinary per the
  project instructions once video volume grows.
- Supabase free tier pauses projects after 7 days of inactivity — fine for a
  ~100 user app in active use, worth knowing if this sits idle during development.

## 7. Redesign 2026-09 — foundation (branch `feat/redesign-2026-09`)

Source material: `design_handoff_plot360_redesign/README.md` (5 surfaces —
landing, customer app, agent app, admin console, visit report — plus a
commercial-model change: subscriptions → visit credits). Being built in
phases; this section covers the **data-model foundation** phase only —
no UI changed yet. See that README's "Product model" and "Data" sections
for the full spec this maps onto the existing tables.

Mapping decisions (all additive — nothing existing was dropped or renamed):

| Redesign concept | Where it actually lives |
|---|---|
| `visit_credits` | New table. Ledger (quantity_purchased/used, expiry, one-time extension) that replaces counting approved jobs since `payments.valid_from` |
| `visits` | **`monitoring_jobs`**, extended (`visit_number`, `requested_window_start/end`, `gps_distance_meters`, `flagged`, `visit_credit_id`) — it already had the agent/property/status/the-ten-checks shape the redesign asks for |
| `visit_answers` | Already `monitoring_jobs`' `q_*` columns — `lib/visitReportQuestions.ts` is the source of truth for the ten keys/labels, per the handoff |
| `visit_media` | **`monitoring_media`**, extended with `boundary_side` (N/E/S/W) |
| `agent_upload_links` | **`monitoring_upload_tokens`**, extended with `consumed_at` |
| `whatsapp_messages` | New table — an outbox **log**, not a send API: the app only ever opens a `wa.me` link for a human to send (`components/admin/whatsapp.ts`), so "sent" is logged on open and "failed" is an admin's manual correction. This is what will power the redesigned dashboard's failed-message list + Resend |
| `admin_actions` | New table — internal-only timeline, never customer-visible |
| `bans` | New table — customer bans still work via Supabase Auth `ban_duration` (`components/admin/users.actions.ts`); this table adds agent banning (nothing did that before) and gives both a shared row so the Users list and an agent's own detail page can't disagree |
| `enquiries` | New table — the landing page's call-back form. Public insert, admin-only read |
| Plans: visits per plan | `subscription_plans.visit_quantity` (new column; `validity_months` is kept but now means "credit validity," not subscription length) |
| Property: EC requested | Already `property_ownership.ec_digital_copy_requested` — no change needed |

New TypeScript types for all of the above are in `types/database.types.ts`.
Pure helpers over the `visit_credits` ledger (remaining count, expiry
warnings, which credit a new visit should draw from, scheduling
eligibility) are in `lib/visitCredits.ts` — written now so the customer,
agent, and admin phases all read/write credits the same way instead of
each inventing their own math.

Not done yet (later phases, per the redesign's own screen list): the
landing page, the customer/agent/admin UI and their server actions
actually reading/writing `visit_credits` instead of the old payment-cycle
count, wiring `whatsapp_messages`/`admin_actions` writes into the existing
action files, the four-milestone customer-facing status mapping, and the
4-page A4 report template.

## 8. Redesign 2026-09 — landing page

Public marketing home page (`components/marketing/LandingPage.tsx`),
ported 1:1 from `design/Plot360 Landing.dc.html`, wired in at `app/page.tsx`
(replacing the old embedded-login home page — login moved to its own
`/login` route, see `app/login/page.tsx`). Contact placeholders
(WhatsApp/phone/email/representative name) live in `lib/contact.ts` —
swap before launch.

## 9. Redesign 2026-09 — customer app

Source: `design/Plot360 Customer.dc.html`. Covers registration, plans/
payment, the Home screen, the property visit-history screen, and
self-service scheduling. Visit Report viewer and Service Request screens
were left untouched this phase (already functional; not part of this
pass) — still reachable from the new screens via their existing routes.

**Registration is now two tracks, both kept:**
- `createProperty` (existing) — full detail, still used by `/properties/
  [id]/edit` and the admin edit routes.
- `createPropertyQuick` (new, same file) — only `property_name` required;
  wired to the new `/properties/new` page (`RegisterQuick.tsx`). Everything
  the old flow required up front (SRO, address, ownership proof,
  documents) is now collected **later**, by a representative, via the
  existing (unmodified) `/admin/[id]/edit`, `/admin/[id]/ownership` and
  `/admin/[id]/documents` admin pages — matching the design's own
  confirmation copy ("Rajesh will contact you… for documents and owner
  approval"). This was an explicit product decision (asked via
  clarifying question, "match the design exactly") — `properties.property_type`
  is now nullable to allow it (see `supabase/schema.sql`).

**Plans/payment** (`ChoosePlanAndPay.tsx`, `components/payments/
visitCredits.actions.ts`, `purchaseVisitCredits`): reads real, admin-
configured `subscription_plans` rows (extended `PlansSettingsPage.tsx`
with a `visit_quantity` field) rather than hardcoding the design mock's
₹2,499/₹8,999 — **an admin needs to configure at least one active plan
with `visit_quantity` 1 and one with 4** for the screen to show the
design's two options. UPI is a simulated instant activation (no live
gateway); it creates a `payments` row (`status: 'completed'`) and a
`visit_credits` row immediately. Bank transfer creates a `payments` row
(`status: 'pending'`) only — an admin confirming it today (`recordPayment`
in `components/payments/payments.actions.ts`) does **not** yet create the
matching `visit_credits` row; that wiring is left for the admin console
phase.

**Self-service scheduling is a new `visit_requests` table, not a direct
`monitoring_jobs` insert** — `monitoring_jobs.agent_id` is `NOT NULL`
(every job has always needed an admin-picked agent) and its assignment
logic (`getEligiblePropertiesForAssignment`, `assignAgentToProperty` in
`components/admin/monitoring.actions.ts`) is subscription/validity-based
and untouched. `visit_requests` just records what the customer asked for
(property + window); turning an open request into a real `monitoring_jobs`
row (and marking it `assigned`) is admin console follow-up work. Calendar
math (weekday-only, 3-day lead time, 3/5/7-working-day windows) lives in
`lib/scheduling.ts`, generalized from the design mock's hardcoded
September 2026 example to the real current date.

**Home screen / property page**: `app/dashboard/page.tsx` and
`app/properties/[id]/page.tsx` now render `CustomerHome.tsx` and
`PropertyVisitHistory.tsx` (new, under `components/customer/`) instead of
`CustomerDashboard.tsx` and `PropertyView.tsx`/`MonitoringStatus.tsx` —
the old components are kept, just no longer wired into these routes, per
the redesign's "don't remove existing code" instruction. `TaskList`
still renders on the property page, deliberately **outside** the `.p360`
wrapper (see comment in `app/properties/[id]/page.tsx`) — it uses the old
global `.card`/`.field-label` classes, which read CSS custom properties
(`--color-accent` etc.) that `.p360` re-declares with different values;
nesting it inside `.p360` would leak the new red palette into that
untouched component.

**Confirmation screens**: one shared `ConfirmationScreen.tsx` with the
three built variants (`reg-upi`, `reg-bank`, `sched`) using the design's
exact WhatsApp message templates — a `service` variant for the Service
Request screen wasn't added since that screen is untouched this phase.

Not done yet: agent app, admin console (including the `visit_requests` →
`monitoring_jobs` assignment step and bank-transfer → `visit_credits`
confirmation noted above), the 4-page visit report PDF, and any deeper
redesign of the Visit Report viewer / Service Request screens.

## 10. Redesign 2026-09 — agent app

Source: `design/Plot360 Agent.dc.html`. Covers the jobs list and the
on-site capture screen (both the authenticated route and the no-login
magic-link route) — the core, highest-value part of this surface.
Signup, onboarding (full legal details + ID documents) and profile
editing were deliberately **not** redesigned this phase — see below.

**Capture is one shared component, two thin wrappers**: `AgentCaptureScreen.tsx`
renders the whole screen (GPS check, photo grid + progress, boundary-side
tagging, video, the ten checks, "before you submit" gates, submit,
and the inline "submitted" confirmation) and is used by both
`AgentCapture.tsx` (authenticated, `/agent/jobs/[id]`) and
`PublicCapture.tsx` (magic link, `/m/[token]`) — each just fetches its
job/media and binds the right server actions (`agent-jobs.actions.ts` vs
`magic-link.actions.ts`) before handing off. `AgentJobDetail.tsx` and
`PublicUploadForm.tsx` (the old, nearly-identical twins these replace)
are kept intact but no longer wired into either route.

**GPS: warn, never block** (`lib/geo.ts`) — the browser's geolocation is
compared to the property's recorded pin (Haversine distance); the result
is only ever recorded on submit (`monitoring_jobs.gps_distance_meters`,
`flagged` — both already existed from the foundation phase, unused until
now) and never prevents submitting, matching the design exactly. No
reference pin, or geolocation denied, shows a neutral message instead of
an error.

**Boundary sides are derived, not manual** — the design's own mock keeps
the "N/E/S/W covered" checklist as an independent set of checkboxes,
separate from the photo pool. This build ties it to real evidence
instead: uploading photos, an agent can optionally tag the batch with a
side (a select next to the file input), stored on
`monitoring_media.boundary_side` (also unused since the foundation
phase); the checklist shows a side as covered once at least one photo is
tagged for it. This was a deliberate deviation from the literal mock,
made to finally use that schema column and because a checklist backed by
actual tagged photos is more trustworthy for the eventual PDF report
(page 3, "photographs 2-up with captions") than an honor-system checkbox.

**Submit gates are client-side only** — the design wants the submit
button disabled until ≥8 photos, all four sides tagged, ≥1 video, and
all ten questions answered. That's implemented exactly as a UX gate in
`AgentCaptureScreen.tsx`. Server-side (`submitJobWork`, `submitByToken`)
still only requires at least one media item + all ten answers, unchanged
from before — hard-enforcing the full gate server-side was deliberately
left out to avoid silently bricking any legacy/edge-case job that
predates these rules; happy to add it if wanted.

**Jobs list** (`AgentJobsHome.tsx`, replacing `AgentJobList.tsx` at
`/agent/dashboard`): the Open/Rework/Completed count strip, then cards
for rework + open + submitted jobs (completed jobs are counted but not
shown as cards, matching the design). SRO and pin come from the
*property's* own `sro_name`/`sro_code`/`plot_gps_coordinate` (set at full
registration or added later by a representative — see the customer app
phase) rather than the agent's home SRO.

**Deliberately not redesigned this phase**: `AgentSignupForm.tsx`,
`AgentOnboardingForm.tsx` and `AgentProfileEditForm.tsx` keep their
current visual style and, more importantly, their current required
fields (full name, home address, SRO, agent photo, driving licence,
second government ID — all mandatory before an agent's account leaves
`pending`). The design's own signup mock is lighter (docs optional at
signup, added later), but given an agent visits and photographs private
property unsupervised, loosening that up is a product/compliance call
this pass didn't make unilaterally — flag it if the lighter flow is
actually wanted, the same way the customer registration flow's
simplification was an explicit decision earlier in this redesign.

Not done yet: admin console, the 4-page visit report PDF, and the agent
signup/onboarding/profile visual redesign noted above.

## 11. Redesign 2026-09 — admin console

Source: `design/Plot360 Admin.dc.html`. The biggest phase — six queues,
their detail screens, a shared rejection dialog, owner-only Plans &
pricing and Users, and the two follow-ups flagged at the end of §9
(`visit_requests` → real assignment, bank-transfer confirm → issuing
`visit_credits`). Old components (`AdminQueue.tsx`, `AdminReview.tsx`,
`MonitoringOverview.tsx`, `MonitoringJobReview.tsx`, `AgentReview.tsx`,
`PlansSettingsPage.tsx`, `AdminUsersList.tsx`, `components/layout/
AdminHeader.tsx`, and the routes that only they served —
`/admin/monitoring`, `/admin/renewals`) are all kept intact, just no
longer linked from the new nav (`AdminShell.tsx`) or wired into their
old routes.

**New routes**: `/admin` (Dashboard), `/admin/queue/{property-
verification,job-assignment,agent-submissions,agent-verification,
service-requests,payments}` (the six queues), `/admin/assign/[kind]/
[id]` (Assign screen; `kind` is `legacy`, `visit_request`, or `stuck`),
`/admin/payments/[id]` (Payment detail — new, doesn't collide with the
old `/admin/payments` index). **Reused, re-wired routes**: `/admin/[id]`,
`/admin/monitoring/[jobId]`, `/admin/agents/[id]`, `/admin/service-
requests/[id]`, `/admin/plans`, `/admin/users` now render new
components. `/admin/[id]/edit`, `/admin/[id]/ownership`, `/admin/[id]/
documents` are untouched and still the full editing flow.

**Owner vs operations role** — didn't exist before this phase; access
was purely `profiles.is_admin`. Added `profiles.admin_role` (`'operations'
| 'owner'`), gating Plans & pricing and Users **server-side**
(`getCurrentAdminContext`/`requireOwnerAdmin`, `components/admin/
admin-role.actions.ts`) per the design. Every admin that already existed
was backfilled to `'owner'` in the same migration so nobody loses access
they already had — only admins added after this migration default to
`'operations'` and need to be promoted by hand (no admin-creation UI
exists to do this from the app). Flagging this here the same way the
registration-scope and agent-onboarding decisions were flagged earlier
in this redesign — it's a real access-control change, just one designed
to be a no-op for every existing admin.

**Agent banning, implemented from scratch** — before this phase nothing
blocked a banned agent from working; `agent_profiles.status` only ever
took pending/verified/rejected. This wires the `bans` table (added,
unused, in the foundation phase) into real enforcement:
`agent-bans.actions.ts`'s `toggleAgentBan`/`isAgentBanned` read/write it,
`agent-auth.actions.ts`'s `agentLogIn`/`getAgentGateStatus` check it
(new `'banned'` gate status, handled on `/agent/dashboard`), and
`getVerifiedAgentsExcludingBanned`/`getSuggestedAgents` exclude banned
agents from assignment. The agent-detail Disable/Enable toggle and the
Users → Field agents row both call `toggleAgentBan` and both read
`isAgentBanned`/`getAgentsForUsersTab`, so there is exactly one flag —
the README's "one source of truth" requirement. Customer banning was
already fully implemented (Supabase Auth `ban_duration`) and is
untouched.

**WhatsApp outbox, implemented from scratch** — `whatsapp_messages`
existed in schema since the foundation phase but nothing wrote to it;
every "send" was a client-side `wa.me` link only. `whatsapp-log.
actions.ts` now logs a row (state `'sent'`) every time an admin action
opens one of those links (assignment, rejection, verification,
approval, payment mismatch), and the Dashboard's "Failed WhatsApp
messages" + each screen's "WhatsApp outbox" panel read from it. There is
no real WhatsApp Business API wired up (the design handoff's own
"placeholders to replace" note) — delivery status can't be detected
automatically, so, matching the schema's own comment, a message only
becomes `'failed'` when an admin explicitly marks it (`markWhatsApp
MessageFailed`); nothing does that automatically yet. This is a known
limitation, not a bug: it means the Dashboard's failed-message list will
stay empty until that manual flagging (or a real send integration) is
added.

**Internal timeline, implemented from scratch** — `admin_actions`
existed in schema, unused; `timeline.actions.ts`'s `logAdminAction` is
now called from every decision wrapper in `review-decisions.actions.ts`
(verify/reject a property, approve/reject a submission, verify an agent,
ban/unban, flag a payment mismatch), and `TimelineOutboxPanel.tsx`
renders it on the Property verification and Submission review screens.
Properties/jobs from before this phase simply show no internal history
— there's no synthesized backfill from `created_at`/`paid_at`/etc.

**Job assignment queue merges three origins** (`assignment.actions.ts`):
`getLegacyAssignmentTargets` (the untouched, existing subscription/
due-date model, `monitoring.actions.ts`'s `getEligiblePropertiesFor
Assignment`), `getVisitRequestAssignmentTargets` (open `visit_requests`
rows — the customer self-service scheduling flow from §9), and
`getStuckAssignmentTargets` (jobs already assigned but stuck — see
below). Assigning an agent to a `visit_request` (`assignAgentToTarget`)
is the wiring that was explicitly left as follow-up work in §9: it
creates a real `monitoring_jobs` row (`visit_number`,
`requested_window_start/end`, `visit_credit_id` carried over from the
request), marks the `visit_requests` row `'assigned'`, and links
`monitoring_job_id` back. **Suggested-agent ranking is new** too —
`getSuggestedAgents` matches `agent_profiles.sro_code` to the
property's, ranked by fewest currently open jobs (least loaded first),
ties broken by more completed visits; nothing like this existed before
(the old `getVerifiedAgentsList` was unranked and unfiltered by SRO).

**"Reassignment needed" — a third assignment kind, `'stuck'`** — the
pre-redesign `MonitoringOverview.tsx` (now unreferenced) had a separate
"Active assignments → Reassign" list for jobs stuck with their current
agent; the design's own Job assignment queue instead lists
`'Reassignment needed'` as a state *within* that one queue, not a
separate screen, so that's how this was wired: `getStuckAssignment
Targets` surfaces any `monitoring_jobs` row still `assigned`/`accepted`
past `STUCK_DAYS` (7) or its requested window, plus any `'rejected'`
row (the agent explicitly declined — always urgent regardless of age).
Picking a new agent for one of these routes through the same Assign
screen (`/admin/assign/stuck/[jobId]`) and dispatches to the existing,
untouched `reassignMonitoringJob` (which itself wipes the old agent's
partial uploads/upload link and re-opens the job as `'assigned'`),
followed by the same WhatsApp-log + timeline-log pattern used for the
other two kinds. This closes the capability gap the old component's
removal from the nav would otherwise have created.

**Bank-transfer payment confirm now issues `visit_credits`** — the
other follow-up flagged in §9. `recordPayment` (`components/payments/
payments.actions.ts`, untouched otherwise) now also inserts a
`visit_credits` row when the payment has a `plan_id` with a
`visit_quantity` and hasn't already had one issued (guarded against
double-issue). Legacy payments with no `plan_id` are skipped — the old
subscription model never used `visit_credits` at all. Payment mismatch
flagging (`flagPaymentMismatch`) is additive columns on `payments`
(`mismatch_reason`, `mismatch_flagged_at`, `mismatch_flagged_by`) rather
than a new status value, since `'pending'`/`'completed'` are relied on
elsewhere.

**Agent verification screen shows two documents, not four** — the
design mock shows Driving Licence + Aadhaar, front and back (four
cards). The real schema (`agent_documents.doc_type`) only ever collects
two: `driving_license`, `secondary_id`. Shown honestly as two rather
than fabricating a front/back split the data doesn't have.

**Deliberately not rebuilt, reused instead**: the Property verification
detail screen's document "Upload from WhatsApp"/"Replace" buttons and
the owned/not-owned ownership toggle are no-ops in the design's own mock
(`onClick={{noop}}`) — rather than inventing that logic, the screen
links out to the existing, fully-working `/admin/[id]/ownership` and
`/admin/[id]/documents` edit routes for anything beyond the inline-
editable location fields (street address, village/city, mandal, SRO,
map pin, plot size — genuinely new, `updatePropertyLocationFields`) and
the approve/reject decision itself.

**Queues are paginated/searched in memory** (`lib/adminQueue.ts` —
`paginate`, `matchesQuery`, `hoursSince`/`formatWait`/`isLate` for the
24-hour lateness rule) rather than with SQL `LIMIT`/`OFFSET` — reasonable
at this business's scale, worth revisiting if any queue grows into the
thousands of rows.

Not done yet: the agent signup/onboarding/profile visual redesign (still
open from §10), and real WhatsApp Business API delivery-status
integration (noted above). The visit report PDF is done — see §12.

## 12. Redesign 2026-09 — visit report PDF

Source: `design/Report-A-Record.dc.html`. A real, downloadable 4-page A4
PDF (3 pages when no EC copy was requested), generated on request at
`GET /properties/[id]/visit-report/[jobId]/pdf` — new route, new data
fetcher (`getVisitReportPdfData`, `components/properties/monitoring/
monitoring.actions.ts`), new builder (`lib/pdf/visitReportPdf.ts`). The
old print-HTML page at the sibling `/visit-report/[jobId]` route
(`PrintReportButton.tsx`, `getVisitReportData`) is untouched and still
reachable directly — this sits beside it, not over it, per the "don't
rewrite without asking" rule. `PropertyVisitHistory.tsx`'s "View report"
link now points here instead.

**Puppeteer → pdf-lib, a flagged deviation.** The handoff's own
instruction was "Puppeteer or similar." This uses `pdf-lib` instead, for
two concrete reasons: this sandbox cannot install *any* new package (the
npm registry 403s here — the same limitation that has blocked a full
`next build` all along), so whichever library was picked would only ever
be installed for real on the user's own machine regardless, and `pdf-lib`
is the lighter pick (pure JS, no Chromium download, serverless-friendly).
More importantly, page 4 needs to embed the customer's actual uploaded EC
file, which the upload form accepts as **either an image or a PDF** — a
headless-browser/print approach has no way to merge in someone else's PDF
pages, while `pdf-lib` can load and copy pages from an arbitrary existing
PDF directly. `pdf-lib` has been added to `package.json`; it needs a real
`npm install` on a machine with registry access before this route will
run — untestable end-to-end from this sandbox beyond the syntax checks
described in this file's own limitations note.

**Typography is Helvetica, not Archivo.** The design bundle has no font
file to embed and fetching Google Fonts from this sandbox isn't reliable,
so the PDF uses `pdf-lib`'s built-in Helvetica/Helvetica-Bold. Colours,
layout, rules, page structure and copy otherwise follow the mock
page-for-page (hand-laid-out with `pdf-lib`'s low-level draw API — there's
no CSS/flexbox layer, so text wrapping and row heights are computed
manually per block).

**Content that's genuinely computed, not fabricated.** The mock's prose
("Two items to note", "What changed since visit 1…") reads like an
admin wrote it by hand for that one example. Nothing in the schema
captures narrative like that, so it's derived instead:
- **Verdict** (page 1 three-up) — a count of "concerning" answers among
  the ten checks. The classification (`CONCERNING_WHEN_TRUE`/
  `CONCERNING_WHEN_FALSE`, now `isConcerningAnswer()`) used to live only
  in `SubmissionReviewScreen.tsx`; it's been lifted into `lib/
  visitReportQuestions.ts` so the admin screen's red-highlighting and the
  PDF's verdict/row-colouring can never drift apart. One side effect:
  `q_attention_needed` (when non-blank/non-"none") is now also
  highlighted on the admin screen, which it wasn't before — a small,
  deliberate consistency fix, not a regression.
- **Page 1 "Summary"** — auto-composed from the same ten answers (vacancy/
  boundary status, then a list of whichever checks came back concerning).
- **Page 2 "Plot360 review comments"** — `monitoring_jobs.admin_remarks`
  verbatim (the field `MonitoringDecision.tsx` already collects, "shown
  on the customer's visit report if approving"), falling back to "No
  additional remarks." This is the one place genuine human prose can
  appear, same as the design intends.
- **"What changed since visit N"** — a real diff against the immediately
  preceding approved/ec_pending job for the same property (compares all
  ten answers), rendered as a plain list of what changed rather than the
  mock's flowing paragraph — honest given there's no field for an admin
  to write that narrative by hand. Omitted entirely on visit 1.
- **Report code** (`P-XXXX`) and **field agent code** (`FA-XXX`) are
  deterministic values derived from the property/agent UUIDs, not stored
  identifiers — matches the mock's display format without adding columns.
  The agent's real name is deliberately never shown to the owner, same
  spirit as agents never seeing owner details elsewhere in this app.
- **"Owner verified" date** — the timestamp of that property's `'Verified'`
  entry in `admin_actions` (this admin phase's own timeline), omitted
  when none exists (properties verified before that phase shipped).

**EC annexure (page 4), three real outcomes**, not just the mock's single
"reproduced as received" placeholder: an uploaded **image** is embedded
inline in the page's box; an uploaded **PDF** gets a short note plus its
own pages copied in full immediately after page 4 (unnumbered — they're
the customer's own document, not renumbered as part of Plot360's 4
pages); and a **requested-but-not-yet-uploaded** EC (job status
`ec_pending`, viewable before the document arrives) shows an honest
"still being processed" notice instead of fabricating content. Page 4 is
omitted entirely (3-page PDF) when the customer never asked for an EC.

**Photographs are truncated to what fits one page**, exactly like the
mock's own "Six of eighteen photographs — the full set … in your Plot360
account" — the note text and shown/hidden counts are computed from the
same fixed-page-budget math that lays out the photo grid, so they can't
drift out of sync. Photos are embedded at their original colour (not
greyscale, per the design tokens' "photographs in greyscale" note) — no
image-processing dependency was added for a single cosmetic filter.

**Access control**: `getVisitReportPdfData` re-enforces the
approved/ec_pending gate itself (not just the caller), and relies on the
same RLS (`monitoring_jobs_select_owner` / `_select_admin`) as everything
else — a property owner sees their own reports, an admin can reach any
of them, anyone else gets a 404 rather than a leak of whether the job
exists.

## 13. Redesign 2026-09 — customer auth screens (follow-up fix)

**This was a real gap, not a new phase.** Section 9 above ("customer app
phase") only ever covered registration, plans/payment, Home, visit
history and scheduling — `/login` and `/signup` were quietly left
rendering the old pre-redesign `LoginForm`/`SignupForm`, and that
omission was never actually surfaced in this document's "not done yet"
list the way every other deferred piece was. Plot caught this by
screenshot (old grey login card vs. the design canvas) — this section
covers the fix.

Source: `design/Plot360 Customer.dc.html`, screens "Log in / sign up" and
"Confirm email" (the "New user — empty" screen is covered separately
below). New `components/auth/AuthScreen.tsx` renders both `/login` and
`/signup` now (a `initialTab` prop just picks which tab starts active —
the mock draws them as one screen with tabs, not two routes, so both
routes now show the same component). `LoginForm.tsx`, `SignupForm.tsx`
and `ForgotPasswordForm.tsx` are all kept completely untouched and still
exist, just no longer wired to a route — same pattern as everywhere else
in this redesign.

**Deviations from the literal mock — all functionally forced, not style
choices:**
- **Google / Facebook / WhatsApp OTP are now wired to real Supabase auth**
  (follow-up to the follow-up — see below): `signInWithOAuth` for Google/
  Facebook, and a small phone → code sub-flow calling new
  `sendPhoneOtp`/`verifyPhoneOtp` actions for WhatsApp. None of the three
  will actually succeed until Plot finishes the corresponding provider
  setup in the Supabase dashboard (a Google Cloud OAuth app, a Facebook
  OAuth app, and a Twilio account with WhatsApp enabled for phone auth) —
  until then they surface Supabase's real "provider not enabled"/
  equivalent error rather than pretending to work. `/auth/callback`
  (`app/auth/callback/page.tsx`) now checks whether the user's `profiles`
  row is already filled in before deciding `/dashboard` vs `/onboarding`,
  since OAuth/OTP logins (unlike email/password) route every login
  through that same page, not just the first one.
- **The signup tab keeps the site's Cloudflare Turnstile captcha**,
  which isn't in the mock at all — dropping it would remove the app's
  only bot-signup protection (`turnstile.server.ts` fails closed if it's
  missing). It sits right above the submit button.
- **The Confirm-email screen's primary button is a real "Resend" action**,
  not the mock's "I've confirmed — continue." That mock button just jumps
  to the next mock screen on click with nothing behind it; faking that
  for real would let someone into the app without ever actually
  confirming their email. New `resendConfirmationEmail` action
  (`components/auth/auth.actions.ts`) calls Supabase's real resend API.
- **A "Forgot email / password?" link is added on the login tab** (to the
  existing `/forgot-password` route) — not in the mock, but the app
  already has this flow and dropping the entry point would strand it.
- Signup's phone number field is new (the old `SignupForm` never asked
  for one) — stored on the `profiles` stub row that
  `handle_new_user`/`on_auth_user_created` already creates on signup,
  via `createAdminClient()` (email/password signup has no active session
  yet to write through normal RLS). Best-effort only: if
  `SUPABASE_SERVICE_ROLE_KEY` isn't set, the phone number is silently
  skipped rather than failing the signup — it can still be filled in
  later via onboarding/profile edit.
- `signUp()` (`auth.actions.ts`) now treats `confirmPassword` as optional
  (defaults to mirroring `password`) rather than required — the new
  screen has no separate "re-enter password" field, matching the mock.
  The old `SignupForm`, which still sends `confirmPassword`, is
  unaffected.
- One copy change: the mock's login-tab note text ("Social sign-in needs
  no confirmation link — we read your email and ask for a phone number
  once") reads like leftover signup copy in a real login context, so it
  was swapped for a plain "switch to Sign up" nudge instead. Flagging
  this since it's the one place text was changed rather than just
  behavior.

**"New user — empty" screen**: rather than a whole separate route, its
content (the "How it works" 4-step list) was added directly into
`CustomerHome.tsx`'s existing zero-properties branch, replacing the
one-line "No properties yet" placeholder text from the customer-app
phase — same screen, same data, just reached by state (no properties)
instead of a fixed route, since that's how the rest of `CustomerHome`
already works.

Not re-verified end-to-end against a live Supabase project (no working
`next build`/`npm run dev` in this sandbox — see the standing
build-verification note); please run through both tabs, a real signup,
and the resend button locally before trusting this in production.

## 14. Redesign 2026-09 — first real end-to-end test pass (follow-up fixes)

Plot ran `npm run dev` against a real Supabase project for the first time
and found several real gaps at once, by screenshot. All are fixed here;
none were caught by this sandbox's syntax-only `tsc --noResolve` check
(a live app + live database is the only thing that finds these).

**Old header on every customer page.** `app/dashboard/layout.tsx`,
`app/properties/layout.tsx`, `app/onboarding/layout.tsx`,
`app/profile/layout.tsx`, `app/tasks/layout.tsx` and
`app/service-requests/layout.tsx` each rendered the pre-redesign
`AppHeader.tsx` above their content — that's why even the correctly-
redesigned pages still showed the old white "Plot360 | Dashboard | Add
Property | Service Requests | ... | Log out" bar on top. New
`components/layout/CustomerHeader.tsx` is a `.p360`-styled replacement
with the same links/behavior, now wired into all six layouts.
`AppHeader.tsx` is untouched and still exists, just unwired. Note: the
design mock is phone-only and has no persistent top nav at all, so this
isn't "matching the mock" so much as reskinning a real desktop-app
necessity the mock never had to solve.

**Stray "+ Add property" link.** `CustomerHome.tsx`'s "Properties under
watch" header had a "+ Add property" link the mock doesn't have (the
mock just shows a property count next to the heading — the poster
header's own "Register a property" button already covers this). Removed,
replaced with the count.

**Property visit-history screen was a simplified stand-in, undisclosed.**
`PropertyVisitHistory.tsx` was originally a plainer adaptation of the
mock (no image header, no milestone track, no dotted timeline) and that
simplification was never flagged the way it should have been — same
class of gap as the auth screens in section 13. Rebuilt to match: back-
button header, a site-photo placeholder block (the mock itself is a flat
grey rectangle here — there's no real photo field on `properties` to
fill it with), the location/size line, the REGISTERED/VERIFIED/VISIT
SET/REPORT track (factored out to `lib/visitCredits.ts` —
`milestoneStage`/`MILESTONES` — so `CustomerHome.tsx` and this component
share one implementation instead of duplicating it), the visit-credits
row, and a dotted visit-history timeline whose per-visit note text comes
from the real `monitoring_jobs.observations` (completed visits) or
`admin_feedback` (sent-back visits) — not invented copy. The mock's
"P-1042" property code is cosmetic flavor text in the mock itself, not a
real field anywhere in this schema — shown here as `P-<first 4 chars of
the property's id>`, clearly a display shorthand, not an actual
registration number.

**Task list removed from the property page.** It used to render below
`PropertyVisitHistory`, kept because it was "an unrelated feature this
redesign doesn't touch" — Plot flagged directly that the design has no
task list on this screen at all and it read as leftover old design.
Removed from `app/properties/[id]/page.tsx` only; `TaskList.tsx` and the
`/tasks` route are both still fully intact.

**Registration step 1 didn't match the mock, and errored.** Two issues:
1. `RegisterQuick.tsx` didn't have the mock's back-button/step-counter
   header, progress bar, "Google map pin" field, or a real hyperlink on
   "terms and conditions" (previously plain unlinked text). Rebuilt to
   match; the map-pin field reuses the existing `plot_gps_coordinate`
   free-text column (already on `properties`, used by the full
   registration wizard) as a paste-a-coordinate/link fallback — flagged
   deviation, since there's no Maps API key configured for a real picker.
2. `Could not find the 'ec_interest' column of 'properties' in the schema
   cache` is **not a code bug** — `ec_interest` is declared correctly in
   both `supabase/schema.sql` and `registration.actions.ts`. This error
   means the redesign's `alter table` statements were never actually run
   against Plot's live Supabase project — `schema.sql` keeps growing
   rather than being rewritten, and the README's old "run it once"
   phrasing was misleading now that it's been added to multiple times
   since. README's setup section now says explicitly: re-run the whole
   file (it's idempotent) any time this error shows up.

**Real RLS bug in the UPI "instant activation" purchase flow.**
`purchaseVisitCredits`'s UPI branch (`components/payments/
visitCredits.actions.ts`) inserted a `payments` row with `status:
'completed'` and a `visit_credits` row, both through the normal user-
scoped client — but `payments_insert_own` only allows `status='pending'`
(only `payments_insert_admin` allows `'completed'`), and `visit_credits`
inserts are admin-only, full stop. Every real UPI purchase attempt hit
`new row violates row-level security policy`. Fixed by routing only
those two specific inserts through `createAdminClient()` (service role) —
the ownership and plan-validity checks earlier in the same function
already do the authorization a human admin would, so this is a
legitimately privileged write after manual authorization, the same
pattern already used elsewhere in this codebase (`lib/supabase/admin.ts`),
not a general RLS bypass. Bank transfer (`status: 'pending'`) was already
correct and untouched.

## 15. Redesign 2026-09 — Service Request screen

Source: `design/Plot360 Customer.dc.html`, "Service request" screen. This
was the one deferred piece that *was* disclosed at the time ("Visit
Report viewer and Service Request screens were left untouched this
phase" — section 9) rather than a silent gap — Plot has now asked for it
with the mock attached.

New `components/service-requests/ServiceRequestScreen.tsx` is one
combined screen (compose form + "Open requests" list) matching the mock,
which has no separate list-vs-new-request screens the way the old app
did. Both `app/service-requests/page.tsx` and `app/service-requests/
new/page.tsx` now render it — every existing internal link to either
route keeps working. `NewServiceRequestForm.tsx` and the old list markup
are untouched/unused, same pattern as the rest of this redesign.

Two deviations from the literal mock:
- **"Related property" is a real `<select>`** of the customer's own
  properties, not the mock's free-text input (its "Tukkuguda North" is
  just example placeholder text) — `property_id` has to reference an
  actual property row.
- **The list is filtered to non-closed requests**, matching the mock's
  "Open requests" heading exactly. The old page listed every request
  regardless of status; a closed request is still reachable at its own
  `/service-requests/[id]` URL (e.g. from its reply-notification email),
  just not listed on this screen anymore — flagging this narrowing in
  case Plot wants closed requests visible somewhere on this screen too.

## 16. Redesign 2026-09 (round 2) — dashboard header removed, "Schedule a
##     visit" toggle bug fixed

Plot's report: *"after login the page stillshow top cutsomer header and
theer is no schdule visit option"*. Two separate real bugs, both in code
introduced by the round-1 fix batch (section 14).

**"Schedule a visit" could disappear entirely.** `CustomerHome.tsx`'s
poster CTA used to be a single conditional slot: `schedulableProperty ?
"Schedule a visit" : "Register a property"` — it could only ever show
one, never both. An account with properties but none currently
schedulable (all still pending verification, rejected, or with visit
credits already used up) fell into neither branch's happy path — it got
"Register a property" instead of any way to schedule, book, or even see
its existing property. The mock (`design/Plot360 Customer.dc.html`,
"home" screen) never had a toggle here at all: it always draws a
full-width "Register a property →" button inside the red poster, and,
as a *separate* element below the poster, an always-visible three-way
"Schedule a visit | WhatsApp us | Call" toolbar row. Rebuilt
`CustomerHome.tsx`'s poster/CTA section to match that structure exactly
— both are now unconditional. "Schedule a visit" resolves to a real
target in every case: the ready-to-book property's `/schedule` page when
`schedulableProperty` exists, otherwise the customer's first property's
own page (to see status or buy more credits) if they have any property
at all, otherwise `/properties/new`. While rebuilding this section the
rest of the poster (wordmark/identity row, 56px credit number, divider,
description copy) was also brought in line with the mock's literal
markup, which round 1 had only loosely approximated.

**Persistent header still showing on `/dashboard`.** Round 1
(`CustomerHeader.tsx`, section 14) reskinned the old header rather than
removing it, reasoning the mock is phone-only and specifies no
desktop-web navigation to literally match. Plot's screenshot made clear
that reasoning doesn't hold — the mock's home screen has *zero*
persistent chrome above the red poster, full stop, reskinned or not.
`app/dashboard/layout.tsx` no longer renders `CustomerHeader`; the
poster's own top row (PLOT360 wordmark + identity) is now the first
thing on the page, matching the mock.

This is scoped to `/dashboard` only — the other 5 layouts
(`app/properties`, `app/onboarding`, `app/profile`, `app/tasks`,
`app/service-requests`) still render `CustomerHeader`. `/properties`
covers several sub-routes (`[id]/edit`, `/plan`, `/schedule`, `/renew`,
`/subscribe`, `/documents`, `/ownership`, `/visit-report/[jobId]`) that
predate this redesign and have no back button or navigation of their
own yet — pulling the header out from under them would stand up a new,
worse bug (nowhere to go at all) while fixing this one. `/onboarding`,
`/profile` and `/tasks` are in the same boat. `/service-requests`'s two
routes already have their own back-to-dashboard button
(`ServiceRequestScreen.tsx`) and could safely lose the header too, but
were left alone to keep this change to exactly what Plot reported;
flagging it as a good candidate for the next pass.

**Log out had no home once the header was gone.** The mock draws no
account actions anywhere on this screen — Plot360 as a phone app
presumably handles that at the OS/app-chrome level, which a browser tab
doesn't have. Added a small "Log out" text control next to the identity
text in the poster's top row (same small-caps styling), plus made the
identity text itself a link to `/profile/edit`. Both are deviations from
the literal mock, flagged as such — the alternative was leaving the
customer with no way to sign out of the app at all once
`CustomerHeader.tsx` stopped covering `/dashboard`.

## 17. Redesign 2026-09 (round 3) — "done" screen rebuilt to match the mock

Plot sent the mock's own "Transfer noted. We will confirm it." screenshot
(bank-transfer registration confirmation) and pointed out it ends with a
"Back to my properties" button going to the properties page — i.e. the
generic centered-checkmark card `ConfirmationScreen.tsx` had been showing
instead of this doesn't match. It never did: that component was an
original invention from the customer-app phase, not built from the
mock's own `s.done` screen (`design/Plot360 Customer.dc.html`,
`doneContent()`), which every registration/payment/scheduling flow in
the mock actually ends on.

Rebuilt `ConfirmationScreen.tsx` to match `doneContent()`'s structure
exactly: a full-bleed colored header (accent red for a completed UPI
payment or a scheduled visit, near-black "ink" for a pending bank
transfer — same red/black split the mock uses to mean "done" vs.
"waiting"), a kicker/title/body, a label-value rows table, a "WhatsApp
sent to `<number>`" preview box, a closing note, and one
`Back to my properties` button — no second "Open WhatsApp" button, which
the old version had but the mock doesn't: in the mock the WhatsApp
message is sent automatically by Plot360, not something the customer
opens themselves.

Three real fixes fell out of matching the mock this closely:
- **The WhatsApp line was showing the wrong phone number.** It's the
  *customer's own* masked number (`maskPhone()`, `components/customer/
  home.data.ts` — the same "9848 ••• 21" format as the Home poster), not
  Plot360's support line, which is what the old "Open WhatsApp"
  button/text used. `ChoosePlanAndPay` and `ScheduleVisit` (and the
  `/properties/[id]/plan` and `/properties/[id]/schedule` pages that
  render them) now fetch and pass the signed-in customer's own
  `maskedPhone` down to `ConfirmationScreen`.
- **The "Back to my properties" target was inconsistent.** The mock's
  `goHome` handler behind that button always returns to the Home screen
  regardless of which flow led there; `ScheduleVisit.tsx` used to
  override it to that one property's own page instead. Dropped the
  override — it now uses `ConfirmationScreen`'s own `/dashboard` default,
  same as the registration/payment flow always did.
- **The UPI transaction reference was computed and stored, then
  discarded.** `purchaseVisitCredits`'s UPI branch generated
  `transaction_reference` for the `payments` insert but never returned
  it, so the "Reference" row the mock's UPI success screen shows had
  nothing to display. Now returned as `reference` and threaded through
  to the rows table.

`ChoosePlanAndPay`'s bank-transfer variant also picked up `planName`
(needed for the rows table's "Plan" row, previously dropped when
building the confirmation state) and the UPI variant picked up
`visitQuantity` and `expiresAt` (needed for its "Visit credits" row) —
both were already being returned by `purchaseVisitCredits`, just not
carried through into the confirmation screen's props before.

## 18. Redesign 2026-09 (round 4) — header removed from every /properties
##     route; Schedule a visit and Choose a plan get their own back buttons

Plot's screenshots showed the old `PLOT360 | Dashboard | Add Property |
Service Requests ...` header still on top of `/properties/[id]/schedule`
— round 2 (section 16) only removed `CustomerHeader` from `/dashboard`,
deliberately leaving it on the other five layouts because several
`/properties` sub-routes had no back button of their own and would have
been stranded. `ScheduleVisit.tsx` was actually one of the *redesigned*
screens, just one that had never been given its own back button — an
oversight, not a case that needed the legacy header kept around.

Fixed properly this time: `app/properties/layout.tsx` no longer renders
`CustomerHeader` at all (same as `/dashboard`). The screens that were
missing their own navigation picked up what they needed instead of
losing it:
- `ScheduleVisit.tsx` and `ChoosePlanAndPay.tsx` — both `.p360`-styled,
  both already following this redesign's "back arrow + title" header
  pattern everywhere else (`RegisterQuick.tsx`, `PropertyVisitHistory.tsx`,
  `ServiceRequestScreen.tsx`) except here — now have that same header
  (`design/Plot360 Customer.dc.html`, "sched" and "reg2" screens: "←
  Schedule a site visit" / "← Choose a plan"), rather than falling back
  to the legacy `CustomerHeader`.
- The seven still-pre-redesign sub-pages that genuinely have no
  navigation of their own — `[id]/edit`, `/plan`'s payment settings
  lookup doesn't count (that one's `ChoosePlanAndPay`, now fixed above),
  `/renew`, `/subscribe`, `/documents`, `/ownership`,
  `/visit-report/[jobId]` — now import and render `CustomerHeader`
  directly themselves instead of inheriting it from the layout. Same
  header, same behavior, just declared at the page level so it doesn't
  leak onto the redesigned screens sharing that layout.

`/properties/new` (`RegisterQuick.tsx`) and `/properties/[id]`
(`PropertyVisitHistory.tsx`) already had their own back buttons and
needed no change — they simply stopped getting a second, redundant
header from the layout.

Net effect: no `/properties/*` route shows a persistent header anymore
unless the page itself asks for one, matching how `/dashboard` already
works and how the mock is built (every screen owns its own navigation,
nothing is layout-level chrome). `/onboarding`, `/profile` and `/tasks`
are still untouched (still pre-redesign, still get `CustomerHeader` from
their own layouts) — not part of what Plot reported this round.

The "done" screen after confirming a scheduled visit already goes to
`/dashboard` via its "Back to my properties" button — see section 17.
That was fixed in the previous round; Plot's screenshot describing a
"Back to home" button with a separate "Open WhatsApp" button was from
testing before that fix landed.

## 19. Redesign 2026-09 (round 5) — Home screen layout/typography fixes

Plot tested `/dashboard` on an actual desktop browser (not a phone-width
viewport) and caught two real layout bugs the mock, drawn phone-only,
never would have surfaced:

**The Schedule/WhatsApp/Call toolbar ran flush to the browser's edges
while everything else on the page sits in a centered 640px column.**
Both the poster above it and "Properties under watch" below it wrap
their content in `maxWidth: 640, margin: '0 auto'`; this row was copied
straight from the mock's markup, which has no such wrapper because the
mock's canvas *is* phone-width — full-bleed there just means "edge of
the screen," which is also "640px, centered" once the screen is wider
than 640px. On an actual desktop window the row stretched across the
whole viewport, visibly wider than and misaligned with the "Register a
property →" button directly above it. Wrapped it in the same
`maxWidth: 640, margin: '0 auto'` box — on a phone-width screen this is
a no-op (640px exceeds the viewport, so it still renders edge-to-edge),
on desktop it now lines up exactly under the button above it.

**"Properties under watch" was rendering as a large bold heading next
to a small unrelated number.** It was marked up as an `<h2>`, which
this codebase's global styles render large and bold by default — but
the mock (`design/Plot360 Customer.dc.html`, lines 141–144) draws it as
a 10px uppercase label, the exact same size, weight and color as the
property count sitting next to it; the two are a matched pair of small
eyebrow-style labels sharing a row, not a heading with a stray number.
Restyled to match — also dropped the count's `padStart(2, '0')`
zero-padding (e.g. showing "3" instead of "03"), which the mock doesn't
do either.

## 20. Redesign 2026-09 (round 6) — property card: status line, clickable
##     visit reports, per-segment milestone labels

Plot compared the Home screen's expanded property card against the mock
directly and found it missing real functionality, not just styling.

**No way to open a visit report from Home at all.** The expanded card's
primary button only ever offered "Schedule the next visit" or "Buy more
visit credits" — there was no path to a completed visit's report,
functionality the mock's own example properties lean on heavily (its
first two demo properties both lead with "Open visit N report" / "View
visit N report" as the primary action). Added: when a property has at
least one completed visit (`monitoring_jobs.status` `approved` or
`ec_pending`), an "Open visit N report" button now appears (N = the
most recent such visit), linking to the same `/properties/[id]/
visit-report/[jobId]` route `MonitoringStatus.tsx` already links to
elsewhere in the app. Unlike the mock, which only ever shows one
primary action, this button appears *alongside* "Schedule the next
visit" / "Buy more visit credits" rather than replacing it — flagged
deviation, since real customers can have both a report worth reading
and visits still worth scheduling at once, where the mock's fixed demo
data never needed to show both together.

**Visit chips weren't clickable.** Plot asked directly: clicking a
completed ("Done") visit's chip should open that visit's own report,
not just the general "Open visit N report" button above. This goes
beyond the mock itself — its chips are static, non-interactive demo
markup (`visits()` in the mock's script has no click handler at all) —
but maps naturally onto data already on hand, so `visitChips()` now
carries each chip's underlying `monitoring_jobs.id` and a "Done" chip
renders as a link to that job's own report page. "Set"/"Unused" chips
stay non-interactive, matching the mock (nothing exists yet to open).

**No status line above the chips.** The mock's expanded card leads with
a one-line status — "Visit 2 report ready", "Visit scheduled 22–25
Sep", "Representative collecting documents" — before the chips even
appear; the codebase had nothing here besides the rejection-reason
message for a rejected property. Added `propertyStatusLine()`, which
derives the same kind of line from real state (a completed report takes
priority, then an in-progress/scheduled visit, then "under review",
then "Representative collecting documents" for a still-pending
property) rather than the mock's fixed per-demo-property strings.

**The 4-stage milestone track only labeled the current stage.** The
mock labels all four segments at once ("Registered / Verified / Visit
set / Report", lines ~157–163) directly under their own bar segment;
this codebase had one caption below the whole bar naming only the
current stage. Restyled to label each segment individually, matching
the mock and Plot's own screenshot of this row.

## 21. Redesign 2026-09 (round 7) — off the red/orange accent: teal, rounded
##     corners, gradient hero cards

Plot sent a screenshot of the hero banner on facebook.com/developers (a
soft pastel gradient — pink → lavender → mint — with dark navy text and
rounded corners) and asked to move the app off its orange/red accent
color toward that look. Asked to scope it via two questions: how far
this should go, and which color should replace red/orange. Plot chose
the largest-effort option — a full redesign to match the aesthetic
(rounded corners app-wide, gradients on key surfaces, a lighter/darker
text balance instead of white-on-solid-color) — and a teal/mint solid
color for everywhere a flat accent is still needed.

**Token changes (`styles/plot360-redesign.css`).** `--color-accent` and
its `-100/-600/-700/-800` shades moved from a set of reds
(`#ec3013`/`#fff2ef`/`#dd2b0f`/`#ae1800`/`#7c1405`) to Tailwind's
teal-500/100/600/700/800, chosen so every existing rule that reads one
of these tokens — `.btn-primary`, `.tag-accent`, focus rings, link
color, the HOW_IT_WORKS numerals, every small badge/dot/square across
admin, agent and customer screens — repaints automatically with no
code changes. Added `--gradient-hero`, a teal-forward pastel gradient
for the app's few "hero card" surfaces (kept teal rather than copying
the reference's literal pink, so it reads as this app's own palette).
`--radius-md` went from `0` to `14px` and a new `--radius-lg: 24px` was
added for the big hero cards — a deliberate, flagged reversal of the
original "Modernist" mock's own zero-radius fidelity notes (see this
file's header comment in the CSS), since Plot's ask was specifically
for the rounded, soft aesthetic in the reference screenshot.

**Real bug found and fixed along the way: `--p-alert`.** `--p-alert`
(error/warning/destructive text — banned/flagged/late indicators in
admin, every form's validation message) was defined as
`var(--color-accent-700)`. That was harmless while the accent was red
(error text and "darkest accent" happened to be the same red), but
would have silently turned every error message teal the moment the
accent changed — a real correctness bug, not a styling one. Gave
`--p-alert` its own fixed value (`#dc2626`) independent of the accent,
verified safe against all ~35 usages across the app (`UsersTable.tsx`,
`PaymentDetail.tsx`, every `{error && <p style={{color:'var(--p-alert)'}}>}`
pattern in auth/customer/admin/agent forms). The same coupling existed
in `.p360 a:hover`, which read `--p-alert` for "hover = darker accent"
— now points at `--color-accent-700` directly, since leaving it on the
newly-independent `--p-alert` would have made every hovered link turn
red instead of a darker teal.

**Hero-card surfaces converted to the gradient treatment.** Three
surfaces that were solid-accent-colored bands got rebuilt as inset,
rounded `var(--gradient-hero)` cards with dark text, each requiring
manually flipping every child element's color assumptions (white-on-
dark → dark-on-pale):
- `components/customer/CustomerHome.tsx` — the Home dashboard poster.
  Folded the previously-separate Schedule/WhatsApp/Call toolbar row
  into the card itself as translucent-white pill buttons, rather than
  leaving it as a full-bleed row below — a flagged departure from the
  mock's literal layout, in service of the new aesthetic direction Plot
  explicitly asked for.
- `components/customer/ConfirmationScreen.tsx` — the "done" screens.
  The celebratory/complete variant (payment received, visit scheduled)
  now uses the gradient card; the bank-transfer "awaiting confirmation"
  variant keeps its original solid dark-ink background and white text
  (nothing there was coupled to the accent color) but is now inset and
  rounded too, so both variants read as the same family of card.
- `components/marketing/LandingPage.tsx` — the public landing page
  hero. Converted the primary CTA from an inverse button (light bg,
  accent text) to a solid `btn-primary`; the two outline CTAs from
  light-border/light-text to `var(--color-divider)`/`var(--color-text)`;
  the "Open your account" link from `nav-link-inverse` to plain
  `nav-link`; and the stats-row divider / placeholder-image border from
  the translucent on-dark rule to `var(--color-divider)`. The page's
  separate dark Contact section (`background: var(--color-text)`) was
  left untouched — it was never accent-colored, so it's outside this
  round's scope.

**Deliberately out of scope this round: `components/agent/
AgentCaptureScreen.tsx`.** Its own poster header is visually similar to
the customer Home poster but serves field agents, not customers, and
was left as a solid-teal band — it picks up the new accent color
automatically via the token change, but was not converted to the
gradient/rounded-card treatment. Flagging this explicitly rather than
silently skipping it; extending the same treatment there is a
reasonable follow-up if wanted.

**Not touched, verified safe to leave:** small decorative badges/dots/
squares that use `var(--color-accent)` as a flat background (admin
dashboard indicators, submission/verification detail screens, the
landing page's "sent" confirmation square, header notification-count
badges) — these are bullet-style markers, not surfaces, and repaint
teal automatically via the token change with no structural work
needed.

## 22. Redesign 2026-09 (round 8) — landing page header/nav polish, section
##     order, service cards, plan price footnote

Plot tested the redesigned marketing landing page directly and reported
five small issues:

**"Log in" was rendering as a plain text link next to two real
buttons.** The header had `Log in` as a `nav-link` (plain underlined
text) beside `Sign up` and `WhatsApp`, both real `.btn`s — it read as
missing a button rather than being one. Gave it the same outline-button
treatment as the hero's own secondary CTAs (`border: var(--color-
divider)`, `color: var(--color-text)`) so it reads as a third button,
not an afterthought.

**A rule between the PLOT360 logo row and the menu row.** The `<nav>`
had a `borderTop: 1px solid var(--color-divider)` Plot didn't want —
removed.

**"How it works" should come before "Services".** Swapped both the
page section order (`#how` now precedes `#services`) and the `MENU`
array that drives the top nav links, so the two stay in sync. Anchor
links (`href="#how"` from a service card's "See plans →") still resolve
correctly regardless of section order.

**Services should be individual cards with gaps, not a bordered
table.** The old grid shared borders between cells (`borderLeft` on the
container, `borderRight`/`borderBottom` on each cell, `gap: 0`) — this
was the "Modernist" mock's literal look, but read as one bordered table
rather than seven cards. Switched to the same `.card` class the rest of
the app now uses (bordered, rounded via `--radius-md`, `--color-
surface` background) with a real `gap: 18` between cards — consistent
with the rounded-corners direction from round 7.

**Plan prices needed a conditions asterisk.** Added a small `*` after
each plan's price (₹2,499*, ₹8,999*) and extended the footnote below
the plans grid: "Prices shown are indicative. Encumbrance certificate
available on request at registration. *Price may change based on plot
size and other factors." — the asterisk and the footnote sentence are
new; the original two sentences are unchanged.

## 23. Redesign 2026-09 (round 9) — landing page plan prices updated

Plot asked for the landing page's hardcoded plan prices to change: 1
site visit is now ₹1,999 (struck-through ₹2,499, was ₹2,499/₹2,999),
and 4 site visits is now ₹7,497 (struck-through ₹9,996, was ₹8,999/
₹11,996). Updated the `PLANS` array in `components/marketing/
LandingPage.tsx`, and also updated the Services section's "From
₹2,499" teaser (which pointed at the old 1-visit price) to "From
₹1,999" so the two stay consistent.

Note: this only changes the marketing landing page's own hardcoded
copy. The actual in-app purchase flow (`ChoosePlanAndPay.tsx`) reads
real prices from the admin-configured `subscription_plans` table, so
if these new prices should also apply to what a logged-in customer is
charged, that needs an update in the admin plans screen (or database),
not a code change.

## 24. Redesign 2026-09 (round 10) — onboarding form rebuilt as a single
##     page; database reset scripts added

Plot signed up with Google and landed on the old, pre-redesign "Customer
Registration" wizard (`/onboarding`) — a two-step form (username, DOB,
gender, profile picture, a full current + permanent address pair,
identity-proof upload, security questions) styled with the old
`field-label`/`field-input`/`btn-primary` classes, not `.p360`. This had
never been touched by the redesign; `app/auth/callback/page.tsx` routes
any user whose `profiles.first_name` is still empty here (a Postgres
trigger, `handle_new_user()`, creates the stub profile row on signup —
see `supabase/schema.sql`), so every genuinely new signup — social,
email, or WhatsApp OTP — hit it.

Rebuilt as one page, per Plot's spec: `components/onboarding/
CustomerRegistrationForm.tsx` now asks only for first/middle/last name,
a country-code list of values (`lib/countryCodes.ts`, ~195 countries,
defaulting to +91 — nothing like this existed anywhere in the app; the
redesigned login/signup screen's own phone field is free-text with no
selector) + phone number, and Terms/Privacy checkboxes that link out to
the existing `/legal/terms-of-use.html` / `/legal/privacy-policy.html`
pages, plus Submit and Cancel buttons (Cancel signs the user out via the
existing `logOut` action, using a second submit button's `formAction`
to override the form's default action). Matches the same `.p360`
card/field/btn system and "only ask what's required" philosophy as
`RegisterQuick.tsx` (the equivalent simplification already done for
property registration).

`components/onboarding/onboarding.actions.ts` (`saveCustomerRegistration`)
was cut down to match — no more address parsing, identity-proof storage
upload, or security-question handling — and now redirects straight to
`/dashboard` on success instead of showing an in-page "done" state,
consistent with how `createPropertyQuick` behaves. The dropped
`profiles` columns (address, DOB, gender, profile picture, identity
proof, security questions) are untouched in the schema and stay
nullable — nothing else in the app reads them yet, so removing them
from the signup form doesn't break anything downstream; a later phase
can still collect them the way property documents are collected
post-registration, by a representative.

`app/onboarding/layout.tsx` no longer wraps the page in the full
`CustomerHeader` (Dashboard / Add Property / Service Requests nav) —
none of those make sense before a profile even has a name, and
navigating away mid-onboarding left the account stuck being routed back
to `/onboarding` forever. The form now renders its own minimal PLOT360
header, the same pattern `ScheduleVisit.tsx`/`ChoosePlanAndPay.tsx` use.
`app/onboarding/page.tsx` was simplified to match — it no longer wraps
the form in the old `container-narrow` layout class, since the form is
now a self-contained `.p360` screen with its own max-width and padding.

Separately, added two ungenerated-by-the-app SQL scripts under
`scripts/` for cleaning up test/dev data directly in Supabase (not part
of the running application, not wired to any UI):
`delete-users.sql` (delete specific accounts by email, plus everything
that cascades from their properties) and `reset-database-keep-owner.sql`
(delete every account except one kept-by-email owner login, for
resetting the whole system to a fresh state). Both are transactional
with sanity-check `SELECT`s and guard checks against foreign-key
columns that don't cascade (`monitoring_jobs.assigned_by`,
`renewal_requests.requested_by`, `payments.recorded_by`, etc.) before
deleting; `reset-database-keep-owner.sql` commits itself in a single
run rather than relying on a separate manual `COMMIT;`, since
Supabase's SQL Editor doesn't reliably keep one transaction open across
two separate "Run" clicks (a real gotcha hit while testing this).

## 25. Redesign 2026-09 (round 11) — name field order; Edit Profile rebuilt
##     to match the new onboarding form, with password change added

Two follow-ups to round 10's onboarding rebuild:

**Name field order.** On `CustomerRegistrationForm.tsx`, first/middle/last
name were laid out as a responsive 3-column grid — side by side on wide
screens, wrapping to stacked only once the viewport got narrow enough.
Plot asked for middle name to always sit directly under first name and
above last name, so this is now a fixed single-column stack regardless of
screen width.

**Edit Profile rebuilt.** `/profile/edit` (`components/profile/
ProfileEditForm.tsx`) was still the old, pre-redesign form — profile
picture upload, a full current + permanent address pair, none of it
`.p360`-styled — reached via the name/phone link in the Home poster's top
row. Rebuilt to match the redesigned onboarding form: the same stacked
first/middle/last name fields, the same country-code-list-of-values +
phone row (`lib/countryCodes.ts`, added in round 10). Email stays
editable with the same "sends a confirmation link to the new address"
behavior as before (`supabase.auth.updateUser({ email })`, unchanged).

**New: change password.** The app previously had no way to change a
password while logged in at all — the only path anywhere was the
forgot-password email-link flow (`components/auth/auth.actions.ts`,
`updatePassword`, reachable only from `/auth/reset-password`). Plot asked
for email/password changes to require reverification; added a "Change
password" section (`profile.actions.ts`, `changeMyPassword`) that
re-authenticates with the CURRENT password (`supabase.auth
.signInWithPassword`) before applying a new one, then sends the same
"your password was changed" notification email the reset-password flow
already sends — so a password change is equally confirmed whether it
happens from an emailed reset link or from here. This section is hidden
entirely for Google-only accounts (checked via `user.identities` — no
`provider: 'email'` entry means no password exists to change), showing a
short explanatory line instead.

**Dropped from Edit Profile, matching round 10's onboarding scope:**
profile picture, current/permanent address, identity proof. None of
these are read elsewhere in the app; the `profiles` columns are
untouched and stay nullable. Flagging this the same way round 10 did —
if any of this needs to be editable again later, the same pattern
(representative collects it after the fact) still applies.

Both `/onboarding` and `/profile/edit` no longer wrap their page in the
full `CustomerHeader` nav bar (`app/onboarding/layout.tsx` already
dropped it in round 10; `app/profile/layout.tsx` now does the same) —
`ProfileEditForm` renders its own back-button header (← Edit profile →
`/dashboard`), the same pattern `ScheduleVisit.tsx`/`ChoosePlanAndPay
.tsx`/`RegisterQuick.tsx` already use, rather than reusing the onboarding
form's bare-logo header (which has nowhere to "go back" to, unlike a
profile edit reached from an already-onboarded dashboard).

## 26. Redesign 2026-09 (round 12) — legal/criminal-case declaration on
##     registration; "Awaiting confirmation" screen matched to the rest

**New mandatory checkbox.** Plot asked for a second required declaration
on the quick "Register a property" form, alongside the existing terms
checkbox: "There is no legal or criminal case, ongoing dispute, or any
other issue on this plot that could cause harm or problems for Plot360's
agents or employees during a visit." Added to `RegisterQuick.tsx`
(blocks submit until checked, same as the terms checkbox) and
`registration.actions.ts` (`createPropertyQuick` now rejects the submit
server-side too if it's missing). Stored as a new `properties
.no_legal_case_declared` column (`supabase/schema.sql`) — mirrors
`property_ownership.no_legal_case_declared`, the equivalent column on
the later, full ownership-proof wizard, the same way `ec_interest`
already mirrors `ec_digital_copy_requested`: captured at quick-
registration time, before that `property_ownership` row exists yet.

**"Awaiting confirmation" screen restyled.** Plot flagged the post-bank-
transfer confirmation screen ("Transfer noted. We will confirm it.") as
not matching the rest of the app — it was still the near-black,
white-text block `ConfirmationScreen.tsx` had before round 7's gradient-
hero pass, kept deliberately at the time to read as visually distinct
from the celebratory "done" screens (payment received, visit scheduled).
Both now share the same `var(--gradient-hero)` card + dark text, told
apart only by the kicker pill's color — teal for the celebratory variants,
warm amber for "awaiting confirmation" — the same pill mechanic the Home
poster's "Expiring in N days" badge already uses, rather than an entirely
different background treatment. The `DoneContent` type's `bg: 'accent' |
'ink'` field is renamed `tone: 'success' | 'pending'` to match what it
actually now controls.

## 27. Redesign 2026-09 (round 13) — admin logout button; "Edit ownership"
##     page redesigned, owner ID proof reuse across properties

**Admin logout button.** The new admin console shell (`AdminShell.tsx`,
wired in round 7-ish's admin redesign) had no way to log out at all —
the legacy `AdminHeader.tsx` had one, but it's dead code, not rendered by
`app/admin/layout.tsx`. Added a "Log out" button to the top-right corner
of the top bar, reusing the `logOut` server action and the same
`.p360` `btn btn-secondary` styling `CustomerHeader.tsx` already uses for
its own logout button.

**"Edit ownership" page redesigned.** Plot sent an exact field-by-field
spec for the page reached from admin property verification's "Edit
ownership" link (`/admin/[id]/ownership`, and the equivalent customer
route `/properties/[id]/ownership` — both share `OwnershipForm.tsx`):

1. Owner Name (required)
2. Is this plot owned by the user? (required)
   - Yes → if another property owned by the same customer already has an
     owner ID proof on file, offer to reuse it instead of asking for a
     re-upload; otherwise require an upload.
   - No → require the actual registered owner's ID proof, plus an NOC
     (No Objection Certificate) with a downloadable template — NOC is
     only asked for in this branch.
3. Sale Deed: Property Title / Sale Deed upload (same field/hint text
   that used to live one step later, on the Documents screen).
4. Save / Cancel buttons.

`OwnershipForm.tsx` was fully rebuilt to this spec and restyled to the
`.p360` design system (it still used the pre-redesign `card`/
`field-label` classes) with its own back-button header, matching every
other redesigned standalone screen (`RegisterQuick`, `ScheduleVisit`,
`ProfileEditForm`). Both `app/admin/[id]/ownership/page.tsx` and
`app/properties/[id]/ownership/page.tsx` dropped their old
`container-narrow` wrapper (and, on the customer side, the `CustomerHeader`
wrapper) for the same reason rounds 10-11 dropped them elsewhere.

**New: owner ID proof reuse.** `registration.actions.ts` gained
`getReusableOwnerIdProof(propertyId)` — looks across every other property
owned by the same customer (`properties.owner_id`) for an existing
`property_documents` row with `doc_type='owner_id'`, and returns the most
recently uploaded one. When found (and this property doesn't already
have its own), `OwnershipForm.tsx` shows a card offering "Use this
proof" vs. "Upload a new one"; choosing reuse copies the file
server-side (`supabase.storage...copy()`) into this property's own
storage path rather than sharing one file across two properties' rows,
so each property keeps an independent, deletable copy.

**Deliberately dropped from this screen, flagged to Plot:** the old
"Approval letter" upload and the "do you allow our agent to enter this
property" question are gone — neither is in Plot's new field list, and
agent-entry consent is already collected at property creation time via
`RegisterQuick.tsx`'s terms checkbox ("...allow a verified agent to visit
and photograph this property..."). The `property_ownership.
approval_letter_url` / `agent_entry_allowed` columns are left in the
schema untouched (nullable, simply no longer written by this form) in
case any legacy data still references them.

**Sale Deed moved, not duplicated.** Since the Property Title / Sale Deed
upload now lives on the ownership page, it was removed from
`DocumentsForm.tsx` (`/admin/[id]/documents`, `/properties/[id]/documents`)
so it isn't collected twice — `saveDocumentsAndSubmit` no longer handles
`title_deed` at all; `saveOwnership` does. *(Round 14, below, removes the
Documents step entirely — this paragraph is kept for history.)*

**Downstream fix — admin queue status.** `queues.actions.ts`'s Property
verification queue computed an "Owner letter pending" / urgent state from
`approval_letter_url`, which the ownership form no longer sets — left
as-is, every non-owner property would show that state forever. Changed
to track the NOC instead (`noc_file_url` / `doc_type='noc'`), which is
the document actually required in that branch now. Same swap made in
`PropertyVerificationDetail.tsx`'s document-status cards (was "Letter of
approval from the original owner", now "NOC (No Objection Certificate)").

## 28. Redesign 2026-09 (round 14) — Documents step removed entirely

Plot asked to remove the separate Documents step (the Encumbrance
Certificate detail fields + the two legal-declaration checkboxes) that
round 13 had left in place after Edit ownership. `DocumentsForm.tsx` and
both its routes (`app/admin/[id]/documents/page.tsx`,
`app/properties/[id]/documents/page.tsx`) are deleted; `saveDocumentsAndSubmit`
is gone from `registration.actions.ts`. Edit ownership (`saveOwnership`)
is now the last step in the flow — "Save" finalizes the property
directly instead of continuing on to a next screen.

**What happened to the data that step used to collect:**

- **EC "digital copy requested" flag** — this one is load-bearing, not
  cosmetic: `property_ownership.ec_digital_copy_requested` gates a real
  downstream feature (`components/admin/monitoring.actions.ts`,
  `decideMonitoringJob`/`getJobForReview` — a monitoring job can't be
  marked fully complete until a requested digital EC is uploaded, and
  `MonitoringStatus` shows an "EC pending" state to the customer for it).
  Re-asking for it on a now-deleted screen would have silently broken
  that feature for every new registration. Instead, `saveOwnership` syncs
  it straight from `properties.ec_interest` — the same yes/no question
  already asked once, at registration, on `RegisterQuick.tsx` — so the
  monitoring gate keeps working without asking the customer twice.
- **EC document number / year / registered SRO** — dropped with no
  replacement. These were informational-only reference fields, read
  nowhere except the dead, unwired `AdminReview.tsx`.
- **EC reference-copy upload** (`ec_reference_copy` doc type) — dropped;
  same reasoning, no downstream reader.
- **`no_legal_case` / `agent_entry_terms` declarations** — dropped with
  no replacement. Both were pure duplicates: `properties
  .no_legal_case_declared` (round 12) and RegisterQuick.tsx's terms
  checkbox ("...allow a verified agent to visit and photograph this
  property...") already capture the same two things once, at
  registration. Nothing downstream reads the `property_ownership`
  columns these used to write (`no_legal_case_declared`,
  `agent_entry_terms_agreed`, `other_terms_conditions`) — left in the
  schema, untouched, simply unwritten going forward.

**Other cleanup.** `saveOwnership` absorbed the finalization logic that
used to live in `saveDocumentsAndSubmit` (stamping `registration_date`,
flipping a `rejected` property back to `pending` on resubmission).
`app/admin/[id]/ownership/page.tsx`'s `redirectTo` now points at
`/admin/${id}` instead of the deleted documents route; the customer-side
`saveOwnership` default redirect changed from
`/properties/${id}/documents` to `/properties/${id}`.
`PropertyVerificationDetail.tsx`'s "Edit ownership & documents →" link
is now just "Edit ownership →", and `PropertyView.tsx`'s "Add or update
documents" link (which pointed at the deleted
`/properties/[id]/documents`) now points at `/properties/[id]/ownership`
and reads "Add or update ownership documents".

## 29. Redesign 2026-09 (round 15) — schema drift bug; wrong back-button
##     target on admin Edit ownership

**Live DB missing round-12 columns.** Registering a property failed with
"Could not find the 'no_legal_case_declared' column of 'properties' in
the schema cache." `supabase/schema.sql` has had the right
`alter table properties add column if not exists no_legal_case_declared
boolean;` since round 12 (commit dc1fe5d) — this was schema *drift*, not
a code bug: that migration (and the `ec_interest` column added in the
same batch) was written into the repo's schema file but never actually
run against the live Supabase database. Gave Plot the exact SQL to run
once in the Supabase SQL Editor:
```sql
alter table properties add column if not exists ec_interest boolean;
alter table properties add column if not exists no_legal_case_declared boolean;
alter table properties alter column property_type drop not null;
```
Worth remembering for future schema.sql changes in this project: they
need a matching manual run in Supabase's SQL Editor — nothing applies
them automatically.

**Wrong back-button target on admin Edit ownership.** The back arrow
(top-left of `/admin/[id]/ownership`) was sending admins to the old,
pre-redesign `/admin/[id]/edit` ("Edit Property Details") page instead
of back to Property verification — a leftover `backHref` from before the
round-13 rebuild that nobody had re-pointed. Plot caught it by screenshot
after landing on that obsolete page unexpectedly. Fixed
`app/admin/[id]/ownership/page.tsx`'s `backHref` to `/admin/${id}`
(`PropertyVerificationDetail`). Since that was the only live link to
`/admin/[id]/edit` from the admin UI, that page is now unreachable from
any link — flagged to Plot rather than silently restyling or deleting
it, since `LocationFieldsForm` on the verification page doesn't cover
every field it used to (property_type, plot_shape, description, GPS
corners) — if admins still need to edit those, that page (or a live link
back to it) needs to stay somewhere.

**Segmented Yes/No toggle border bug.** Plot flagged (and, once asked to
narrow it down, confirmed) a border rendering glitch on Edit ownership's
"Is this plot owned by the user?" Yes/No buttons — the border looked
broken/missing right where the two buttons meet. Root cause: the shared
`.p360 .btn` class applies `border-radius: var(--radius-md)` (14px) to
*all four corners of each button independently*; the toggle only
overrode `border-left` on the second button to avoid a doubled divider
line, never `border-radius`, so each button's rounded corner at the
shared edge curved away from the other, leaving a small gap there. Fixed
by squaring off the shared inner corners and keeping only the outer ends
rounded (`border-radius: var(--radius-md) 0 0 var(--radius-md)` /
`0 var(--radius-md) var(--radius-md) 0`). Same bug, same fix, in two
other segmented two-button toggles built the same way: the "Use this
proof / Upload a new one" reuse toggle (also `OwnershipForm.tsx`) and
the EC-interest "Yes, include EC / No, not needed" toggle on
`RegisterQuick.tsx` (identical pattern, not separately reported but
caught while fixing the first one).

**Round 16 — the border-radius fix above wasn't actually enough.** Plot
re-tested and the divider between Yes and No was still inconsistent.
Root cause: two flex items butted exactly edge-to-edge (one with its
touching border zeroed out) can be a hair off due to sub-pixel layout
rounding in the browser, so relying on one button's zero-width border
lining up perfectly with its neighbor's is not reliable — it can render
as a hairline gap depending on zoom level/device pixel ratio. Replaced
with the standard, robust segmented-control technique used elsewhere
(e.g. Bootstrap's button groups): both buttons keep a **full** border on
every side, and every button after the first overlaps the previous one
by exactly `marginLeft: -1` (1px) so the two borders land on the exact
same pixel; later DOM order paints on top, so there's always exactly one
visible divider line, never a gap, regardless of sub-pixel rounding.
Applied to all three toggles from the round-15 note above.

## 30. Redesign 2026-09 (round 17) — customer name/phone on the admin
##     verification page; SRO/Maps hyperlinks; property-verification sort

**Customer name and phone number.** `PropertyVerificationDetail.tsx` was
already fetching the customer's profile (`getPropertyForReview` joins
`profiles` — name, email, phone) into an `owner` variable, but never
actually rendered it anywhere on the page, so an admin reviewing a
property had no way to see who it belonged to without leaving the
screen. Added a line right under the property name/registered-date
summary: `<first> <last> · <country code> <phone number>`, falling back
to the username or "Customer name unknown" / "Phone number unknown" if
either is missing. Also added `phone_country_code` to the profile
columns `getPropertyForReview` selects — it was fetching the bare phone
number without the country code needed to display it meaningfully.

**SRO "Find SRO" link.** The admin verification page's inline
"SRO name and number" field (`LocationFieldsForm.tsx`) had no lookup
link at all, unlike the older `PlotDetailsForm.tsx`, which has always
linked "Find SRO" to Telangana's SRO jurisdiction lookup
(`registration.telangana.gov.in/jusrisdictionSro.htm`) in a new tab.
Added the same link here.

**Google Maps link on the pin field.** Same idea for "Google map pin" —
added an "Open in Google Maps →" link next to the label. The field can
hold either a raw coordinate pair, a full Maps URL, or free-text (the
column is a general-purpose paste target, not a structured lat/lng —
see `RegisterQuick.tsx`'s own comment on why), so the link builder
passes anything that's already an `http(s)://` URL straight through, and
otherwise hands the raw text to Google's generic Maps search endpoint
(`google.com/maps/search/?api=1&query=...`), which resolves a
coordinate pair or a place name equally well. This one field is now
tracked in local state (the rest of the form's fields stay uncontrolled
`defaultValue` inputs, unchanged) so the link updates live as the value
is edited, not just after a save.

**Property-verification "Most urgent first" / "Oldest waiting" sort.**
Plot reported these buttons don't appear to filter/sort. Read through
`QueueControls.tsx` (pushes `?sort=` into the URL via `router.push`) and
`queues.actions.ts`'s `getPropertyVerificationQueue`/`finish()` (sorts
rows server-side based on that query param) — found no code bug; the
mechanism matches the pattern used by all six queues. The likely
explanation: "urgent" here specifically means "NOC pending" (see round
13's admin-queue fix), and none of the currently-listed test properties
have reached that state yet (they're all sitting at "Docs pending" /
"Ready to verify" since round 14 moved the sale deed upload to Edit
ownership and this batch of test properties hasn't been through that
screen) — with nothing flagged urgent, both sorts fall back to the same
"longest waiting first" order, so toggling between them looks like
nothing happened even though the code did run. Flagged to Plot to
confirm by watching whether the button's dark highlight itself moves
between "Most urgent first" and "Oldest waiting" on click, which would
tell them the click is registering even though the row order doesn't
visibly change for this data set.

## 31. Redesign 2026-09 (round 18) — broader "urgent" logic + rejected
##     properties surfaced in the verification queue

Plot's request: fold "customer resubmitted after a rejection" and
"fully ready for review" into what "Most urgent first" flags, and asked
whether rejected-but-not-yet-resubmitted properties should be shown too
so the admin can follow up — leaving the call on merged-vs-separate to
this round.

**Detecting "resubmitted after rejection" needed no schema change.**
`setPropertyStatus` (`admin.actions.ts`) sets `properties.rejection_reason`
on rejection and only clears it back to `null` when the property is
later approved (`status: 'verified'`) — it is deliberately *not*
cleared by `saveOwnership`'s rejected→pending flip (round 14). So
`status === 'pending' && rejection_reason !== null` is already, on its
own, an exact signal for "this was rejected and the customer has since
resubmitted, now waiting on the admin" — confirmed by reading both
functions again before relying on it.

**Decision: merged into the existing Property verification queue,
not a separate view.** The app's established pattern is one shared
queue table per concern (`QueueScreen`/`QueueControls`/`queues.actions.ts`
— six queues total, all built the same way); adding a seventh queue just
for "rejected, following up" would fragment that pattern for a case
that's really the same concern (properties working their way through
verification) at a different stage. `getPropertyVerificationQueue`'s
`properties` query changed from `.eq('status', 'pending')` to
`.in('status', ['pending', 'rejected'])`, with `status` and
`rejection_reason` added to the select.

**New state/urgency logic per row:**
- Plain `status === 'rejected'` (customer hasn't acted yet): state
  shown as "Rejected · follow up with customer", **not** marked
  urgent — nothing for the admin to do until the customer responds, so
  it stays out of "Most urgent first" while still being visible in the
  list (and matchable by search) for proactive follow-up.
- `status === 'pending'` with a `rejection_reason` still set (customer
  resubmitted): the usual doc-completeness state label (Docs pending /
  ID proof pending / NOC pending / Ready to verify) gets a
  "· resubmitted" suffix, and the row is always marked `urgent: true`
  regardless of which doc-state it's in — Plot's phrasing ("now that
  information is provided and waiting for admin to review") reads as
  "this needs an admin's eyes regardless of exactly which fields came
  back," so resubmission itself is the urgency signal here, not just
  reaching "Ready to verify".
- `status === 'pending'`, never rejected, `state === 'Ready to verify'`
  (all documents in, nothing more needed from the customer): now also
  `urgent: true` — previously only "NOC pending" counted as urgent,
  which meant a fully-ready property could sit un-flagged waiting on
  the admin. Kept as urgent per Plot's message re-confirming it.
- The existing NOC-pending condition (`needsNoc`) is unchanged and
  still counts as urgent on its own, independent of the above.

Not changed: `getAdminPendingCounts`'s sidebar badge for this queue
still counts strictly `status === 'pending'` rows — a rejected property
sitting untouched by the customer isn't a pending admin action, so
folding it into that badge's number would overstate what needs the
admin's attention right now. It remains visible in the queue list
itself (this round's whole point) without inflating the badge count.
The queue's note text under the page title was updated to mention that
rejected/awaiting-resubmission properties now appear here too.

## 32. Redesign 2026-09 (round 19) — first visit now goes straight to Job
##     assignment; "Schedule a visit" is for the second visit onward

Plot's report: a property that's registered, verified, and paid for was
"going back to customer to raise a visit request or schedule a visit"
instead of appearing in the admin's Job assignment queue. Expected: the
FIRST visit on a newly verified, paid property should always be ready
for the admin to assign an agent to, with nothing required from the
customer; only a SECOND (or later) visit on that same property should
ever be something the customer explicitly schedules.

**Root cause.** `getEligiblePropertiesForAssignment`
(`components/admin/monitoring.actions.ts` — the "legacy" Job assignment
source) already had exactly this rule built in ("the first visit of a
cycle is available immediately on payment confirmation, no due-date
wait"), but it only considers properties where `properties.
expiration_date` is set. `recordPayment` (the admin's bank-transfer
confirmation path) sets that column, but `purchaseVisitCredits`'s UPI
branch (`components/payments/visitCredits.actions.ts` — what a customer
actually hits paying for a 1-visit/4-visit/etc. plan themselves) never
did. So a UPI-paid property sat there fully verified and paid, with
visit credits issued, but invisible to Job assignment — "Schedule a
visit" was the only thing left pointing anywhere, so the customer used
it, even for what should have been an automatic first visit.

**Fix, three parts:**
- `purchaseVisitCredits`'s UPI branch now also sets `properties.
  expiration_date` after issuing the payment/visit_credits rows —
  matching what `recordPayment` already does for the same
  `paymentType==='initial'` case. That alone is enough for the property
  to flow through the existing legacy-assignment logic for its first
  visit; no new assignment mechanism was needed, since one was already
  built for this and just wasn't being reached.
- Deliberately did **not** also set `next_monitoring_due_date` there
  (unlike `recordPayment`'s legacy branch) — that column is what lets
  `getEligiblePropertiesForAssignment` auto-surface a property's
  SECOND+ visit with no customer action, once a due-date window opens.
  That's correct for the old fixed 6/12-month subscription cadence, but
  wrong for a visit-credits plan (1, 4, or any other purchased
  quantity) — every visit after the first should only appear once the
  customer explicitly schedules it. Leaving this column null keeps a
  visit-credits property out of that auto-surface path for anything
  past its first visit. `recordPayment` was updated to match: it now
  only sets `next_monitoring_due_date` when the payment has no
  `plan_id` (a true legacy payment) — previously it set this
  unconditionally for any `payment_type==='initial'` payment, which
  would have let a plan-based property paid via bank transfer
  auto-surface its second visit too, inconsistently with one paid via
  UPI.
- `canScheduleVisit` (`lib/visitCredits.ts`) — the "Schedule a visit"
  screen's own gate — took a new `hasFirstVisit` parameter and now
  refuses to unlock at all until it's true (at least one
  `monitoring_jobs` row already exists for the property, meaning the
  first visit has been created — assigned, in progress, or done). This
  closes the other half of the gap: without it, a customer could still
  open "Schedule a visit" right after paying and self-schedule what was
  supposed to be their automatic first visit, landing two assignment
  targets for what was really one visit. Both call sites —
  `app/properties/[id]/schedule/page.tsx` (queries a
  `monitoring_jobs` count for the property) and
  `components/customer/PropertyVisitHistory.tsx` (already had the
  job list loaded) — were updated to pass this through, with a new
  "arranged automatically, no action needed" message shown in place of
  the date picker when it's not yet unlocked.

**Not changed / known follow-up, flagged rather than fixed here:**
- `visit_credits.quantity_used` — the column the ledger's "remaining"
  count is meant to subtract — is never actually incremented anywhere
  in the codebase (checked before making this change, to be sure this
  round wasn't adding to that gap). `totalRemainingCredits` currently
  only shrinks via `remainingAfterReservations`, which counts open
  `visit_requests` rows — a legacy-assigned first visit never creates
  one of those, so it doesn't reduce the credits shown as remaining
  either. This is a pre-existing gap in the credits ledger, not
  something this round's fix introduces or worsens, but worth a
  dedicated round of its own before this scales.
- Properties that already completed a UPI payment *before* this fix
  shipped still have `expiration_date = null` and won't retroactively
  appear in Job assignment on their own. A one-time backfill for those
  (set `expiration_date` from each property's latest completed
  payment's `valid_until`, same as this round's SQL note below) is
  worth running once against the live database.

## 33. Redesign 2026-09 (round 20) — visit_credits.quantity_used now
##     actually moves

Follow-up to round 19's flagged gap: `quantity_used` — the column the
credits ledger's "remaining" count is meant to subtract — was never
written anywhere. `totalRemainingCredits` only ever shrank via
`remainingAfterReservations`, which counted open `visit_requests`
rows, so a property's "remaining credits" never actually went down no
matter how many visits were completed, and a legacy-assigned visit
(round 19's auto-assigned first visit, or any job the admin assigns
straight from Job assignment without a visit_request behind it) wasn't
counted as reserved at all while in progress either.

**Design: reserve on assignment, consume on completion**, mirroring
the pattern the visit_request flow already half-implemented (it always
set `monitoring_jobs.visit_credit_id` on assignment; it just never
followed through at the other end):

- `assignAgentToProperty` (`components/admin/monitoring.actions.ts`,
  the "legacy" assignment path — also what round 19 uses for a
  visit-credits property's auto-eligible first visit) now picks a
  credit the same way `requestVisit` already does (`creditToConsume`,
  oldest-expiry-first) and attaches it via `visit_credit_id` on the
  job it creates. A true pre-visit-credits legacy property has no
  visit_credits rows, so this stays a no-op for it — unchanged
  behavior.
- `finalizeApprovedJob` — the function's own header comment already
  called this "the job is truly, fully done" — now increments that
  credit's `quantity_used` by 1, guarded so it can never push past
  `quantity_purchased`. This function is the single place both
  approval paths funnel through (a direct approve, and an EC-pending
  job finally closing out via `uploadEcDigitalCopy`), so a credit is
  marked used exactly once, exactly when the visit is truly done — not
  on a rejection (the agent redoes the same job, same credit) and not
  while `ec_pending` (photos are out, but the job itself isn't done
  until the EC paperwork closes it).
- `deleteMonitoringJob` — an admin's manual cleanup tool, allowed on a
  job in any status except `submitted` — now releases the credit back
  (`quantity_used - 1`) when deleting a job that had already reached
  `approved`, so removing a stray/duplicate completed job doesn't
  permanently strand a credit as used for a job that no longer exists.
  An `ec_pending` job never incremented in the first place, so
  deleting one needs no release.
- `getOpenVisitRequestCounts` (`components/payments/visitCredits.
  actions.ts`) — the "how many credits are already spoken for"
  helper used by the customer-facing screens — is renamed
  `getReservedCreditCounts` and now counts two non-overlapping
  buckets: a `visit_requests` row still `status='open'` (hasn't become
  a job yet), and any `monitoring_jobs` row already holding a
  `visit_credit_id` that hasn't reached a final, credit-consuming
  outcome (`status` in assigned/accepted/submitted/ec_pending/
  rejected — not `approved`, which is what `quantity_used` itself now
  covers). The moment a visit_request becomes a job
  (`assignAgentToTarget` flips it to `status='assigned'` and creates
  the job), it drops out of the first bucket and the job picks it up
  in the second, so the same reservation is never counted twice.
  `requestVisit` itself (previously its own separate, narrower inline
  query — `visit_requests` in open/assigned only, blind to any
  legacy-assigned job) now calls this same shared helper too, so the
  screen that actually gates "can you request another visit" agrees
  with what the read-only screens display as remaining.

Net effect: a property's "remaining credits" now genuinely counts
down as visits are assigned and completed, for both the
customer-scheduled path and the auto-assigned first visit — closing
the exact gap flagged at the end of round 19.

**Not touched:** `visit_credits` rows that were already fully or
partially "used" before this fix shipped have `quantity_used` frozen
at whatever it was (0, in every case, since nothing ever wrote to it)
— their true usage lives only in already-approved `monitoring_jobs`
rows with no `visit_credit_id` recorded (that association didn't
exist for legacy-path jobs before this round either). Backfilling
those retroactively would mean guessing which now-untracked approved
visit consumed which credit batch on properties with more than one
batch, which isn't safe to script automatically — worth a manual look
only if a specific property's credit count looks wrong, not a
blanket migration.

## 34. Redesign 2026-09 (round 21) — optional transaction ID field, bold
##     Log out, "Request more info" WhatsApp button

Three small, unrelated requests in one round.

**Payment transaction ID (optional).** `ChoosePlanAndPay.tsx` (the
current Register Step 2 / Payment screen) previously asked for nothing
beyond plan + method before "paying" — UPI wrote its own generated
`UPI-<timestamp>` as `payments.transaction_reference` and bank transfer
wrote no reference at all (an admin only ever added one later, by hand,
via `PaymentRecordForm`). Added an optional "Payment transaction ID"
input, shown once a method is picked; `purchaseVisitCredits` now takes
a fourth, optional `customerTransactionId` param and prefers it over
the generated UPI placeholder, and writes it into the bank-transfer
insert too. Left blank, behavior is unchanged (same generated UPI
reference, same null bank reference an admin fills in later) —
`PaymentRecordForm`'s existing `defaultReference` prop already surfaces
whatever's on the row, so a customer-supplied bank reference now shows
up there automatically with no admin-side change needed. The older,
separate `/properties/[id]/subscribe` flow (`SubscribeForm.tsx`) already
had its own *required* Transaction ID field from before the redesign —
left untouched, out of scope here.

**Bold Log out.** Made the "Log out" button bold (`fontWeight: 700`) in
every screen it's actually wired into today: `CustomerHome.tsx`'s
dashboard poster, `CustomerHeader.tsx` (properties/onboarding/profile/
tasks/service-requests), `AgentHeader.tsx`, and `AdminShell.tsx`. Left
`AppHeader.tsx` and the legacy `AdminHeader.tsx` alone — neither is
imported anywhere anymore (superseded by CustomerHeader/CustomerHome
and AdminShell respectively), same "kept but dead" pattern as
elsewhere in this redesign.

**"Request more info" WhatsApp button on Property verification.** Plot
asked for a way to WhatsApp the owner from the Property verification
detail screen, before any approve/reject decision, with this fixed
wording:

> Dear \<customer Name\>,
> Thank you for choosing, trusting and providing us an opportunity to
> serve you. Before we move to the next steps, we need additional
> information and our member will be in touch with you collect
> remaining information.
>
> Thank you,
> Plot360 Team

Added `buildAdditionalInfoMessage(customerName)` to `whatsapp.ts`
(verbatim text, name substituted in — including "in touch with you
collect remaining information" exactly as given; flagged to Plot as a
likely typo, not silently corrected), a new
`sendAdditionalInfoRequest(propertyId)` action in
`review-decisions.actions.ts`, and `SendInfoRequestButton.tsx`, wired
into `PropertyVerificationDetail.tsx` right under the customer name/
phone line (only rendered when a phone number is on file). Deliberately
uses the click-to-open-wa.me-link + log pattern (`ResendWhatsAppButton`'s
shape), not the auto-logged-as-sent pattern `verifyProperty`/
`rejectPropertyVerification` use — this message is a one-off the admin
chooses to send right now, not a side effect of a status change, so the
admin still taps Send inside WhatsApp themselves and it shows up in the
same "WhatsApp outbox" panel (`TimelineOutboxPanel`) as everything
else sent for that property.

## 35. Redesign 2026-09 (round 22) — Field Agent redesign: signup,
##     onboarding, "Account under review", "Profile & SRO"

Plot supplied six design_handoff_plot360_redesign "Plot360 Field Agent"
mock screens. Two of the six (My jobs — `AgentJobsHome.tsx` — and
Capture & submit / Submitted — `AgentCaptureScreen.tsx`) were already
redesigned in earlier rounds. This round covers the other two named
screens (Agent signup, Profile & SRO), a real enhancement to a third
that only partly matched (Account under review), and Agent login, which
wasn't one of the six but sits in the same auth surface and was still
fully pre-redesign.

**Scope decision, asked and confirmed with Plot first**: the signup mock
shows a materially different flow from the old one — OAuth or
username/password, a mobile number, and documents marked optional
("needed before your first job") — versus the old flow's mandatory
full home address, SRO, and both ID documents before an agent account
could even be submitted for review. Plot chose to actually match the
mock's flow, not just reskin the old one, so this is a real behavior
change, not only a visual pass.

**New signup flow**: `AgentSignupForm.tsx` is now one combined screen —
Google/Facebook OAuth, or email + password + mobile + name, with
Driving licence / Secondary ID uploads optional. It submits to a new
`agentSignUpAndRegister` (`agent-auth.actions.ts`), which creates the
Supabase Auth user AND the profile/agent_profiles/document rows in one
call — using the service-role admin client (same "legitimately
privileged write after manual authorization" pattern as
`purchaseVisitCredits`'s UPI branch) since Supabase may not return a
session immediately after `signUp()` (email confirmation, if the
project has it on, still applies unchanged — same "check your email"
interstitial as before in that case). The old `agentSignUp` function is
kept, intact, just no longer called.

**SRO and home address moved / dropped.** SRO now lives only on the
Profile & SRO screen (`updateAgentContactInfo`), settable any time
before an agent needs matching to jobs — not required at signup.
Home address is no longer collected anywhere in the agent flow at all
— neither the new mocks nor admin's own agent review screen
(`AgentVerificationDetail.tsx`, from an earlier round) ever showed it.
Both `completeAgentRegistration` and `updateAgentContactInfo` had their
address/SRO-required checks removed accordingly; a profile photo
upload was dropped from both for the same reason (mock never shows
one). Existing agents with `current_address` already stored keep that
data untouched — no columns were dropped, just stopped collecting into
them from the agent side.

**OAuth agents**: `signInWithOAuth` now redirects to a new
`/agent/auth/callback` (mirrors `/auth/callback`), which checks whether
`agent_profiles` exists yet — if not (first-time OAuth signup, no form
round-trip to have collected name/mobile), sends them to
`/agent/onboarding`. That form (`AgentOnboardingForm.tsx`) is now a
short "a couple more details" step — name, mobile, optional documents
only — reusing (heavily trimmed) `completeAgentRegistration`. A
returning OAuth agent goes straight to `/agent/dashboard`.

**Account under review, enhanced.** Pulled the pending-block out of
`app/agent/dashboard/page.tsx` into `AgentUnderReview.tsx`, now showing
Agent ID, masked mobile, a document count, status, the actual welcome
WhatsApp logged at signup, and a "Go to my jobs" button — matching the
mock instead of just the black header text it had before. Two honest
simplifications, both documented at the call site: Agent ID
(`agentDisplay.ts`'s `agentDisplayId`) is a display shorthand, not a
real sequential ID — same substitution as properties' `P-<id>` code;
and the document count reads "of 2", not "of 4" — the schema only
ever tracks two document types (`driving_license`, `secondary_id`),
same simplification `AgentVerificationDetail.tsx` already made on the
admin side.

**Profile & SRO, rebuilt.** `AgentProfileEditForm.tsx` now matches the
mock: name/Agent ID/masked mobile/completed-visits header, a status
pill, "Where you work" SRO fields, and a Documents list with inline
Replace/Attach (uploading immediately queues into the same Save
submission — `updateAgentContactInfo` gained document-upload handling
it didn't have before). Two document rows, not four, same reasoning as
above; "Verified `<date>`" in the mock becomes "Uploaded `<date>`" —
there's no per-document verification timestamp, only the agent's
overall status shown in the header pill. Saving still sends the account
back to `'pending'` for admin reverification, unchanged behavior.

**Welcome WhatsApp — real infra, not a fake UI element.** The mock's
"WhatsApp sent to ⋯" box is rendered from an actually-logged
`whatsapp_messages` row (`agent_profile` entity type, already in the
enum), written via the admin client at signup — not simulated. Reading
it back needed a new RLS policy, since `whatsapp_messages` was select-
admin-only before this round:

```sql
create policy "whatsapp_messages_select_own_agent" on whatsapp_messages for select
  using (related_entity_type = 'agent_profile' and related_entity_id = auth.uid());
```

**⚠️ Action needed in Supabase**: this policy (added to
`supabase/schema.sql`, just above the pre-existing admin-only policy)
must be run against the live database — the "WhatsApp sent to ⋯" box on
Account under review and Profile & SRO will silently show nothing until
it is (RLS blocks the read, not an error).

**Old shared `AgentHeader` removed from every agent layout.** Every
agent screen (My jobs, Capture/Submit, Under review, Onboarding,
Profile) already owns its own full `.p360` header or back button — the
four agent layouts (`dashboard`, `jobs`, `profile`, `onboarding`) were
still wrapping all of them in the old pre-redesign `AgentHeader`,
showing a duplicate top nav bar above the new design. This was the same
bug already caught and fixed for the customer dashboard in round 2 —
just not yet applied to the agent side. `AgentHeader.tsx` itself is
kept, intact, just no longer imported anywhere.

**Not changed / known follow-ups:**
- `AgentJobList.tsx`, `AgentJobDetail.tsx`, `AgentReview.tsx` (admin's
  legacy agent detail) all remain kept-but-unreferenced, as before.
- A real WhatsApp Business API still doesn't exist (see round 21's
  `whatsapp-log.actions.ts` note) — the welcome message is logged the
  same "marked sent the instant it's written" way every other automatic
  status message already is; nothing about this round changes that.
- The signup mock's "Username" field is the real Email field, styled to
  match — this app authenticates by email, not a separate username
  system (the schema does have an unrelated `profiles.username` display
  field, used elsewhere only as a display-name fallback).
- First/Last name and Confirm password were added to the signup screen
  even though not visible in the cropped mock screenshot (likely below
  the fold) — an admin reviewing a new agent needs a name, and a real
  password account needs confirmation.

## 36. Redesign 2026-09 (round 22 follow-up) — five bugs/requests from
##     first feedback on the Field Agent redesign

Plot's first feedback on round 22's Field Agent redesign, five items,
all addressed:

**1. `/agent` 404'd.** `app/agent/` only ever had subdirectories
(`dashboard`, `jobs`, `login`, `onboarding`, `profile`, `signup`,
`auth`) — no root `page.tsx`, so both `localhost:3000/agent` and
`https://uat.plot360.in/agent` 404'd. Added `app/agent/page.tsx`,
redirects to `/agent/login`.

**2. "Account created. Verification takes a day." restyled.** Plot:
"black color message style is old, update and match with new design."
`AgentUnderReview.tsx`'s header was a flat `var(--color-text)`
full-bleed block — the actual "new design" treatment used elsewhere for
a prominent welcome/status card is the hero-card pattern (customer home,
marketing hero): `background: var(--gradient-hero)` +
`border-radius: var(--radius-lg)`, inset in a rounded card rather than
full-bleed black. Swapped to that.

**3. Agent verification fields are now editable.** Plot: "In Agent
verification page all fields should be editable to admin and reviewer."
Mobile number/Email/SRO name/SRO number in `AgentVerificationDetail.tsx`
were `readOnly` with no save path. Pulled into a new client component,
`AgentVerificationEditableFields.tsx`, with its own Save button calling
a new action, `updateAgentVerificationFields` (`agents.actions.ts`).
Needed a new RLS policy — `profiles` had no admin-update policy at all
before this (only `agent_profiles` did):

```sql
create policy "profiles_update_admin" on profiles for update using (is_admin());
```

Note: editing "Email" here only updates the `profiles` row (what the
team sees, what WhatsApp/notifications use) — it does not change the
agent's Supabase Auth login credential, which would need the
service-role admin API and its own confirmation step. Flagged in the UI
copy itself, not just here.

**4. Multiple files per document type — agent and admin side.** Plot:
"Driving License and Second Government ID filed should allow to upload
multiple files as user needs to send front side as well as back side,
so multi files should be allowed ... at the time of registration as
well for Admin and reviwer when verifying it." The schema only ever had
two document *types* (`driving_license`, `secondary_id`), not
front/back as separate fields, and a unique `(agent_id, doc_type)`
constraint meant every upload silently replaced the previous file for
that type. Honest substitution made here: rather than inventing
front/back columns the mock never showed either, `agent_documents` now
simply allows any number of files per type —

```sql
alter table agent_documents drop constraint if exists agent_documents_agent_doctype_key;
```

— so an agent (or admin) attaches as many photos per document as
needed (front, back, a retake, etc), each its own row. Every upload
path switched from `.upsert(..., {onConflict: 'agent_id,doc_type'})` to
a plain `.insert(...)` with a unique `file_path`
(`<agentId>/<docType>-<timestamp>-<random>-<filename>`):
`agentSignUpAndRegister` (agent-auth.actions.ts), `completeAgentRegistration`
and `updateAgentContactInfo` (onboarding.actions.ts, both renamed
`uploadDoc` → `uploadDocs`, now loop `formData.getAll(field)` instead of
`formData.get(field)`). All three agent-facing file inputs
(`AgentSignupForm.tsx`, `AgentOnboardingForm.tsx`,
`AgentProfileEditForm.tsx`) got the `multiple` attribute.

New: agents can remove their own bad upload
(`deleteAgentDocument`, onboarding.actions.ts — `AgentProfileEditForm.tsx`'s
document rows now list every file with its own Remove, immediate, not
gated on the Save button) and admin/reviewer can add or remove a file
directly from the verification screen (`uploadAgentDocumentAsAdmin` /
`deleteAgentDocumentAsAdmin`, `agents.actions.ts`, rendered via new
`AgentDocumentManager.tsx`, replacing the old static two-card grid in
`AgentVerificationDetail.tsx`). Needed RLS to actually allow admin
inserts/deletes/updates (before this round admin only had `select` on
`agent_documents`, and no policy at all on the storage bucket beyond
read):

```sql
create policy "agent_documents_delete_own" on agent_documents for delete
  using (agent_id = auth.uid());
create policy "agent_documents_admin_all" on agent_documents for all
  using (is_admin()) with check (is_admin());
-- storage.objects:
create policy "agent_documents_admin_all" on storage.objects for all
  using (bucket_id = 'agent-documents' and is_admin())
  with check (bucket_id = 'agent-documents' and is_admin());
```

**5. "Request missing documents" now actually opens WhatsApp.** Plot:
"When clicked request missing document button ... should send a
whatsapp message ... and that is not happening ... If this is not sent,
the agent will never know Admin or Reviwer is waiting for his
response." Root cause: `requestAgentDocuments` (`agents.actions.ts`)
only ever logged the message to the `whatsapp_messages` outbox — it
never returned the phone/message, and `RejectionDialog.tsx` (the shared
dialog `AgentVerificationActions.tsx` renders as "Request missing
documents") never opened a `wa.me` link on its own; it only calls
whatever `onSubmit` the parent passed. Nothing ever opened WhatsApp, so
the admin clicking "Send request" appeared to do nothing and the agent
was never actually messaged — same class of bug the round-21
`SendInfoRequestButton.tsx` already fixed for properties, just not
applied here.

Fixed by: `requestAgentDocuments` now returns
`{ phoneCountryCode, phoneNumber, message }` (and errors if the agent
has no phone on file, instead of silently no-op'ing); `RejectionDialog`'s
`onSubmit` type gained an optional `whatsappLink` on its result, and
opens it (`window.open`) right after a successful submit — additive, the
other three `RejectionDialog` contexts (property reject, submission
reject-and-reassign, payment mismatch) are unaffected since they don't
pass one back; `AgentVerificationActions.tsx`'s `onSubmit` now builds
the link with `buildWhatsAppLink` and hands it back. Same click-to-open
pattern as `ResendWhatsAppButton.tsx` / `SendInfoRequestButton.tsx`
throughout the rest of the app.

**⚠️ Action needed in Supabase** — three new/changed statements in
`supabase/schema.sql`, on top of round 22's still-pending
`whatsapp_messages_select_own_agent` policy, must be run against the
live database:
- `alter table agent_documents drop constraint if exists agent_documents_agent_doctype_key;`
- `create policy "profiles_update_admin" on profiles for update using (is_admin());`
- `agent_documents_delete_own` / `agent_documents_admin_all` (table) and
  `agent_documents_admin_all` (storage.objects) above.

Until these run: admin's Save on the verification screen will fail with
an RLS error, a second document upload for the same type will still
silently overwrite the first (old constraint still in place), and admin
document upload/remove will fail with an RLS error.

## 37. Redesign 2026-09 (round 22 follow-up 2) — audit: every "logs but
##     never opens WhatsApp" spot, found and fixed

Plot: "check the same if any other place where whatsapp is not opening
and just logging internally in all the application and fix it" — after
round 36 fixed this for agent "Request missing documents". Audited
every call site of `logWhatsAppMessage` in the codebase
(`components/admin/agents.actions.ts`, `assignment.actions.ts`,
`review-decisions.actions.ts`, and the function's own definition in
`whatsapp-log.actions.ts` — no other file calls it). Found six more,
all in the same shape: log the message, return `{success: true}`,
nothing ever opens WhatsApp for the admin to actually send it.

**Fixed, all six:**
- `verifyProperty` / `rejectPropertyVerification` (Property verification
  detail screen's Approve / "Reject with reason")
- `approveSubmission` / `rejectSubmission` (Submission review screen's
  Approve / "Reject and reassign")
- `confirmPaymentWithLog` / `flagPaymentMismatchWithLog` (Payment detail
  screen's Confirm / "Flag a mismatch")
- `assignAgentToTarget` (Job assignment queue's Assign buttons —
  `AssignAgentButtons.tsx`)

Each of the six now returns `phoneCountryCode`/`phoneNumber`/`message`
alongside `success: true` when it actually logged something (omits them
if the customer/agent has no phone on file, same as before).

Two different UI fixes, matched to how each screen already navigates:
- The three plain-button approve/confirm flows and the job-assignment
  Assign buttons (`PropertyVerificationActions.tsx`,
  `SubmissionReviewActions.tsx`, `PaymentDetailActions.tsx`,
  `AssignAgentButtons.tsx`) now show a "Send via WhatsApp / Done" panel
  after success — same shape `MonitoringDecision.tsx`/
  `AssignAgentForm.tsx`/`ReassignAgentForm.tsx` already use elsewhere —
  instead of routing straight to the queue.
- The three `RejectionDialog`-based reject/flag flows
  (`PropertyVerificationActions.tsx`'s reject,
  `SubmissionReviewActions.tsx`'s reject,
  `PaymentDetailActions.tsx`'s flag) deliberately do NOT use
  `RejectionDialog`'s `whatsappLink` auto-open feature (round 36) —
  these three screens navigate away right after a successful submit,
  and doing that at the same moment as an auto `window.open` risks the
  new tab closing before it opens. They instead call `setWaLink` inside
  their own `onSubmit`, which shows the same "Send via WhatsApp / Done"
  panel as the approve buttons above and only navigates once the admin
  clicks Done.

**Confirmed NOT a bug, left alone:** the welcome WhatsApp
`agentSignUpAndRegister` writes directly via the admin client (not
through `logWhatsAppMessage`) is a passive record shown back to the
agent themselves on "Account under review" — there's no admin action to
trigger, so nothing needs to open. `MonitoringDecision.tsx`/
`AssignAgentForm.tsx`/`ReassignAgentForm.tsx`'s own existing flows
already open WhatsApp correctly (click-through link) — they don't call
`logWhatsAppMessage` at all today, a separate, lower-priority gap (no
outbox row for those sends) not covered by this round since it isn't
the bug Plot reported (those already work; they just aren't logged to
the outbox for a Resend later).
