-- Core schema. Validation lives in CHECK constraints as a second line of
-- defence behind the API's DTO validation.

create table users (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique check (email = lower(email) and char_length(email) <= 254),
  display_name text check (char_length(display_name) <= 80),
  start_date   date not null default date '2026-09-26',
  created_at   timestamptz not null default now()
);

-- One row per signed-in browser or extension. Revoking a row signs it out
-- immediately, because every request checks its session.
create table sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users (id) on delete cascade,
  kind              text not null check (kind in ('web', 'extension')),
  name              text not null check (char_length(name) between 1 and 60),
  refresh_hash      text not null,
  prev_refresh_hash text,
  rotated_at        timestamptz,
  created_at        timestamptz not null default now(),
  last_used_at      timestamptz not null default now(),
  expires_at        timestamptz not null,
  revoked_at        timestamptz
);
create index sessions_user_idx on sessions (user_id);

-- Short-lived secrets: email sign-in codes, OAuth state, extension auth codes.
-- Only hashes are stored.
create table auth_challenges (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('email', 'oauth_state', 'ext_code')),
  email       text,
  user_id     uuid references users (id) on delete cascade,
  code_hash   text,
  token_hash  text unique,
  payload     jsonb not null default '{}'::jsonb,
  attempts    smallint not null default 0,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index auth_challenges_email_idx on auth_challenges (email, created_at);

create table courses (
  id              smallint primary key,
  slug            text not null unique,
  title           text not null,
  instructor      text,
  udemy_url       text not null,
  udemy_course_id bigint unique,
  keywords        text[] not null default '{}',
  start_day       smallint not null check (start_day between 1 and 92),
  end_day         smallint not null check (end_day between start_day and 92)
);

create table course_progress (
  user_id   uuid not null references users (id) on delete cascade,
  course_id smallint not null references courses (id),
  percent   smallint not null check (percent between 0 and 100),
  source    text not null check (source in ('manual', 'extension')),
  synced_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

create table day_log (
  user_id    uuid not null references users (id) on delete cascade,
  day        smallint not null check (day between 1 and 92),
  done       boolean not null default false,
  notes      text not null default '' check (char_length(notes) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
