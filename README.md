# MyYajmaan

MyYajmaan is a divine puja booking platform concept built with React, Vite, Tailwind CSS, and a centralized service layer for Supabase/FastAPI integration.

## Getting started

1. Install dependencies: npm install
2. Copy the environment example: copy .env.example .env
3. Start the dev server: npm run dev

## Included features

- Home page with divine hero section
- Booking flow for puja selection
- Dashboard for user activity and rewards
- Admin and Pandit Ji experience screens
- Centralized Supabase service placeholder

## Supabase integration (optional)

To persist bookings and use real pandit/availability data, provide Supabase environment variables in `.env`:

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_USE_SUPABASE=false

Set `VITE_USE_SUPABASE=true` when you are ready to switch the UI flow from the current mock-services design review to Supabase-backed tables.

When these are set the app will attempt to use Supabase for:
- fetching availability (`availability` table)
- fetching pandit listings (`pandits` table)
- creating booking records (`bookings` table)

Suggested minimal table schemas (Postgres):

bookings
- id: uuid (primary key)
- user_id: int
- puja_id: int
- package_id: int
- pandit_id: int
- date: date
- timeslot: text
- amount: numeric
- payment_ref: text
- status: text
- created_at: timestamp with time zone default now()

pandits
- id: serial (primary key)
- name: text
- languages: text[]
- experience: int
- rating: numeric
- price: numeric
- approved: boolean

availability
- id: serial
- puja_id: int
- date: date
- timeslot: text
- time: text
- available: boolean
- shubh: boolean

If Supabase variables are not present, the app falls back to mocked data for local development.
