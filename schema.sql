-- Old Man Tries BJJ — database schema
-- Run this once in Supabase: Project > SQL Editor > New query > paste > Run
--
-- MIGRATION NOTE: if you already ran an earlier version of this schema that had a
-- `youtube_id` column, run this first to switch to self-hosted video:
--   alter table clips rename column youtube_id to video_url;
-- (video_url should hold a full URL to your hosted mp4, not just an ID)

create extension if not exists "pgcrypto";

-- Clips: one row per technique clip
create table if not exists clips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Uncategorized',
  video_url text,                -- direct URL to your self-hosted mp4 (Cloudflare R2, Bunny Storage, Backblaze B2, etc.)
  thumbnail_url text,            -- thumbnail image URL — no auto-generation, set this manually or leave blank for a text-tile fallback
  source_credit text not null default 'Unknown — help us ID this',
  source_url text,               -- link to original creator's post, if known
  added_at timestamptz not null default now(),
  hidden boolean not null default false   -- soft-delete/hide without losing votes
);

create index if not exists clips_added_at_idx on clips (added_at desc);
create index if not exists clips_category_idx on clips (category);

-- Votes: one per (clip, visitor cookie)
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  clip_id uuid not null references clips(id) on delete cascade,
  vote_type text not null check (vote_type in ('UP', 'DOWN')),
  voter_cookie text not null,
  created_at timestamptz not null default now(),
  unique (clip_id, voter_cookie)
);

create index if not exists votes_clip_id_idx on votes (clip_id);

-- Comments: open, no login, lightweight rate limit enforced in app code
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  clip_id uuid not null references clips(id) on delete cascade,
  voter_cookie text not null,
  author_name text not null default 'Anonymous',
  belt text,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_clip_id_idx on comments (clip_id);

-- Private messages: questions/comments/clip-hosting requests, visible only to you (admin), never public
create table if not exists private_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  belt text,
  message text not null,
  created_at timestamptz not null default now()
);

-- Site settings: key/value store for theme tokens, bio text, banner text, etc.
-- This is what makes the site's look editable from the admin panel without a redeploy.
create table if not exists site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Upload batches: powers the "X new clips added" changelog / announcement feed
create table if not exists upload_batches (
  id uuid primary key default gen_random_uuid(),
  clip_count int not null,
  note text,
  created_at timestamptz not null default now()
);

-- Page views: one row per page load. path is 'home' for the homepage,
-- or 'clip:<uuid>' for a specific clip page. Simple event log — total
-- traffic is just a count() query, no counters to keep in sync.
create table if not exists page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  created_at timestamptz not null default now()
);

create index if not exists page_views_path_idx on page_views (path);
create index if not exists page_views_created_at_idx on page_views (created_at desc);

-- Seed default theme + site copy (safe to edit later via admin panel)
insert into site_settings (key, value) values
  ('theme', '{
    "colorBg": "#12140F",
    "colorText": "#EDEAE0",
    "colorLegit": "#6E8B5E",
    "colorSituational": "#C29A3B",
    "colorTrash": "#9C4A3D",
    "colorLine": "#2A2C24",
    "fontDisplay": "Quicksand, sans-serif",
    "fontBody": "system-ui, sans-serif",
    "fontMono": "\"IBM Plex Mono\", monospace"
  }'::jsonb)
on conflict (key) do nothing;

insert into site_settings (key, value) values
  ('site_copy', '{
    "name": "Old Man Tries BJJ",
    "handle": "@OldManTriesBJJ",
    "bio": "You know how you''re supposed to learn concepts rather than techniques... here''s a thousand techniques I saved anyway over the last four years from white belt to purple belt. Vote thumbs up or thumbs down.",
    "newBadgeDays": 7,
    "unratedPosition": "top",
    "excludedSearchWords": []
  }'::jsonb)
on conflict (key) do nothing;

-- Row Level Security: public can read clips/votes/comments/settings and insert votes/comments.
-- Writes to clips/site_settings/upload_batches are admin-only (done via server-side service role key, not from the browser).
alter table clips enable row level security;
alter table votes enable row level security;
alter table comments enable row level security;
alter table site_settings enable row level security;
alter table upload_batches enable row level security;
alter table page_views enable row level security;
alter table private_messages enable row level security;

create policy "public read clips" on clips for select using (hidden = false);
create policy "public read votes" on votes for select using (true);
create policy "public insert votes" on votes for insert with check (true);
create policy "public update votes" on votes for update using (true) with check (true);
create policy "public read comments" on comments for select using (true);
create policy "public insert comments" on comments for insert with check (true);
create policy "public read settings" on site_settings for select using (true);
create policy "public read batches" on upload_batches for select using (true);
create policy "public insert messages" on private_messages for insert with check (true);

-- No public write policies on clips/site_settings/upload_batches/updates to votes/comments —
-- those go through the admin API routes using the service role key, which bypasses RLS.
