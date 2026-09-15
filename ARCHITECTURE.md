# Plot360 — Component Architecture & Data Model

Source material: 10 hand-drawn wireframes (Home, Signup, Customer Registration x2,
Customer Dashboard, Plot Registration x3, Property View, Task View) mapped against
`project-instructions.md` (Next.js + Supabase, $0-cost, ~100 users / ~200 properties).

> Note: the uploaded `Plot360_Project_Documentation_and_Project_Plan.docx` did not
> actually attach to this conversation (only the 10 JPEG wireframes came through) — this
> build is based on the wireframes + project instructions. Re-upload the docx if it has
> requirements not visible on paper, and I'll fold in any gaps.

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
- **Google / Facebook / WhatsApp OTP buttons are drawn exactly as in the
  mock but are inert** — no OAuth provider or WhatsApp OTP is configured
  in this project (would need real client IDs/secrets from Plot). Clicking
  one shows an inline "isn't connected yet" note rather than doing
  nothing silently.
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
