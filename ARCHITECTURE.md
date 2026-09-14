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
