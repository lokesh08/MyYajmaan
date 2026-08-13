create extension if not exists pgcrypto;

create table if not exists public.pandits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  languages text[] default array[]::text[],
  experience integer default 0,
  rating numeric(3,2) default 0,
  price numeric(10,2) default 0,
  approved boolean default false,
  created_at timestamp with time zone default now()
);

create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  puja_id integer not null,
  date date not null,
  timeslot text not null,
  time text not null,
  available boolean default true,
  shubh boolean default false,
  created_at timestamp with time zone default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null,
  puja_id integer not null,
  package_id integer,
  pandit_id uuid references public.pandits(id),
  date date not null,
  timeslot text not null,
  amount numeric(10,2) not null,
  payment_ref text,
  status text not null default 'confirmed',
  created_at timestamp with time zone default now()
);

create table if not exists public.payment_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  amount numeric(10,2) not null,
  currency text not null default 'INR',
  method text not null default 'upi',
  status text not null default 'initialized',
  created_at timestamp with time zone default now()
);

create index if not exists idx_availability_puja_date on public.availability (puja_id, date);
create index if not exists idx_bookings_user on public.bookings (user_id);
create index if not exists idx_bookings_pandit on public.bookings (pandit_id);
