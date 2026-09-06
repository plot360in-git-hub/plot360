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
