create table if not exists admins (
  user_id text primary key,
  granted_by text not null,
  granted_at timestamptz not null default now()
);
