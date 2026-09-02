-- 灯火の視認距離。全員が同じ行を読む。個人設定にしない（滅び方の規格だから）。
create table if not exists game_settings (
  id integer primary key check (id = 1),
  lantern_off_m real not null,
  lantern_on_m real not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into game_settings (id, lantern_off_m, lantern_on_m)
values (1, 6.2, 20.5)
on conflict (id) do nothing;
