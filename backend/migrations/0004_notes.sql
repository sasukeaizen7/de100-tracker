-- Notion-style notes: nested pages with rich-text content (TipTap JSON) and images.

create table notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  parent_id  uuid references notes (id) on delete cascade,
  title      text not null default '' check (char_length(title) <= 200),
  icon       text not null default '' check (char_length(icon) <= 16),
  content    jsonb not null default '{"type":"doc","content":[]}'::jsonb check (octet_length(content::text) <= 2000000),
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_user_idx on notes (user_id, parent_id, position);

-- Images live in the database so backups and account deletion cover them.
create table note_images (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  mime       text not null check (mime in ('image/png', 'image/jpeg', 'image/gif', 'image/webp')),
  size       integer not null check (size between 1 and 5242880),
  data       bytea not null,
  created_at timestamptz not null default now()
);
create index note_images_user_idx on note_images (user_id);
