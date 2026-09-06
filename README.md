# Plot360 — component scaffold

Read `ARCHITECTURE.md` first — it explains how the wireframes map to modules,
the DB schema, and the file-per-concern pattern every module follows.

## Setup

1. Create a free Supabase project.
2. Open the SQL editor and run `supabase/schema.sql` once — it creates all
   tables, enables RLS, and creates the 5 storage buckets with policies.
3. Copy `.env.example` to `.env.local` and fill in your project's URL/anon key.
4. `npm install next react react-dom @supabase/ssr @supabase/supabase-js`
5. `npm run dev`

## Where things live

```
app/                        Next.js routes (thin — just render a component)
components/
  auth/                      Signup, login, password reset
  onboarding/                Customer Registration (KYC) form
  dashboard/                 Customer Dashboard
  properties/
    registration/            3-step Plot Registration wizard
    view/                    Read-only Property View + PropertyCard
  tasks/                     Task list, task detail + media upload
lib/supabase/                Browser + server Supabase clients
types/database.types.ts      Shared TS types (swap for generated types later)
supabase/schema.sql          Full DB + storage migration
styles/globals.css           Design tokens (Apple-inspired system)
```

## Extending a module without touching the rest

Each feature folder is: `*.actions.ts` (server writes) + components (client
forms) + reads either inline or in a `*.data.ts` file. To add a new field to,
say, Plot Registration: add the column in `schema.sql`, add it to the
`Property` type, add the input to `PlotDetailsForm.tsx`, and read it in
`createProperty()`. Nothing in `dashboard/`, `tasks/`, or `auth/` needs to
change.

## Not yet wired up (intentionally left as TODOs)

- Real captcha widget on Signup (placeholder text input right now)
- Auth middleware to protect `/dashboard`, `/properties/*`, `/tasks/*` routes
- Admin/agent-side verification flow that flips `properties.status` to `verified`
- Cloudinary video offload (only needed once Supabase's 1GB fills up — see
  `ARCHITECTURE.md` §6)
