-- Public feedback is isolated from tenant data, which prevents unauthenticated
-- visitors from writing to client records.
create table if not exists public.website_feedback (
    id uuid primary key default gen_random_uuid(),
    name text,
    email text,
    rating smallint check (rating between 1 and 5),
    message text not null check (char_length(message) between 1 and 2000),
    page_context text,
    created_at timestamptz not null default now()
);

alter table public.website_feedback enable row level security;

-- Service-role API access is used; no anonymous table policies are granted.
