-- Email + password sign-in replaces emailed codes.
alter table users add column password_hash text;
alter table users add column failed_logins smallint not null default 0;
alter table users add column locked_until timestamptz;

delete from auth_challenges where kind = 'email';
alter table auth_challenges drop constraint auth_challenges_kind_check;
alter table auth_challenges add constraint auth_challenges_kind_check check (kind in ('oauth_state', 'ext_code'));
