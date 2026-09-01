create table if not exists relic_finds (
  id serial primary key,
  user_id text not null,
  found_at timestamptz not null default now(),
  seed text not null,
  civ_name text not null,
  landmark_name text not null,
  place_label text not null,
  relic_id integer not null,
  relic_title text not null,
  world_x double precision not null,
  world_z double precision not null,
  unique (user_id, seed, relic_id)
);

create index if not exists relic_finds_user_found_at_idx
  on relic_finds (user_id, found_at desc);
