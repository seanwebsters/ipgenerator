-- WorldFactory: initial schema.
-- Not wired up yet: milestone 1 stores data in localStorage behind
-- FranchiseRepository (lib/repository.ts). This schema is the target for a
-- SupabaseFranchiseRepository. Every table is owner-scoped with RLS.

create extension if not exists "pgcrypto";

-- Franchises -----------------------------------------------------------------
create table public.franchises (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name         text not null,
  tagline      text not null default '',
  prompt       text not null default '',
  stage        text not null default 'discovery'
               check (stage in ('discovery', 'development', 'canon', 'expansion')),
  concept      jsonb not null default '{}'::jsonb,
  alternates   jsonb not null default '[]'::jsonb,
  core         jsonb not null default '{}'::jsonb,
  world        jsonb not null default '{}'::jsonb,
  plan         jsonb,
  canon_version integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index franchises_owner_idx on public.franchises (owner_id, updated_at desc);

-- Characters (first-class so edits can be versioned and referenced) -----------
create table public.characters (
  id            uuid primary key default gen_random_uuid(),
  franchise_id  uuid not null references public.franchises (id) on delete cascade,
  name          text not null,
  role          text not null default '',
  archetype     text not null default '',
  description   text not null default '',
  motivation    text not null default '',
  flaw          text not null default '',
  visual_notes  text not null default '',
  voice         text not null default '',
  color         text not null default '#a78bfa',
  relationships jsonb not null default '[]'::jsonb,
  revision      integer not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index characters_franchise_idx on public.characters (franchise_id);

-- Studio assets ---------------------------------------------------------------
create table public.assets (
  id             uuid primary key default gen_random_uuid(),
  franchise_id   uuid not null references public.franchises (id) on delete cascade,
  studio         text not null check (studio in (
                   'ip-lab', 'characters', 'world', 'story', 'social', 'animation',
                   'music', 'games', 'publishing', 'merch', 'brand', 'vault')),
  kind           text not null,
  title          text not null,
  summary        text not null default '',
  body           text not null default '',
  depends_on     text[] not null default '{}',   -- canon entity ids
  status         text not null default 'pending'
                 check (status in ('draft', 'pending', 'approved', 'needs_review')),
  review_reason  text,
  canon_version  integer not null default 0,
  meta           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index assets_franchise_idx on public.assets (franchise_id, studio);
create index assets_depends_on_idx on public.assets using gin (depends_on);

-- Canon ledger (append-only) --------------------------------------------------
create table public.canon_versions (
  franchise_id  uuid not null references public.franchises (id) on delete cascade,
  version       integer not null,
  author        text not null,
  summary       text not null,
  changes       text[] not null default '{}',
  hash          text not null,
  snapshot      jsonb not null,
  created_at    timestamptz not null default now(),
  primary key (franchise_id, version)
);

-- Approvals queue -------------------------------------------------------------
create table public.approvals (
  id            uuid primary key default gen_random_uuid(),
  franchise_id  uuid not null references public.franchises (id) on delete cascade,
  agent         text not null,
  studio        text not null,
  kind          text not null check (kind in ('asset', 'review', 'canon')),
  title         text not null,
  description   text not null default '',
  ref_id        text not null,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index approvals_pending_idx on public.approvals (franchise_id) where status = 'pending';

-- IP Vault --------------------------------------------------------------------
create table public.vault_records (
  id            uuid primary key default gen_random_uuid(),
  franchise_id  uuid not null references public.franchises (id) on delete cascade,
  kind          text not null check (kind in ('trademark', 'copyright', 'domain', 'design', 'chain-of-title')),
  title         text not null,
  jurisdiction  text not null default '',
  classes       text not null default '',
  status        text not null default 'idea' check (status in ('idea', 'cleared', 'filed', 'registered', 'flagged')),
  notes         text not null default '',
  updated_at    timestamptz not null default now()
);

-- Activity feed ---------------------------------------------------------------
create table public.activity (
  id            uuid primary key default gen_random_uuid(),
  franchise_id  uuid not null references public.franchises (id) on delete cascade,
  agent         text not null,
  text          text not null,
  created_at    timestamptz not null default now()
);
create index activity_franchise_idx on public.activity (franchise_id, created_at desc);

-- updated_at triggers -----------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger franchises_touch before update on public.franchises
  for each row execute function public.touch_updated_at();
create trigger characters_touch before update on public.characters
  for each row execute function public.touch_updated_at();
create trigger vault_touch before update on public.vault_records
  for each row execute function public.touch_updated_at();

-- Row level security ------------------------------------------------------------
alter table public.franchises     enable row level security;
alter table public.characters     enable row level security;
alter table public.assets         enable row level security;
alter table public.canon_versions enable row level security;
alter table public.approvals      enable row level security;
alter table public.vault_records  enable row level security;
alter table public.activity       enable row level security;

create policy "owners manage their franchises" on public.franchises
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Child tables: access follows the parent franchise's owner.
create or replace function public.owns_franchise(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.franchises f where f.id = fid and f.owner_id = auth.uid());
$$;

create policy "owners manage characters" on public.characters
  for all using (public.owns_franchise(franchise_id)) with check (public.owns_franchise(franchise_id));
create policy "owners manage assets" on public.assets
  for all using (public.owns_franchise(franchise_id)) with check (public.owns_franchise(franchise_id));
create policy "owners manage approvals" on public.approvals
  for all using (public.owns_franchise(franchise_id)) with check (public.owns_franchise(franchise_id));
create policy "owners manage vault" on public.vault_records
  for all using (public.owns_franchise(franchise_id)) with check (public.owns_franchise(franchise_id));
create policy "owners manage activity" on public.activity
  for all using (public.owns_franchise(franchise_id)) with check (public.owns_franchise(franchise_id));

-- The canon ledger is append-only: owners can read and insert, never edit or delete.
create policy "owners read canon" on public.canon_versions
  for select using (public.owns_franchise(franchise_id));
create policy "owners append canon" on public.canon_versions
  for insert with check (public.owns_franchise(franchise_id));
