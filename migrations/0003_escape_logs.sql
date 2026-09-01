create table if not exists escape_logs (
  id serial primary key,
  user_id text not null,
  escaped_at timestamptz not null default now(),
  seed text not null,
  civ_name text not null,
  landmark_name text not null,
  place_label text not null,
  confiscated integer not null default 0
);

create index if not exists escape_logs_user_at_idx
  on escape_logs (user_id, escaped_at desc);
